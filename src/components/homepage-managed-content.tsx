"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { contentStudioChangeEvent, contentStudioStorageKey, defaultContentStudioData, normalizeContentStudioData, slideFromApi, type ContentStudioData, type HomepageSlide } from "./content-studio";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(contentStudioChangeEvent, onStoreChange);
  return () => { window.removeEventListener("storage", onStoreChange); window.removeEventListener(contentStudioChangeEvent, onStoreChange); };
}

function getSnapshot() {
  return window.localStorage.getItem(contentStudioStorageKey) ?? "";
}

function useManagedContent() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  return useMemo(() => { try { return snapshot ? normalizeContentStudioData(JSON.parse(snapshot) as ContentStudioData) : defaultContentStudioData; } catch { return defaultContentStudioData; } }, [snapshot]);
}

export function HomepageHero() {
  const [publishedSlides, setPublishedSlides] = useState<HomepageSlide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/v1/content/slides", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) return;
        if (!cancelled) setPublishedSlides((body.data.slides as Parameters<typeof slideFromApi>[0][]).map(slideFromApi));
      } catch {
        // The default slide below covers a failed load.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const slides = publishedSlides.sort((a, b) => a.order - b.order);
  const slide = slides[activeIndex % Math.max(1, slides.length)] ?? defaultContentStudioData.slides[0];

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return <section className="hero managed-hero" aria-roledescription="carousel" aria-label="Homepage highlights" aria-live="polite" style={{ backgroundImage: `url("${slide.imageUrl}")` }}><span className="sr-only">Slide image: {slide.imageAlt}</span><div className="container hero-copy"><div><span className="eyebrow">{slide.eyebrow}</span><span className="live-pill"><span className="live-dot" /> Published from content studio</span></div><h1 className="display">{slide.title}</h1><p className="lede">{slide.summary}</p><div className="hero-actions"><Link className="button button-primary" href={slide.ctaUrl || "/tournaments"}>{slide.ctaLabel || "Explore events"} <ArrowRight size={17} /></Link><Link className="button button-secondary" href="/tournaments"><Play size={16} /> All competitions</Link></div>{slides.length > 1 && <div className="slider-controls"><button type="button" aria-label="Previous slide" onClick={() => setActiveIndex((index) => (index - 1 + slides.length) % slides.length)}><ArrowLeft size={17} /></button><span>{activeIndex % slides.length + 1} / {slides.length}</span><div className="slider-dots">{slides.map((item, index) => <button type="button" className={index === activeIndex % slides.length ? "active" : ""} aria-label={`Show slide ${index + 1}: ${item.title}`} aria-current={index === activeIndex % slides.length ? "true" : undefined} onClick={() => setActiveIndex(index)} key={item.id} />)}</div><button type="button" aria-label="Next slide" onClick={() => setActiveIndex((index) => (index + 1) % slides.length)}><ArrowRight size={17} /></button></div>}</div></section>;
}

export function PublishedContentSection() {
  const data = useManagedContent();
  const articles = data.articles.filter((article) => article.status === "published");
  if (articles.length === 0) return null;
  return <section className="section"><div className="container"><div className="section-header"><div><div className="eyebrow">Latest from the arena</div><h2 className="section-title">News and announcements</h2></div></div><div className="game-grid">{articles.map((article) => <article className="card panel managed-article" key={article.id}><span className="status">PUBLISHED</span><h3>{article.title}</h3><p className="muted">{article.excerpt}</p><div className="managed-article-body">{article.body.replace(/^#+\s*/gm, "").split("\n").filter(Boolean).slice(0, 3).map((line, index) => <p key={index}>{line.replaceAll("**", "").replaceAll("_", "")}</p>)}</div>{article.attachments.length > 0 && <div className="published-attachments">{article.attachments.map((attachment) => <a className="text-link" href={attachment.url} target="_blank" rel="noreferrer" key={attachment.key}>Download {attachment.name}</a>)}</div>}</article>)}</div></div></section>;
}
