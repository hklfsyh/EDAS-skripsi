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

const BLOBS_DARK = [
  { depth: "0.4", bg: "radial-gradient(ellipse 70% 60% at center, rgba(151,71,255,0.34), transparent 65%)", w: "70%", h: "60%", l: "15%", t: "20%" },
  { depth: "0.3", bg: "radial-gradient(ellipse 60% 55% at center, rgba(0,195,255,0.26), transparent 60%)", w: "60%", h: "55%", r: "5%", b: "5%" },
  { depth: "0.25", bg: "radial-gradient(ellipse 50% 50% at center, rgba(255,45,120,0.22), transparent 55%)", w: "50%", h: "50%", l: "30%", t: "40%" },
  { depth: "0.35", bg: "radial-gradient(ellipse 55% 45% at center, rgba(30,215,96,0.18), transparent 55%)", w: "55%", h: "45%", r: "20%", t: "15%" },
];

const BLOBS_LIGHT = [
  { depth: "0.4", bg: "radial-gradient(ellipse 70% 60% at center, rgba(255,138,29,0.26), transparent 65%)", w: "70%", h: "60%", l: "15%", t: "20%" },
  { depth: "0.3", bg: "radial-gradient(ellipse 60% 55% at center, rgba(139,92,246,0.2), transparent 60%)", w: "60%", h: "55%", r: "5%", b: "5%" },
  { depth: "0.25", bg: "radial-gradient(ellipse 50% 50% at center, rgba(255,90,157,0.18), transparent 55%)", w: "50%", h: "50%", l: "30%", t: "40%" },
  { depth: "0.35", bg: "radial-gradient(ellipse 55% 45% at center, rgba(0,166,255,0.2), transparent 55%)", w: "55%", h: "45%", r: "20%", t: "15%" },
];

function sr(seed: number, off = 0): number {
  const v = Math.sin(seed * 17.351 + off * 53.179) * 29341.8;
  return v - Math.floor(v);
}

export function MusicBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const raf = useRef<number>(0);
  const startTime = useRef(performance.now());

  const isDark =
    typeof window !== "undefined"
      ? document.documentElement.dataset.theme !== "light"
      : true;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-depth]"));
    const blobs = Array.from(container.querySelectorAll<HTMLElement>("[data-blob]"));
    startTime.current = performance.now();

    const onMove = (event: MouseEvent) => {
      mouse.current = { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight };
    };

    const tick = () => {
      const mx = mouse.current.x;
      const my = mouse.current.y;
      const t = (performance.now() - startTime.current) / 1000;

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

      for (const blob of blobs) {
        const depth = parseFloat(blob.dataset.blobDepth ?? "1");
        const bx = (0.5 - mx) * depth * 60;
        const by = (0.5 - my) * depth * 60;
        blob.style.transform = `translate3d(${bx}px, ${by}px, 0)`;
      }

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    window.addEventListener("mousemove", onMove);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const albums = isDark ? ALBUMS_DARK : ALBUMS_LIGHT;
  const blobs = isDark ? BLOBS_DARK : BLOBS_LIGHT;

  return (
    <div ref={containerRef} className={styles.root} aria-hidden>
      {blobs.map((blob, index) => (
        <div
          key={index}
          className={styles.blob}
          data-blob
          data-blob-depth={blob.depth}
          style={{
            background: blob.bg,
            width: blob.w,
            height: blob.h,
            left: blob.l,
            top: blob.t,
            right: blob.r,
            bottom: blob.b,
          } as CSSProperties}
        />
      ))}
      <div className={styles.grain} />
      <div className={styles.eqBars}>
        {Array.from({ length: 20 }, (_, index) => (
          <span key={index} className={styles.eqBar} style={{ "--i": index } as CSSProperties} />
        ))}
      </div>
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
