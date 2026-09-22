import "server-only";

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { achievementGroupTitles, type AchievementCategory } from "@/lib/achievement-labels";
import { placementLabel } from "@/lib/placement";
import { getMediaObject } from "@/lib/object-storage";
import type { PublicGamerProfile } from "@/lib/public-gamer-data";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = 76;

const INK = rgb(0.039, 0.047, 0.078);
const CARD = rgb(0.094, 0.110, 0.149);
const WHITE = rgb(0.918, 0.925, 0.937);
const MUTED = rgb(0.62, 0.64, 0.68);
/** Crimson leads the design; gold marks a title, mint a development note. */
const ACCENT = rgb(0.843, 0.157, 0.243);
const GOLD = rgb(0.882, 0.788, 0.400);
const MINT = rgb(0.361, 0.851, 0.596);
const GREEN = GOLD;
const RULE = rgb(0.16, 0.17, 0.19);

/**
 * pdf-lib's standard fonts are WinAnsi only and throw on anything outside it,
 * so smart punctuation and emoji are folded down rather than failing the export.
 */
function sanitize(value: string) {
  return value
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[×✕]/g, "x")
    .replace(/[^\x20-\x7E -ÿ]/g, "")
    .trim();
}

type Cursor = { page: PDFPage; y: number };

export type ProfilePdfFonts = { regular: PDFFont; bold: PDFFont };

function newPage(document: PDFDocument): PDFPage {
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: INK });
  // The crimson rule that heads every page of the designed profile.
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 7, width: PAGE_WIDTH, height: 7, color: ACCENT });
  return page;
}

/** Starts a new page when the next block would cross the footer. */
function ensureSpace(document: PDFDocument, cursor: Cursor, needed: number) {
  if (cursor.y - needed >= BOTTOM_LIMIT) return;
  cursor.page = newPage(document);
  cursor.y = PAGE_HEIGHT - MARGIN;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(
  document: PDFDocument,
  cursor: Cursor,
  text: string,
  options: { font: PDFFont; size: number; color: ReturnType<typeof rgb>; maxWidth?: number; lineGap?: number },
) {
  const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
  const lineHeight = options.size + (options.lineGap ?? 4);
  for (const line of wrap(text, options.font, options.size, maxWidth)) {
    ensureSpace(document, cursor, lineHeight);
    cursor.page.drawText(line, { x: MARGIN, y: cursor.y, font: options.font, size: options.size, color: options.color });
    cursor.y -= lineHeight;
  }
}

/** Crimson eyebrow over a large title, as in the designed profile. */
function drawSectionTitle(document: PDFDocument, cursor: Cursor, title: string, fonts: ProfilePdfFonts, eyebrow?: string) {
  ensureSpace(document, cursor, 58);
  cursor.y -= 18;
  if (eyebrow) {
    cursor.page.drawText(sanitize(eyebrow).toUpperCase(), { x: MARGIN, y: cursor.y, font: fonts.bold, size: 8, color: ACCENT });
    cursor.y -= 15;
  }
  cursor.page.drawText(sanitize(title).toUpperCase(), { x: MARGIN, y: cursor.y, font: fonts.bold, size: 17, color: WHITE });
  cursor.y -= 10;
  cursor.page.drawLine({
    start: { x: MARGIN, y: cursor.y },
    end: { x: PAGE_WIDTH - MARGIN, y: cursor.y },
    color: RULE,
    thickness: 1,
  });
  cursor.y -= 16;
}

/** A left label with a right-aligned value, used for results and highlights. */
function drawRow(
  document: PDFDocument,
  cursor: Cursor,
  left: string,
  sub: string | null,
  /** Null when there is nothing worth printing in the right-hand column. */
  right: string | null,
  fonts: ProfilePdfFonts,
  highlight: boolean,
  /** Overrides the rail colour; coaching and development rows use mint. */
  rail?: ReturnType<typeof rgb>,
) {
  const rightText = right ? sanitize(right) : "";
  const rightWidth = rightText ? fonts.bold.widthOfTextAtSize(rightText, 10) : 0;
  const TEXT_X = MARGIN + 16;
  const leftWidth = CONTENT_WIDTH - rightWidth - 34;
  const titleLines = wrap(left, fonts.bold, 11, leftWidth);
  const subLines = sub ? wrap(sub, fonts.regular, 8.5, leftWidth) : [];
  const cardHeight = titleLines.length * 14 + subLines.length * 11 + 16;

  ensureSpace(document, cursor, cardHeight + 6);
  const cardTop = cursor.y + 11;
  const cardBottom = cardTop - cardHeight;

  // Card body with a coloured rail on the left, as in the designed profile:
  // gold marks a title, crimson every other finish.
  cursor.page.drawRectangle({
    x: MARGIN,
    y: cardBottom,
    width: CONTENT_WIDTH,
    height: cardHeight,
    color: CARD,
  });
  cursor.page.drawRectangle({
    x: MARGIN,
    y: cardBottom + 3,
    width: 3.5,
    height: cardHeight - 6,
    color: rail ?? (highlight ? GOLD : ACCENT),
  });

  const top = cardTop - 14;
  titleLines.forEach((line, index) => {
    cursor.page.drawText(line, { x: TEXT_X, y: top - index * 14, font: fonts.bold, size: 11, color: WHITE });
  });
  subLines.forEach((line, index) => {
    cursor.page.drawText(line, {
      x: TEXT_X,
      y: top - titleLines.length * 14 - index * 11 + 2,
      font: fonts.regular,
      size: 8.5,
      color: MUTED,
    });
  });
  if (rightText) {
    cursor.page.drawText(rightText, {
      x: PAGE_WIDTH - MARGIN - rightWidth - 14,
      y: top,
      font: fonts.bold,
      size: 10,
      color: highlight ? GOLD : WHITE,
    });
  }

  cursor.y = cardBottom - 7;
}

/** pdf-lib embeds PNG and JPEG only; anything else falls back to the initials badge. */
async function embedAvatar(document: PDFDocument, avatarUrl: string | null) {
  if (!avatarUrl) return null;
  const match = /^\/api\/v1\/media\/(.+)$/.exec(avatarUrl);
  if (!match) return null;
  try {
    const key = match[1].split("/").map(decodeURIComponent).join("/");
    const object = await getMediaObject(key);
    const contentType = object.ContentType ?? "";
    if (contentType !== "image/png" && contentType !== "image/jpeg") return null;
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes) return null;
    return contentType === "image/png" ? await document.embedPng(bytes) : await document.embedJpg(bytes);
  } catch {
    // An unreachable or unsupported avatar must never fail the export.
    return null;
  }
}

