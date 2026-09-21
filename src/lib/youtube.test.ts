import { describe, expect, it } from "vitest";
import { parseYouTubeId, youtubeEmbedUrl } from "@/lib/youtube";

describe("parseYouTubeId", () => {
  it("reads the id from every YouTube address shape", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("youtube.com/watch?v=dQw4w9WgXcQ&t=90")).toBe("dQw4w9WgXcQ");
  });

  it("refuses any other host, so an arbitrary page cannot be framed", () => {
    expect(parseYouTubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeId("https://youtube.evil.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("returns null for empty or malformed values", () => {
    expect(parseYouTubeId(null)).toBeNull();
    expect(parseYouTubeId("")).toBeNull();
    expect(parseYouTubeId("   ")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/watch?v=tooshort")).toBeNull();
    expect(parseYouTubeId("not a url")).toBeNull();
  });

  it("builds a no-cookie embed address", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
});
