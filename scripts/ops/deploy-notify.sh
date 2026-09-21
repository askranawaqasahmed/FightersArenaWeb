#!/usr/bin/env bash
# CAFA deploy notifier — emails a deploy result through the Resend account the
# apps already use. Called by the deploy-* skills at the end of a run (and on
# failure), so a deploy announces itself deliberately instead of being inferred
# from the health monitor's "PM2 process was restarted" warning.
#
# Installed on the server at ~/ops/deploy-notify.sh. Source of truth is the copy
# committed in each repo under scripts/ops/deploy-notify.sh — keep them in sync.
#
# Usage:
#   deploy-notify.sh <status> <app> [key=value ...]
#
#   status : ok | fail | start
#   app    : short app label, e.g. middleware | mamm | demo
#   pairs  : arbitrary rows rendered into the email table, in the order given.
#            Keys are shown verbatim; use quotes for values with spaces.
#
# Example:
#   ~/ops/deploy-notify.sh ok middleware \
#       Target="ideageekvm (ideageek-new)" \
#       Commit="b3a5aa6 -> e91c2f1" \
#       Migrations="0029_add_x.sql" \
#       Build="OK" Migrate="OK" \
#       Health='{"ok":true}' \
#       Duration="2m41s" \
#       URL="https://middleware.cafasuite.com"
#
#   ~/ops/deploy-notify.sh fail mamm Step="pnpm build" Error="TS2345 in lib/x.ts"
#
# Exit code is ALWAYS 0 for ok/start: a notification problem must never fail a
# deploy that otherwise succeeded. `fail` propagates 0 too — the skill already
# reports the real failure.
set -uo pipefail

RECIPIENTS="${DEPLOY_ALERT_EMAILS:-muhammad.owais9989@gmail.com,m.osama.farooq@hotmail.com,ranawaqasahmed@outlook.com}"

# Where to look for RESEND_API_KEY / EMAIL_FROM, first hit wins. The monitor
# conf is checked first so the key can be moved out of an app .env later without
# touching this script.
ENV_CANDIDATES=(
  "$HOME/ops/deploy-notify.conf"
  "$HOME/health-monitor/monitor.conf"
  "/var/www/client-mamm/.env"
  "/var/www/cafasuitetest/.env"
  "$HOME/cafasuite-middleware/.env"
)

log() { echo "[deploy-notify] $*" >&2; }

# Read one KEY=VALUE from a file, stripping optional surrounding quotes.
env_val() { # key file
  grep -E "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

find_val() { # key -> first non-empty across ENV_CANDIDATES
  local k="$1" f v
  for f in "${ENV_CANDIDATES[@]}"; do
    [ -f "$f" ] || continue
    v="$(env_val "$k" "$f")"
    [ -n "$v" ] && { printf '%s' "$v"; return 0; }
  done
  return 1
}

STATUS="${1:-}"; APP="${2:-}"
[ -n "$STATUS" ] && [ -n "$APP" ] || { log "usage: $0 <ok|fail|start> <app> [key=value ...]"; exit 0; }
shift 2

case "$STATUS" in
  ok)    BADGE="DEPLOYED"; ICON="&#9989;";  ACCENT="#15803d"; BG="#f0fdf4" ;;
  fail)  BADGE="FAILED";   ICON="&#10060;"; ACCENT="#b91c1c"; BG="#fef2f2" ;;
  start) BADGE="STARTED";  ICON="&#128640;"; ACCENT="#1d4ed8"; BG="#eff6ff" ;;
  *) log "unknown status '$STATUS' (expected ok|fail|start)"; exit 0 ;;
esac

KEY="${RESEND_API_KEY:-$(find_val RESEND_API_KEY || true)}"
FROM="${DEPLOY_ALERT_FROM:-$(find_val EMAIL_FROM || true)}"
FROM="${FROM:-onboarding@resend.dev}"

if [ -z "$KEY" ]; then
  log "RESEND_API_KEY not found in any of: ${ENV_CANDIDATES[*]} — skipping email"
  exit 0
fi
if ! command -v node >/dev/null 2>&1; then
  log "node not on PATH — cannot build JSON payload, skipping email"
  exit 0
fi

WHEN="$(date '+%Y-%m-%d %H:%M:%S %Z')"
HOSTN="$(hostname)"

# Rows: each remaining arg is key=value. Values are HTML-escaped by node below;
# here we only assemble a NUL-free delimited list to hand over.
ROWS=""
for pair in "$@"; do
  [ -n "$pair" ] || continue
  ROWS+="${pair}"$'\n'
done

SUBJECT="[CAFA DEPLOY] ${APP} ${BADGE} - ${HOSTN}"

HTML="$(APP="$APP" BADGE="$BADGE" ICON="$ICON" ACCENT="$ACCENT" BG="$BG" \
        WHEN="$WHEN" HOSTN="$HOSTN" ROWS="$ROWS" node -e '
  const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const { APP, BADGE, ICON, ACCENT, BG, WHEN, HOSTN, ROWS } = process.env;
  const rows = (ROWS || "").split("\n").filter(Boolean).map(line => {
    const i = line.indexOf("=");
    return i === -1 ? [line, ""] : [line.slice(0, i), line.slice(i + 1)];
  });
  const cellL = "padding:5px 14px 5px 0;color:#475569;white-space:nowrap;vertical-align:top";
  const cellR = "padding:5px 0;font-weight:600;color:#0f172a;font-family:ui-monospace,Consolas,monospace;word-break:break-word";
  const body = rows.map(([k, v]) =>
    `<tr><td style="${cellL}">${esc(k)}</td><td style="${cellR}">${esc(v)}</td></tr>`).join("");
  process.stdout.write(
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;color:#0f172a">` +
    `<div style="background:${BG};border-left:4px solid ${ACCENT};padding:10px 14px;border-radius:4px">` +
    `<span style="font-size:16px;font-weight:700;color:${ACCENT}">${ICON} ${esc(APP)} &mdash; ${esc(BADGE)}</span>` +
    `<div style="color:#475569;font-size:12px;margin-top:3px">${esc(HOSTN)} &bull; ${esc(WHEN)}</div></div>` +
    (body ? `<table style="border-collapse:collapse;font-size:13px;margin-top:12px">${body}</table>` : "") +
    `<p style="margin:14px 0 0;color:#64748b;font-size:12px">Sent by the deploy skill on ${esc(HOSTN)}. ` +
    `Server health/crash alerts are separate and come from the health monitor.</p></div>`);
')"

PAYLOAD="$(FROM="$FROM" TO="$RECIPIENTS" SUBJ="$SUBJECT" HTML="$HTML" node -e '
  const to = process.env.TO.split(",").map(s => s.trim()).filter(Boolean);
  process.stdout.write(JSON.stringify({
    from: process.env.FROM, to, subject: process.env.SUBJ, html: process.env.HTML,
  }));')"

RESP="$(curl -sS -m 20 -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d "$PAYLOAD" -w $'\n%{http_code}' 2>&1)"
CODE="${RESP##*$'\n'}"

if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  log "sent: $SUBJECT -> $RECIPIENTS"
else
  log "resend HTTP $CODE: $(printf '%s' "$RESP" | head -c 300)"
fi
exit 0
