# Public JSON APIs — external consumer guide

Two separate public surfaces:

| Purpose | Endpoint | Notes |
|---|---|---|
| OBS / desktop scoreboard feed | `GET /api/v1/boards/{1..8}?format=simple` | One assigned match per board, flat shape — see below |
| Public tournament list | `GET /api/v1/tournaments` | Published, registering, live and completed events |
| Public tournament detail | `GET /api/v1/tournaments/{slug\|uuid}` | Event plus its game competitions (`divisionList`) |
| Public live bracket | `GET /api/v1/tournaments/{slug\|uuid}/bracket?division={id}` | Bracket, full match list and standings; ETag-pollable |
| Public player rankings | `GET /api/v1/gamers` | Publicly visible profiles, ranked by points |
| Public player profile | `GET /api/v1/gamers/{slug}` | Record, game identities, placements, teams, sponsors |

The tournament endpoints back the public website pages `/tournaments`,
`/tournaments/{slug}` and `/tournaments/{slug}/bracket`. Only tournaments whose status is
`published`, `registration_open`, `registration_closed`, `live` or `completed` are exposed —
drafts, cancellations and archives never appear. Within a visible event every competition is
listed, with `bracketAvailable: false` until the operator starts it.

Player profiles are exposed only when `profileVisibility` is `public`; `private` and
`sponsors` profiles are absent from the rankings and 404 on a direct slug. Bracket
participants carry a `profileSlug` when they have a public profile, which is what makes
names clickable on `/tournaments/{slug}/bracket`.

---

# Stream Boards API

Public, unauthenticated JSON for feeding live match data into OBS via your own desktop
middleware app. The operator assigns matches to numbered boards in the admin panel
("Manage matches" → Stream boards) and starts/stops/scores matches there; consumers poll
a board number and always receive whatever match is currently assigned to it.

Sample payloads for every state your consumer must handle: [`stream-boards-sample.json`](./stream-boards-sample.json).

## Architecture: portal (server A) → desktop app (streaming PC) → OBS

```
  Next.js portal                 Streaming PC
 ┌────────────────┐        ┌──────────────────────────────┐
 │ admin starts   │  HTTPS │ your desktop app             │
 │ match, clicks  │◀───────│  polls /api/v1/boards/N      │
 │ +1 / −1        │  1/sec │  writes one .txt per field   │
 └────────────────┘        │            ↓                 │
                           │ OBS Text (GDI+) sources,     │
                           │ each positioned independently│
                           └──────────────────────────────┘
```

OBS cannot parse JSON itself, and a Browser Source pointed at the raw URL would render the
JSON blob as text. Your desktop app is the correct bridge: it turns each JSON value into its
own OBS source so **every name and score can be placed and aligned separately** per game
layout — nothing about the on-screen arrangement is baked into the API.

## Endpoint

```
GET https://<your-domain>/api/v1/boards/{number}?format=simple
```

- `{number}`: board number, 1–8. One board per stream/PC.
- `format=simple`: flat root object, no envelope — use this for external consumers.
- Omit `format` for the richer nested shape under `{ "data": ... }` used by the built-in
  overlay pages (`include=profile&slot=1|2` adds a single featured profile there).
- CORS is open (`Access-Control-Allow-Origin: *`) and no auth is required, so a desktop app
  on a different machine, network, or continent can call it directly over HTTPS.

Because the portal and the streaming PC are separate machines, use the **deployed domain**,
not `localhost`. Only the streaming PC needs outbound HTTPS; no inbound ports, no VPN.

> **Security note:** this endpoint is intentionally public — anyone who knows the URL can
> read board state (names, scores, public profile fields). That matches broadcast data, but
> if you later want it private, add a shared-secret query token or header check to
> `src/app/api/v1/boards/[number]/route.ts` and send it from your app.

## Polling contract

Poll once per second. Send the `ETag` response header back as `If-None-Match`; unchanged
state returns `304 Not Modified` with an empty body, so idle polling costs almost nothing
and you only rewrite OBS files when something actually changed.

```csharp
// C# sketch — same idea in any language
var res = await http.SendAsync(req);              // req has If-None-Match: lastEtag
if (res.StatusCode == HttpStatusCode.NotModified) return;   // nothing changed
lastEtag = res.Headers.ETag?.Tag;
var board = JsonSerializer.Deserialize<SimpleBoard>(await res.Content.ReadAsStringAsync());
WriteFields(board);                                // one .txt per field
```

`version` mirrors the ETag and changes whenever anything changes: score adjusted, match
started / paused / finished, board reassigned, or featured player switched. Starting and
stopping a match in the portal therefore reaches OBS within one poll (~1s).

**Resilience:** on a network error or non-200, keep the last values on screen and retry next
tick. Never blank the fields on a transient failure — a dropped frame mid-stream is worse
than slightly stale text.

## `format=simple` response

