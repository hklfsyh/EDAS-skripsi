"use client";

import { CSSProperties, useEffect, useRef } from "react";
import styles from "./MusicBackground.module.css";

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

function sr(seed: number, off = 0): number {
  const v = Math.sin(seed * 17.351 + off * 53.179) * 29341.8;
  return v - Math.floor(v);
}

export function MusicBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const focus = useRef({ x: 0.5, y: 0.42 });
  const target = useRef({ x: 0.5, y: 0.42 });
  const raf = useRef<number>(0);
  const startTime = useRef(performance.now());
  const lastTouchAt = useRef(0);

  const isDark =
    typeof window !== "undefined"
      ? document.documentElement.dataset.theme !== "light"
      : true;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-depth]"));
    const prefersCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    startTime.current = performance.now();

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

    const tick = () => {
      const t = (performance.now() - startTime.current) / 1000;
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const scrollRatio = clamp01(window.scrollY / maxScroll);
      const touchIsFresh = performance.now() - lastTouchAt.current < 1800;

      if (prefersCoarsePointer && !touchIsFresh) {
        setTarget(
          0.5 + Math.sin(t * 0.22) * 0.16,
          0.26 + scrollRatio * 0.34 + Math.cos(t * 0.18) * 0.08,
        );
      }

      focus.current.x += (target.current.x - focus.current.x) * 0.06;
      focus.current.y += (target.current.y - focus.current.y) * 0.06;

      const mx = focus.current.x;
      const my = focus.current.y;
      container.style.setProperty("--focus-x", `${(mx * 100).toFixed(2)}%`);
      container.style.setProperty("--focus-y", `${(my * 100).toFixed(2)}%`);

      for (const card of cards) {
        const depth = parseFloat(card.dataset.depth ?? "0.2");
        const off = parseFloat(card.dataset.floatOff ?? "0");
        const dx = (mx - 0.5) * depth * 180;
        const dy = (my - 0.5) * depth * 180;
        const rot = (mx - 0.5) * depth * 14;
        const idleX = Math.sin(t * 0.7 + off) * 22 + Math.sin(t * 1.3 + off * 1.7) * 12 + Math.cos(t * 0.4 + off * 2.3) * 8;
        const idleY = Math.sin(t * 0.9 + off * 1.3) * 18 + Math.cos(t * 1.1 + off * 0.9) * 10 + Math.sin(t * 0.5 + off * 0.5) * 6;
        const idleRot = Math.sin(t * 0.3 + off * 0.7) * 10;
        card.style.transform = `translate3d(${dx + idleX}px, ${dy + idleY}px, 0) rotate(${rot + idleRot}deg)`;
      }

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
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
