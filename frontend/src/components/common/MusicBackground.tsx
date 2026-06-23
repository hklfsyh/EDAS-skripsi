"use client";

import { CSSProperties, useEffect, useRef } from "react";
import styles from "./MusicBackground.module.css";

// data floating card buat mode dark
const ALBUMS_DARK = [
  ["#ff2d78", "#ff6b35", "♪", 0.12],
  ["#9747ff", "#00c3ff", "♫", 0.28],
  ["#1ed760", "#0d9f47", "🎵", 0.18],
  ["#ffb800", "#ff5f5f", "♬", 0.35],
  ["#00c3ff", "#9747ff", "♩", 0.08],
  ["#ff5f5f", "#ff2d78", "🎶", 0.22],
  ["#b5ff2d", "#1ed760", "♪", 0.3],
  ["#ff2d78", "#9747ff", "♫", 0.14],
  ["#00c3ff", "#1ed760", "♬", 0.4],
  ["#ffb800", "#b5ff2d", "♩", 0.2],
  ["#9747ff", "#ff5f5f", "🎵", 0.09],
  ["#1ed760", "#00c3ff", "♪", 0.33],
] as const;

const ALBUMS_LIGHT = [
  ["#ff8a1d", "#ff4f81", "♪", 0.08],
  ["#00a6ff", "#8b5cf6", "♫", 0.12],
  ["#15c96f", "#00b8ff", "🎵", 0.1],
  ["#ffb300", "#ff6a47", "♬", 0.14],
  ["#8b5cf6", "#00a6ff", "♩", 0.08],
  ["#ff5a9d", "#ff8a1d", "🎶", 0.11],
  ["#00b8ff", "#15c96f", "♪", 0.12],
  ["#ff8a1d", "#8b5cf6", "♫", 0.09],
  ["#00a6ff", "#ffb300", "♬", 0.13],
  ["#ff4f81", "#00b8ff", "♩", 0.1],
  ["#15c96f", "#ff8a1d", "🎵", 0.08],
  ["#8b5cf6", "#ff5a9d", "♪", 0.12],
] as const;

// random number generator buat posisi album
function sr(seed: number, off = 0): number {
  const v = Math.sin(seed * 17.351 + off * 53.179) * 29341.8;
  return v - Math.floor(v);
}

// latar animasi pake floating card + gradient + grain
export function MusicBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const focus = useRef({ x: 0.5, y: 0.42 });
  const target = useRef({ x: 0.5, y: 0.42 });
  const raf = useRef<number>(0);
  const startTime = useRef(performance.now());
  const lastTouchAt = useRef(0);
  const scrollRatioRef = useRef(0);
  const lastFrameRef = useRef(0);

  const isDark =
    typeof window !== "undefined"
      ? document.documentElement.dataset.theme !== "light"
      : true;

  // atur parallax + animasi idle pake requestanimationframe
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const allCards = Array.from(container.querySelectorAll<HTMLElement>("[data-depth]"));
    const prefersCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = prefersCoarsePointer ? allCards.filter((_, index) => index % 2 === 0) : allCards;
    startTime.current = performance.now();
    lastFrameRef.current = performance.now();

    const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

    const setTarget = (x: number, y: number, fromTouch = false) => {
      target.current = { x: clamp01(x), y: clamp01(y) };
      if (fromTouch) {
        lastTouchAt.current = performance.now();
      }
    };

    const onMove = (event: MouseEvent) => {
      setTarget(event.clientX / window.innerWidth, event.clientY / window.innerHeight);
    };

    const onTouch = (event: TouchEvent) => {
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (!touch) return;
      setTarget(touch.clientX / window.innerWidth, touch.clientY / window.innerHeight, true);
    };

    const updateScrollRatio = () => {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      scrollRatioRef.current = clamp01(window.scrollY / maxScroll);
    };
    updateScrollRatio();

    const tick = () => {
      const now = performance.now();
      const minFrameGap = prefersReducedMotion ? 48 : prefersCoarsePointer ? 40 : 28;
      if (now - lastFrameRef.current < minFrameGap) {
        raf.current = requestAnimationFrame(tick);
        return;
      }

      lastFrameRef.current = now;
      const t = (now - startTime.current) / 1000;
      const scrollRatio = scrollRatioRef.current;
      const touchIsFresh = performance.now() - lastTouchAt.current < 1800;

      if (prefersCoarsePointer && !touchIsFresh) {
        setTarget(
          0.5 + Math.sin(t * 0.16) * 0.1,
          0.3 + scrollRatio * 0.22 + Math.cos(t * 0.15) * 0.04,
        );
      }

      const easing = prefersCoarsePointer ? 0.035 : 0.055;
      focus.current.x += (target.current.x - focus.current.x) * easing;
      focus.current.y += (target.current.y - focus.current.y) * easing;

      const mx = focus.current.x;
      const my = focus.current.y;
      container.style.setProperty("--focus-x", `${(mx * 100).toFixed(2)}%`);
      container.style.setProperty("--focus-y", `${(my * 100).toFixed(2)}%`);

      // ngeanimasi tiap floating card (parallax + idle float)
      for (const card of cards) {
        const depth = parseFloat(card.dataset.depth ?? "0.2");
        const off = parseFloat(card.dataset.floatOff ?? "0");
        const dx = (mx - 0.5) * depth * (prefersCoarsePointer ? 72 : 128);
        const dy = (my - 0.5) * depth * (prefersCoarsePointer ? 68 : 120);
        const rot = (mx - 0.5) * depth * (prefersCoarsePointer ? 6 : 10);
        const idleX = Math.sin(t * 0.58 + off) * 14 + Math.sin(t * 1.04 + off * 1.7) * 7;
        const idleY = Math.sin(t * 0.74 + off * 1.3) * 12 + Math.cos(t * 0.92 + off * 0.9) * 6;
        const idleRot = Math.sin(t * 0.24 + off * 0.7) * (prefersCoarsePointer ? 4 : 7);
        card.style.transform = `translate3d(${dx + idleX}px, ${dy + idleY}px, 0) rotate(${rot + idleRot}deg)`;
      }

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("scroll", updateScrollRatio, { passive: true });
    window.addEventListener("resize", updateScrollRatio);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("scroll", updateScrollRatio);
      window.removeEventListener("resize", updateScrollRatio);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const albums = isDark ? ALBUMS_DARK : ALBUMS_LIGHT;
  return (
    <div ref={containerRef} className={styles.root} aria-hidden>
      <div className={styles.gradientWash} />
      <div className={styles.spotlight} />
      <div className={styles.edgeGlow} />
      <div className={styles.grain} />
      {albums.map(([from, to, symbol, depth], index) => {
        const bx = 3 + sr(index, 1) * 92;
        const by = 2 + sr(index, 2) * 90;
        const size = 52 + sr(index, 3) * 64;
        const floatOff = sr(index, 7) * Math.PI * 2;

        return (
          <div
            key={index}
            data-depth={depth}
            data-float-off={floatOff}
            className={styles.album}
            style={
              {
                left: `${bx}%`,
                top: `${by}%`,
                width: size,
                height: size,
                background: `linear-gradient(135deg, ${from}, ${to})`,
              } as CSSProperties
            }
          >
            <span className={styles.albumSymbol}>{symbol}</span>
          </div>
        );
      })}
    </div>
  );
}