```jsonc
{
  "board": 7,
  "assigned": true,                     // false → no match on this board; players is []
  "version": "…",                       // change detector, mirrors the ETag
  "tournament": "Iron Fist Weekend 2026",
  "division": "Tekken 8 Open",
  "game": "Tekken 8",
  "matchCode": "R1-M1",
  "round": "Semifinals",
  "lane": "main",                       // main | upper | lower | final
  "bestOf": 5,
  "status": "live",                     // scheduled|ready|live|paused|final|forfeit|cancelled
  "startedAt": "2026-08-21T13:23:06.599Z",
  "endedAt": null,
  "featuredSlot": 1,                    // operator's pick for the profile screen (or null)
  "winnerSlot": null,                   // 1 | 2 once the match is final
  "players": [
    {
      "slot": 1,                        // 1 = left/player one, 2 = right/player two
      "name": "VIPER",                  // display name — null on an unresolved TBD side
      "score": 2,                       // live score; updates within ~1s of admin +1/−1
      "outcome": null,                  // win | loss | draw once final
      "winner": false,
      "type": "gamer",                  // gamer | team | null (null = TBD side)
      "handle": "VIPER",
      "avatarUrl": "/api/v1/media/avatars/viper.png",   // relative — prefix with your origin
      "countryCode": "PK",              // ISO 3166-1 alpha-2, for flag images
      "country": "Pakistan",
      "city": "Lahore",
      "bio": "Two-time national Tekken finalist from Lahore…",
      "rankingPoints": 2480,
      "games": [
        { "game": "Tekken 8", "inGameName": "V1PER", "primaryRole": "Rushdown", "platform": "PS5" }
      ],
      "record": { "played": 0, "wins": 0, "losses": 0, "points": 0 },  // this stage's standings
      "team": null                      // { name, tag, logoUrl } in team divisions
    },
    { "slot": 2, "name": "FROST", "score": 1, "…": "…" }
  ]
}
```

Guarantees you can rely on:

- Every key is always present; empty data is `null` or `[]`, never a missing key.
- `players` is ordered by `slot`, but match on `slot` rather than array index.
- `avatarUrl` / `logoUrl` are site-relative; prefix with your origin to download.
- Team divisions put the club in `team` and its tag in `handle`; `record` still applies.

## Suggested field → OBS source mapping

One plain-text file per field, each read by its own Text (GDI+) source with
"Read from file" enabled — that is what lets you drag each element anywhere per game.

| OBS source | File your app writes | JSON source |
|---|---|---|
| P1 name | `p1_name.txt` | `players[slot=1].name` |
| P1 score | `p1_score.txt` | `players[slot=1].score` |
| P2 name | `p2_name.txt` | `players[slot=2].name` |
| P2 score | `p2_score.txt` | `players[slot=2].score` |
| Round label | `round.txt` | `round` (+ `matchCode` if wanted) |
| Series format | `best_of.txt` | `"BO" + bestOf` |
| Status badge | `status.txt` | `status` (blank unless `live`/`final`) |
| Event name | `event.txt` | `tournament` / `division` |
| Profile name | `profile_name.txt` | player at `featuredSlot` → `name` |
| Profile handle | `profile_handle.txt` | …→ `handle` |
| Profile location | `profile_location.txt` | …→ `city`, `country` |
| Profile points | `profile_points.txt` | …→ `rankingPoints` |
| Profile record | `profile_record.txt` | …→ `record.wins` W / `record.losses` L |
| Profile bio | `profile_bio.txt` | …→ `bio` |
| P1/P2 avatar | `p1_avatar.png` | download `avatarUrl` → Image source |
| P1/P2 flag | `p1_flag.png` | map `countryCode` → your flag asset |

Write files atomically (write to a temp name, then rename) so OBS never reads a half-written
file, and only rewrite a file when its value actually changed — OBS reloads on file change,
and rewriting identical text causes needless flicker.

Handle these states explicitly: `assigned: false` (blank every field), `type: null` /
`name: null` (show "TBD"), `status` of `paused` (you may want to hide the LIVE badge), and
`final` (highlight `winnerSlot`).

## Ready-made overlay pages (alternative, no code)

If you ever want the built-in overlays instead of your own, point an OBS Browser Source at:

- `/overlay/board/{n}` — transparent score bar
- `/overlay/board/{n}/card` — full-screen match card
- `/overlay/board/{n}/profile` — featured player profile (`?slot=1|2` to pin a side)

## Admin side (how data gets in)

- Assign a match to a board: `PUT /api/v1/admin/boards/{number}` with
  `{ "matchId": "…", "featuredSlot": 1 }` (admin session required), or use the Stream
  boards strip in the admin UI.
- Live score: `POST /api/v1/admin/matches/{id}/lifecycle` with
  `{ "action": "score_adjust", "slot": 1, "delta": 1 }`, or the +/− buttons in the admin UI.
- Start / pause / finish: same endpoint with `action` of `start`, `stop`, or `finish`.