function statTiles(gamer: PublicGamerProfile) {
  const tiles: Array<[string, string]> = [
    ["TITLES", String(gamer.totals.titles)],
    ["PODIUMS", String(gamer.totals.podiums)],
    ["EVENTS", String(gamer.totals.events)],
  ];
  if (gamer.totals.played > 0) {
    tiles.push(["MATCHES WON", `${gamer.totals.wins}/${gamer.totals.played}`]);
  } else {
    tiles.push(["GAMES", String(gamer.games.length)]);
  }
  return tiles;
}

export async function buildGamerProfilePdf(gamer: PublicGamerProfile, siteUrl: string) {
  const document = await PDFDocument.create();
  document.setTitle(`${sanitize(gamer.handle)} - eFightersArena profile`);
  document.setAuthor("eFightersArena");
  document.setSubject("Competitive player profile");

  const fonts: ProfilePdfFonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };

  const cursor: Cursor = { page: newPage(document), y: PAGE_HEIGHT - MARGIN };

  // A thin crimson rule tops every page; the eyebrow names the document.
  const badge = gamer.verified ? "VERIFIED ESPORTS CAREER PROFILE" : "ESPORTS CAREER PROFILE";
  cursor.page.drawText(badge, { x: MARGIN, y: PAGE_HEIGHT - 64, font: fonts.bold, size: 8, color: ACCENT });
  cursor.y = PAGE_HEIGHT - 92;

  // Identity block, with the avatar on the right.
  const avatar = await embedAvatar(document, gamer.avatarUrl);
  const avatarSize = 84;
  const avatarX = PAGE_WIDTH - MARGIN - avatarSize;
  const avatarY = cursor.y - avatarSize + 26;
  if (avatar) {
    cursor.page.drawImage(avatar, { x: avatarX, y: avatarY, width: avatarSize, height: avatarSize });
  } else {
    cursor.page.drawRectangle({ x: avatarX, y: avatarY, width: avatarSize, height: avatarSize, color: rgb(0.1, 0.11, 0.13) });
    const initials = sanitize(gamer.initials) || "?";
    cursor.page.drawText(initials, {
      x: avatarX + avatarSize / 2 - fonts.bold.widthOfTextAtSize(initials, 30) / 2,
      y: avatarY + avatarSize / 2 - 11,
      font: fonts.bold,
      size: 30,
      color: GREEN,
    });
  }

  const identityWidth = CONTENT_WIDTH - avatarSize - 24;
  const handleLines = wrap(gamer.handle, fonts.bold, 30, identityWidth);
  for (const line of handleLines) {
    cursor.page.drawText(line, { x: MARGIN, y: cursor.y, font: fonts.bold, size: 30, color: WHITE });
    cursor.y -= 34;
  }
  if (gamer.name && gamer.name !== gamer.handle) {
    cursor.page.drawText(sanitize(gamer.name), { x: MARGIN, y: cursor.y, font: fonts.regular, size: 13, color: MUTED });
    cursor.y -= 18;
  }
  const location = [gamer.city, gamer.country].filter(Boolean).join(", ");
  const meta = [location, gamer.game].filter(Boolean).join("  |  ");
  if (meta) {
    cursor.page.drawText(sanitize(meta), { x: MARGIN, y: cursor.y, font: fonts.regular, size: 10, color: WHITE });
    cursor.y -= 18;
  }
  cursor.y = Math.min(cursor.y, avatarY) - 22;

  // Stat tiles
  const tiles = statTiles(gamer);
  const tileWidth = CONTENT_WIDTH / tiles.length;
  ensureSpace(document, cursor, 64);
  cursor.page.drawRectangle({ x: MARGIN, y: cursor.y - 44, width: CONTENT_WIDTH, height: 58, borderColor: RULE, borderWidth: 1 });
  tiles.forEach(([label, value], index) => {
    const x = MARGIN + index * tileWidth + 16;
    cursor.page.drawText(label, { x, y: cursor.y - 10, font: fonts.bold, size: 7.5, color: MUTED });
    cursor.page.drawText(value, { x, y: cursor.y - 32, font: fonts.bold, size: 17, color: index === 0 ? GREEN : WHITE });
  });
  cursor.y -= 62;

  if (gamer.bio) {
    drawSectionTitle(document, cursor, "About", fonts, "Profile");
    drawParagraph(document, cursor, gamer.bio, { font: fonts.regular, size: 10, color: WHITE, lineGap: 5 });
  }

  if (gamer.games.length > 0) {
    drawSectionTitle(document, cursor, "Games", fonts, "Competitive titles");
    for (const entry of gamer.games) {
      const detail = [entry.primaryRole, entry.platform].filter(Boolean).join(" · ") || null;
      // Matches the profile page: the handle is already in the header, so only an
      // in-game name that actually differs is worth a column of its own.
      const alias = entry.inGameName === gamer.handle ? null : entry.inGameName;
      drawRow(document, cursor, entry.game, detail, alias, fonts, false);
    }
  }

  if (gamer.placements.length > 0) {
    drawSectionTitle(document, cursor, "Tournament results", fonts, "Competitive record");
    for (const entry of gamer.placements) {
      const sub = [entry.gameName, entry.year ? String(entry.year) : null].filter(Boolean).join(" · ");
      drawRow(
        document,
        cursor,
        entry.tournamentName,
        sub || null,
        placementLabel(entry.finalRank, entry.placementLabel),
        fonts,
        entry.finalRank === 1,
      );
    }
  }

  if (gamer.events.length > 0) {
    drawSectionTitle(document, cursor, "Competition record", fonts, "Match results");
    for (const event of gamer.events) {
      const sub = [event.gameName, event.divisionName].filter(Boolean).join(" · ");
      const record = event.played > 0 ? `${event.wins}W-${event.losses}L` : placementLabel(event.rank);
      drawRow(document, cursor, event.tournamentName, sub || null, record, fonts, event.rank === 1);
    }
  }

  // Career highlights, grouped in the same order as the public profile.
  const groups = (Object.keys(achievementGroupTitles) as AchievementCategory[])
    .map((category) => ({ category, items: gamer.achievements.filter((entry) => entry.category === category) }))
    .filter((group) => group.items.length > 0);
  for (const group of groups) {
    const development = group.category === "coaching" || group.category === "player_developed";
    drawSectionTitle(
      document,
      cursor,
      achievementGroupTitles[group.category],
      fonts,
      development ? "Coaching & mentorship" : "Career record",
    );
    for (const entry of group.items) {
      const sub = [entry.detail, entry.gameName].filter(Boolean).join(" · ");
      drawRow(document, cursor, entry.title, sub || null, entry.yearLabel ?? "", fonts, false, development ? MINT : undefined);
    }
  }

  if (gamer.teams.length > 0) {
    drawSectionTitle(document, cursor, "Teams", fonts, "Rosters");
    for (const team of gamer.teams) {
      drawRow(document, cursor, team.name, team.isLeader ? "Team leader" : team.role, team.tag, fonts, false);
    }
  }

  if (gamer.sponsors.length > 0) {
    drawSectionTitle(document, cursor, "Sponsors", fonts, "Partners");
    for (const sponsor of gamer.sponsors) {
      drawRow(document, cursor, sponsor.name, sponsor.category, "", fonts, false);
    }
  }

  // Footer on every page, with the page number and the verifiable profile address.
  const profileUrl = `${siteUrl.replace(/\/+$/, "")}/gamers/${gamer.slug}`;
  const pages = document.getPages();
  pages.forEach((page, index) => {
    page.drawLine({ start: { x: MARGIN, y: 58 }, end: { x: PAGE_WIDTH - MARGIN, y: 58 }, color: RULE, thickness: 0.6 });
    const footerLabel = sanitize(`${gamer.handle}  |  COMPETITIVE ESPORTS PROFILE`).toUpperCase();
    page.drawText(footerLabel, { x: MARGIN, y: 42, font: fonts.regular, size: 8, color: MUTED });
    page.drawText(sanitize(profileUrl), { x: MARGIN, y: 30, font: fonts.regular, size: 7, color: GOLD });
    const pageLabel = String(index + 1).padStart(2, "0");
    page.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN - fonts.bold.widthOfTextAtSize(pageLabel, 8),
      y: 42,
      font: fonts.bold,
      size: 8,
      color: MUTED,
    });
  });

  return document.save();
}
