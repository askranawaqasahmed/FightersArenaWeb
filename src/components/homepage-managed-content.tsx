"use client";

export { HomepageHero } from "./homepage-hero";

import { useMemo, useSyncExternalStore } from "react";
import { contentStudioChangeEvent, contentStudioStorageKey, defaultContentStudioData, normalizeContentStudioData, type ContentStudioData } from "@/lib/content-studio-data";

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

export function PublishedContentSection() {
  const data = useManagedContent();
  const articles = data.articles.filter((article) => article.status === "published");
  if (articles.length === 0) return null;
  return <section className="section"><div className="container"><div className="section-header"><div><div className="eyebrow">Latest from the arena</div><h2 className="section-title">News and announcements</h2></div></div><div className="game-grid">{articles.map((article) => <article className="card panel managed-article" key={article.id}><span className="status">PUBLISHED</span><h3>{article.title}</h3><p className="muted">{article.excerpt}</p><div className="managed-article-body">{article.body.replace(/^#+\s*/gm, "").split("\n").filter(Boolean).slice(0, 3).map((line, index) => <p key={index}>{line.replaceAll("**", "").replaceAll("_", "")}</p>)}</div>{article.attachments.length > 0 && <div className="published-attachments">{article.attachments.map((attachment) => <a className="text-link" href={attachment.url} target="_blank" rel="noreferrer" key={attachment.key}>Download {attachment.name}</a>)}</div>}</article>)}</div></div></section>;
}
