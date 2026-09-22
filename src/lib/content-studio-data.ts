import type { UploadedMedia } from "@/components/media-upload-field";

export const contentStudioStorageKey = "fighters-arena:content-studio";
export const contentStudioChangeEvent = "fighters-arena:content-studio-change";

export type ContentAttachment = Pick<UploadedMedia, "key" | "url" | "mimeType" | "sizeBytes"> & { name: string };
export type ContentArticle = { id: string; title: string; slug: string; excerpt: string; body: string; attachments: ContentAttachment[]; status: "draft" | "published"; updatedAt: string };
export type HomepageSlide = { id: string; eyebrow: string; title: string; summary: string; imageUrl: string; imageAlt: string; ctaLabel: string; ctaUrl: string; status: "draft" | "published"; order: number };
export type ContentStudioData = { articles: ContentArticle[]; slides: HomepageSlide[] };

export const defaultContentStudioData: ContentStudioData = {
  articles: [{ id: "platform-launch", title: "Welcome to Fighters Arena", slug: "welcome-to-fighters-arena", excerpt: "Pakistan's verified competitive gaming platform is now live.", body: "## The arena is open\n\nCreate your gamer profile, enter competitions, and build a verified competitive history.", attachments: [], status: "published", updatedAt: "2026-08-18" }],
  slides: [{ id: "default-hero", eyebrow: "Pakistan's competitive gaming platform", title: "Own your game. Build your legacy.", summary: "One verified identity for every gamer, event and achievement.", imageUrl: "/images/arena-hero.png", imageAlt: "Esports competitors facing a championship arena stage", ctaLabel: "Explore events", ctaUrl: "/tournaments", status: "published", order: 1 }],
};

export type ApiSlide = {
  id: string;
  eyebrow: string | null;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  sequence: number;
  published?: boolean;
};

export function slideFromApi(slide: ApiSlide): HomepageSlide {
  return {
    id: slide.id,
    eyebrow: slide.eyebrow ?? "",
    title: slide.title,
    summary: slide.summary ?? "",
    imageUrl: slide.imageUrl ?? "",
    imageAlt: slide.imageAlt ?? "",
    ctaLabel: slide.ctaLabel ?? "Explore events",
    ctaUrl: slide.ctaUrl ?? "/tournaments",
    status: slide.published === false ? "draft" : "published",
    order: slide.sequence,
  };
}

export function normalizeContentStudioData(value: ContentStudioData): ContentStudioData {
  return { ...value, articles: value.articles.map((article) => ({ ...article, attachments: article.attachments ?? [] })) };
}
