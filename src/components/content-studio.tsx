"use client";

import { Bold, Eye, FileText, Heading2, ImagePlus, Italic, Link2, List, Pencil, Plus, Save, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MediaUploadField, type UploadedMedia } from "./media-upload-field";

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

type ApiSlide = {
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

function slideToApi(slide: HomepageSlide, status: HomepageSlide["status"]) {
  return {
    eyebrow: slide.eyebrow.trim() || null,
    title: slide.title.trim(),
    summary: slide.summary.trim() || null,
    imageUrl: slide.imageUrl.trim() || null,
    imageAlt: slide.imageAlt.trim() || null,
    ctaLabel: slide.ctaLabel.trim() || null,
    ctaUrl: slide.ctaUrl.trim() || null,
    sequence: Math.max(1, slide.order),
    published: status === "published",
  };
}

const emptyArticle: ContentArticle = { id: "", title: "", slug: "", excerpt: "", body: "", attachments: [], status: "draft", updatedAt: "" };
const emptySlide: HomepageSlide = { id: "", eyebrow: "", title: "", summary: "", imageUrl: "", imageAlt: "", ctaLabel: "Explore events", ctaUrl: "/tournaments", status: "draft", order: 1 };

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(contentStudioChangeEvent, onStoreChange);
  return () => { window.removeEventListener("storage", onStoreChange); window.removeEventListener(contentStudioChangeEvent, onStoreChange); };
}

export function getContentStudioSnapshot() {
  return window.localStorage.getItem(contentStudioStorageKey) ?? "";
}

