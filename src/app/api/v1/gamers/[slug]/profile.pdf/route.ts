import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { featuredGamers, sponsorsData } from "@/lib/demo-data";
import { apiProblem } from "@/lib/api";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gamer = featuredGamers.find((item) => item.slug === slug);
  if (!gamer) return apiProblem(404, "GAMER_NOT_FOUND", "Gamer not found", "The requested public gamer profile does not exist.");

  const document = await PDFDocument.create();
  document.setTitle(`${gamer.handle} — eFightersArena profile`);
  document.setAuthor("eFightersArena");
  const page = document.addPage([595, 842]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const white = rgb(1, 1, 1);
  const muted = rgb(.7, .7, .7);
  const green = rgb(0, 1, .52);
  const blue = rgb(.12, .56, 1);
  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(.05, .05, .05) });
  page.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: green });
  page.drawText("eFightersArena", { x: 38, y: 814, font: bold, size: 15, color: rgb(.02, .08, .05) });
  page.drawText("VERIFIED GAMER PROFILE", { x: 400, y: 815, font: bold, size: 8, color: rgb(.02, .08, .05) });
  page.drawText(gamer.handle, { x: 38, y: 710, font: bold, size: 44, color: white });
  page.drawText(gamer.name, { x: 40, y: 680, font: regular, size: 16, color: muted });
  page.drawText(`National rank #${gamer.rank}`, { x: 40, y: 645, font: bold, size: 12, color: green });
  page.drawText(`${gamer.city}, Pakistan  |  ${gamer.game}`, { x: 40, y: 622, font: regular, size: 11, color: white });
  page.drawRectangle({ x: 38, y: 535, width: 519, height: 58, borderColor: rgb(.2, .2, .2), borderWidth: 1 });
  page.drawText("RANKING POINTS", { x: 58, y: 568, font: bold, size: 8, color: muted });
  page.drawText(gamer.points.toLocaleString(), { x: 58, y: 545, font: bold, size: 18, color: green });
  page.drawText("CURRENT SPONSOR", { x: 220, y: 568, font: bold, size: 8, color: muted });
  page.drawText(sponsorsData[gamer.rank - 1] ?? "Independent", { x: 220, y: 545, font: bold, size: 15, color: white });
  page.drawText("VERIFICATION", { x: 420, y: 568, font: bold, size: 8, color: muted });
  page.drawText("ACTIVE", { x: 420, y: 545, font: bold, size: 15, color: blue });
  page.drawText("VERIFIED ACHIEVEMENTS", { x: 38, y: 480, font: bold, size: 11, color: green });
  const achievements = [
    ["National Championship 2026", "1st place", "Organizer verified"],
    ["City Masters Spring", "Top 4", "2026 season"],
    ["Regional Open", "2nd place", "Organizer verified"],
  ];
  achievements.forEach(([event, result, note], index) => {
    const y = 432 - index * 58;
    page.drawLine({ start: { x: 38, y: y + 30 }, end: { x: 557, y: y + 30 }, color: rgb(.16, .16, .16), thickness: 1 });
    page.drawText(event, { x: 38, y, font: bold, size: 11, color: white });
    page.drawText(note, { x: 38, y: y - 16, font: regular, size: 8, color: muted });
    page.drawText(result, { x: 475, y, font: bold, size: 11, color: index === 0 ? green : white });
  });
  page.drawText("This document contains public, consented profile data and verified platform results.", { x: 38, y: 110, font: regular, size: 8, color: muted });
  page.drawText(`Verify: efightersarena.com/gamers/${gamer.slug}`, { x: 38, y: 88, font: bold, size: 9, color: blue });
  page.drawText(`Generated ${new Date().toISOString()}`, { x: 38, y: 65, font: regular, size: 7, color: muted });
  const bytes = await document.save();
  return new Response(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${gamer.slug}-efightersarena-profile.pdf"`, "cache-control": "public, max-age=300" } });
}
