"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Pause, Play, Swords } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { arenaHighlights } from "@/lib/game-art";
import { slideFromApi, type HomepageSlide } from "@/lib/content-studio-data";

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  media?.addEventListener("change", callback);
  return () => media?.removeEventListener("change", callback);
}
function motionSnapshot() { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; }

export function HomepageHero() {
  const [publishedSlides, setPublishedSlides] = useState<HomepageSlide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, () => true);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/content/slides", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const body = await response.json();
        if (Array.isArray(body.data?.slides)) setPublishedSlides(body.data.slides.map(slideFromApi).filter((item: HomepageSlide) => item.status === "published"));
      }).catch(() => { /* Local highlights remain available when content is offline. */ });
    return () => controller.abort();
  }, []);

  const slides = useMemo(() => publishedSlides.length ? [...publishedSlides].sort((a, b) => a.order - b.order) : arenaHighlights, [publishedSlides]);
  const index = activeIndex % slides.length;
  const slide = slides[index];
  const playing = !paused && !hovered && !focused && !reducedMotion;
  const move = (direction: number) => setActiveIndex((current) => (current + direction + slides.length) % slides.length);

  useEffect(() => {
    if (slides.length < 2 || !playing) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActiveIndex((current) => (current + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [slides.length, playing]);

  return <section className="arena-hero" aria-roledescription="carousel" aria-label="Arena highlights"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } }}
    onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
    onTouchEnd={(event) => { if (touchStart.current !== null) { const distance = touchStart.current - event.changedTouches[0].clientX; if (Math.abs(distance) > 50) move(distance > 0 ? 1 : -1); touchStart.current = null; } }}>
    <div className="arena-hero-art" key={slide.id} style={{ backgroundImage: `url("${slide.imageUrl || '/images/games/street-fighter-6-hero.jpg'}")` }} />
    <div className="container arena-hero-inner">
      <div className="arena-hero-copy" aria-live={playing ? "off" : "polite"} aria-atomic="true" role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}`}>
        <span className="sr-only">{slide.imageAlt}</span>
        <div className="arena-tag"><Swords size={14} /> THE FIGHTING GAME COMMUNITY</div>
        <p className="hero-kicker">{slide.eyebrow}</p>
        <h1>{slide.title}</h1>
        <p className="lede">{slide.summary}</p>
        <div className="hero-actions"><Link className="button button-primary" href={slide.ctaUrl || "/tournaments"}>{slide.ctaLabel || "Explore tournaments"}<ArrowRight size={17} /></Link><Link className="button arena-secondary" href="/games">Browse games</Link></div>
        <div className="hero-note"><span /> Your game. Your community. Your arena.</div>
      </div>
      <div className="arena-hero-bottom"><span className="hero-caption">LEVEL UP YOUR COMPETITIVE JOURNEY</span>
        {slides.length > 1 && <div className="slider-controls">
          <button type="button" aria-label="Previous slide" onClick={() => move(-1)}><ArrowLeft size={17} /></button>
          <span className="slide-count">{String(index + 1).padStart(2, "0")} <span>/ {String(slides.length).padStart(2, "0")}</span></span>
          <div className="slider-dots">{slides.map((item, slideIndex) => <button type="button" className={slideIndex === index ? "active" : ""} aria-label={`Show slide ${slideIndex + 1}: ${item.title}`} aria-current={slideIndex === index ? "true" : undefined} onClick={() => setActiveIndex(slideIndex)} key={item.id} />)}</div>
          <button type="button" aria-label="Next slide" onClick={() => move(1)}><ArrowRight size={17} /></button>
          {!reducedMotion && <button type="button" aria-label={paused ? "Play slideshow" : "Pause slideshow"} onClick={() => setPaused(!paused)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>}
        </div>}
      </div>
    </div>
  </section>;
}