export function normalizeContentStudioData(value: ContentStudioData): ContentStudioData {
  return { ...value, articles: value.articles.map((article) => ({ ...article, attachments: article.attachments ?? [] })) };
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ContentStudio() {
  const storedContent = useSyncExternalStore(subscribe, getContentStudioSnapshot, () => "");
  const data = useMemo(() => { try { return storedContent ? normalizeContentStudioData(JSON.parse(storedContent) as ContentStudioData) : defaultContentStudioData; } catch { return defaultContentStudioData; } }, [storedContent]);
  const [slides, setSlides] = useState<HomepageSlide[]>([]);
  const [article, setArticle] = useState<ContentArticle>();
  const [slide, setSlide] = useState<HomepageSlide>();
  const [slideBusy, setSlideBusy] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const loadSlides = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/admin/content/slides", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "Unable to load homepage slides.");
      setSlides((body.data.slides as ApiSlide[]).map(slideFromApi));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load homepage slides.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/v1/admin/content/slides", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail ?? "Unable to load homepage slides.");
        if (!cancelled) setSlides((body.data.slides as ApiSlide[]).map(slideFromApi));
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load homepage slides.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function persist(nextData: ContentStudioData) {
    window.localStorage.setItem(contentStudioStorageKey, JSON.stringify(nextData));
    window.dispatchEvent(new Event(contentStudioChangeEvent));
  }

  function saveArticle(status: ContentArticle["status"]) {
    if (!article?.title.trim() || !article.body.trim()) { setError("Article title and body are required."); return; }
    const slug = slugify(article.slug || article.title);
    const saved = { ...article, id: article.id || crypto.randomUUID(), slug, status, updatedAt: new Date().toISOString().slice(0, 10) };
    persist({ ...data, articles: data.articles.some((item) => item.id === saved.id) ? data.articles.map((item) => item.id === saved.id ? saved : item) : [...data.articles, saved] });
    setArticle(undefined); setError("");
  }

  async function saveSlide(status: HomepageSlide["status"]) {
    if (!slide?.title.trim() || !slide.imageUrl || !slide.imageAlt.trim()) { setError("Slide title, image, and image alt text are required."); return; }
    setSlideBusy(true);
    setError("");
    try {
      const response = await fetch(slide.id ? `/api/v1/admin/content/slides/${slide.id}` : "/api/v1/admin/content/slides", {
        method: slide.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(slideToApi(slide, status)),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "Unable to save the slide.");
      setSlide(undefined);
      await loadSlides();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the slide.");
    } finally {
      setSlideBusy(false);
    }
  }

  function deleteArticle(item: ContentArticle) {
    if (window.confirm(`Delete ${item.title}?`)) persist({ ...data, articles: data.articles.filter((articleItem) => articleItem.id !== item.id) });
  }

  async function deleteSlide(item: HomepageSlide) {
    if (!window.confirm(`Delete slider image ${item.title}?`)) return;
    setSlideBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/content/slides/${item.id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { detail?: string }).detail ?? "Unable to delete the slide.");
      }
      await loadSlides();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete the slide.");
    } finally {
      setSlideBusy(false);
    }
  }

  async function toggleSlidePublished(item: HomepageSlide) {
    setSlideBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/content/slides/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ published: item.status !== "published" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "Unable to update the slide.");
      await loadSlides();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update the slide.");
    } finally {
      setSlideBusy(false);
    }
  }

  function wrapSelection(prefix: string, suffix = prefix) {
    if (!article) return;
    const textarea = bodyRef.current;
    const start = textarea?.selectionStart ?? article.body.length;
    const end = textarea?.selectionEnd ?? article.body.length;
    setArticle({ ...article, body: `${article.body.slice(0, start)}${prefix}${article.body.slice(start, end)}${suffix}${article.body.slice(end)}` });
  }

  return (
    <main className="admin-content">
      <div className="section-header"><div><h1 className="admin-heading">Content studio</h1><p className="admin-subtitle">Draft, review, and publish website content and homepage slider images.</p></div><div className="header-actions"><button className="button button-secondary" type="button" onClick={() => { setArticle({ ...emptyArticle }); setSlide(undefined); setError(""); }}><Plus size={15} /> New article</button><button className="button button-primary" type="button" onClick={() => { setSlide({ ...emptySlide, order: slides.length + 1 }); setArticle(undefined); setError(""); }}><ImagePlus size={15} /> Add slider image</button></div></div>
      {error && <p className="form-message form-error" role="alert">{error}</p>}

      {article && <section className="card panel entity-editor"><div className="section-header stage-header"><div><div className="eyebrow">Article editor</div><h2>{article.id ? "Edit article" : "Create article"}</h2></div><button className="button button-secondary button-small" type="button" onClick={() => setArticle(undefined)}><X size={14} /> Close</button></div><div className="builder-grid"><label className="form-group"><span className="form-label">Title</span><input className="input" value={article.title} onChange={(event) => setArticle({ ...article, title: event.target.value, slug: article.id ? article.slug : slugify(event.target.value) })} /></label><label className="form-group"><span className="form-label">Slug</span><input className="input" value={article.slug} onChange={(event) => setArticle({ ...article, slug: event.target.value })} /></label></div><label className="form-group" style={{ marginTop: 16 }}><span className="form-label">Excerpt</span><textarea className="textarea content-excerpt" value={article.excerpt} onChange={(event) => setArticle({ ...article, excerpt: event.target.value })} /></label><div className="editor-toolbar" role="toolbar" aria-label="Article formatting"><button type="button" aria-label="Bold" onClick={() => wrapSelection("**")}><Bold size={15} /></button><button type="button" aria-label="Italic" onClick={() => wrapSelection("_")}><Italic size={15} /></button><button type="button" aria-label="Heading" onClick={() => wrapSelection("## ", "")}><Heading2 size={15} /></button><button type="button" aria-label="Bulleted list" onClick={() => wrapSelection("- ", "")}><List size={15} /></button><button type="button" aria-label="Link" onClick={() => wrapSelection("[", "](https://)")}><Link2 size={15} /></button></div><label className="form-group"><span className="form-label">Body</span><textarea ref={bodyRef} className="textarea content-body-editor" value={article.body} onChange={(event) => setArticle({ ...article, body: event.target.value })} /></label><div className="content-attachments"><MediaUploadField purpose="attachment" label="Article attachments" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onUploaded={(media) => setArticle((current) => current ? { ...current, attachments: [...current.attachments, { key: media.key, url: media.url, name: media.originalName, mimeType: media.mimeType, sizeBytes: media.sizeBytes }] } : current)} onError={setError} />{article.attachments.map((attachment) => <div className="attachment-row" key={attachment.key}><FileText size={15} /><a href={attachment.url} target="_blank" rel="noreferrer">{attachment.name}</a><button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => setArticle({ ...article, attachments: article.attachments.filter((item) => item.key !== attachment.key) })}><X size={14} /></button></div>)}</div><div className="header-actions" style={{ marginTop: 20 }}><button className="button button-secondary" type="button" onClick={() => saveArticle("draft")}><Save size={15} /> Save draft</button><button className="button button-primary" type="button" onClick={() => saveArticle("published")}><Send size={15} /> Publish article</button></div></section>}

      {slide && <section className="card panel entity-editor"><div className="section-header stage-header"><div><div className="eyebrow">Homepage slider</div><h2>{slide.id ? "Edit slider image" : "Add slider image"}</h2></div><button className="button button-secondary button-small" type="button" onClick={() => setSlide(undefined)}><X size={14} /> Close</button></div><div className="builder-grid"><label className="form-group"><span className="form-label">Eyebrow</span><input className="input" value={slide.eyebrow} onChange={(event) => setSlide({ ...slide, eyebrow: event.target.value })} /></label><label className="form-group"><span className="form-label">Slide title</span><input className="input" value={slide.title} onChange={(event) => setSlide({ ...slide, title: event.target.value })} /></label></div><label className="form-group" style={{ marginTop: 16 }}><span className="form-label">Summary</span><textarea className="textarea content-excerpt" value={slide.summary} onChange={(event) => setSlide({ ...slide, summary: event.target.value })} /></label><div className="builder-grid" style={{ marginTop: 16 }}><MediaUploadField purpose="slider" label="Upload slider image" accept="image/png,image/jpeg,image/webp,image/gif" altText={slide.imageAlt} onUploaded={(media) => setSlide((current) => current ? { ...current, imageUrl: media.url } : current)} onError={setError} /><label className="form-group"><span className="form-label">Or image URL</span><input className="input" value={slide.imageUrl} onChange={(event) => setSlide({ ...slide, imageUrl: event.target.value })} /></label><label className="form-group"><span className="form-label">Image alt text</span><input className="input" value={slide.imageAlt} onChange={(event) => setSlide({ ...slide, imageAlt: event.target.value })} /></label><label className="form-group"><span className="form-label">Display order</span><input className="input" type="number" min="1" value={slide.order} onChange={(event) => setSlide({ ...slide, order: Number(event.target.value) })} /></label><label className="form-group"><span className="form-label">CTA label</span><input className="input" value={slide.ctaLabel} onChange={(event) => setSlide({ ...slide, ctaLabel: event.target.value })} /></label><label className="form-group"><span className="form-label">CTA URL</span><input className="input" value={slide.ctaUrl} onChange={(event) => setSlide({ ...slide, ctaUrl: event.target.value })} /></label></div>{slide.imageUrl && <div className="slide-image-preview" role="img" aria-label={slide.imageAlt || "Slider image preview"} style={{ backgroundImage: `linear-gradient(90deg, rgba(7,20,14,.78), rgba(7,20,14,.08)), url("${slide.imageUrl}")` }}><div><span className="eyebrow">{slide.eyebrow}</span><h3>{slide.title || "Slide title"}</h3><p>{slide.summary}</p></div></div>}<div className="header-actions" style={{ marginTop: 20 }}><button className="button button-secondary" type="button" disabled={slideBusy} onClick={() => saveSlide("draft")}><Save size={15} /> Save draft</button><button className="button button-primary" type="button" disabled={slideBusy} onClick={() => saveSlide("published")}><Send size={15} /> Publish slide</button></div></section>}

      <div className="dashboard-grid content-management-grid"><section className="card panel"><div className="section-header stage-header"><div><h2 className="panel-title">Articles and announcements</h2><p className="helper">Only published content appears on the website.</p></div></div><div className="activity">{data.articles.map((item) => <article className="content-list-item" key={item.id}><div><span className={`status ${item.status === "draft" ? "pending" : ""}`}>{item.status.toUpperCase()}</span><h3>{item.title}</h3><p className="muted">{item.excerpt || "No excerpt"}</p></div><div className="header-actions"><button className="button button-secondary button-small" type="button" onClick={() => { setArticle({ ...item }); setSlide(undefined); }}><Pencil size={14} /> Edit</button><button className="button button-secondary button-small" type="button" onClick={() => persist({ ...data, articles: data.articles.map((articleItem) => articleItem.id === item.id ? { ...articleItem, status: articleItem.status === "published" ? "draft" : "published" } : articleItem) })}>{item.status === "published" ? <><Eye size={14} /> Unpublish</> : <><Send size={14} /> Publish</>}</button><button className="button button-secondary button-small" type="button" onClick={() => deleteArticle(item)}><Trash2 size={14} /></button></div></article>)}</div></section><section className="card panel"><div className="section-header stage-header"><div><h2 className="panel-title">Homepage slides</h2><p className="helper">Published slides are ordered automatically on the homepage.</p></div></div><div className="activity">{[...slides].sort((a, b) => a.order - b.order).map((item) => <article className="content-list-item" key={item.id}><div className="slide-thumbnail" role="img" aria-label={item.imageAlt} style={{ backgroundImage: `url("${item.imageUrl}")` }} /><div><span className={`status ${item.status === "draft" ? "pending" : ""}`}>{item.status.toUpperCase()}</span><h3>{item.title}</h3><p className="muted">Position {item.order} · {item.imageAlt || "Missing alt text"}</p><div className="header-actions"><button className="button button-secondary button-small" type="button" disabled={slideBusy} onClick={() => { setSlide({ ...item }); setArticle(undefined); }}><Pencil size={14} /> Edit</button><button className="button button-secondary button-small" type="button" disabled={slideBusy} onClick={() => toggleSlidePublished(item)}>{item.status === "published" ? "Unpublish" : "Publish"}</button><button className="button button-secondary button-small" type="button" disabled={slideBusy} onClick={() => deleteSlide(item)}><Trash2 size={14} /></button></div></div></article>)}</div></section></div>
    </main>
  );
}
