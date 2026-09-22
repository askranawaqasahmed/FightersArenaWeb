import { describe, expect, it } from "vitest";
import { resolveUploadedPdf } from "@/lib/uploaded-profile-pdf";

describe("resolveUploadedPdf", () => {
  it("resolves a designed PDF that exists under public/profiles", async () => {
    const found = await resolveUploadedPdf("/profiles/kashif-yagami.pdf");
    expect(found?.size).toBeGreaterThan(0);
  });

  it("returns null when no custom PDF is set, so the generated one is used", async () => {
    expect(await resolveUploadedPdf(null)).toBeNull();
  });

  it("returns null when the file is missing rather than failing the download", async () => {
    expect(await resolveUploadedPdf("/profiles/not-a-real-player.pdf")).toBeNull();
  });

  it("refuses a path that is not a PDF", async () => {
    expect(await resolveUploadedPdf("/profiles/package.json")).toBeNull();
  });

  it("stays inside public/profiles when given a traversal path", async () => {
    expect(await resolveUploadedPdf("../../../../etc/passwd.pdf")).toBeNull();
  });
});
