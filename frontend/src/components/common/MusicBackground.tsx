"use client";

import { useEffect, useRef, CSSProperties } from "react";
import styles from "./MusicBackground.module.css";

/* ── Album covers — setiap album punya warna unik ──────────────── */
const ALBUMS = [
  // [gradient-from, gradient-to, symbol, depth]
  ["#ff2d78", "#ff6b35", "♪", 0.12],
  ["#9747ff", "#00c3ff", "♫", 0.28],
  ["#1ed760", "#0d9f47", "🎵", 0.18],
  ["#ffb800", "#ff5f5f", "♬", 0.35],
  ["#00c3ff", "#9747ff", "♩", 0.08],
  ["#ff5f5f", "#ff2d78", "🎶", 0.22],
  ["#b5ff2d", "#1ed760", "♪", 0.30],
  ["#ff2d78", "#9747ff", "♫", 0.14],
  ["#00c3ff", "#1ed760", "♬", 0.40],
  ["#ffb800", "#b5ff2d", "♩", 0.20],
  ["#9747ff", "#ff5f5f", "🎵", 0.09],
  ["#1ed760", "#00c3ff", "♪", 0.33],
  ["#ff6b35", "#ffb800", "♫", 0.25],
  ["#ff2d78", "#00c3ff", "🎶", 0.16],
  ["#b5ff2d", "#9747ff", "♬", 0.38],
  ["#ff5f5f", "#ffb800", "♪", 0.11],
  ["#00c3ff", "#ff2d78", "♩", 0.44],
  ["#9747ff", "#1ed760", "♫", 0.27],
] as const;

/* seeded random — konsisten antar render */
function sr(seed: number, off = 0): number {
  const v = Math.sin(seed * 17.351 + off * 53.179) * 29341.8;
  return v - Math.floor(v);
}

type Pos = { x: number; y: number };

export function MusicBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouse = useRef<Pos>({ x: 0.5, y: 0.5 });
  const raf = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      mouse.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };

    const tick = () => {
      const cards = container.querySelectorAll<HTMLElement>("[data-depth]");
      cards.forEach((card) => {
        const depth = parseFloat(card.dataset.depth ?? "0.2");
        const dx = (mouse.current.x - 0.5) * depth * 180;
        const dy = (mouse.current.y - 0.5) * depth * 180;
        const rot = (mouse.current.x - 0.5) * depth * 14;
        card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
      });

      // mesh gradient follows mouse more aggressively
      const mesh = container.querySelector<HTMLElement>("[data-mesh]");
      if (mesh) {
        const px = mouse.current.x * 100;
        const py = mouse.current.y * 100;
        mesh.style.background = `
          radial-gradient(ellipse 60% 55% at ${px}% ${py}%, rgba(151,71,255,0.28), transparent 65%),
          radial-gradient(ellipse 50% 50% at ${100 - px}% ${100 - py}%, rgba(0,195,255,0.22), transparent 60%),
          radial-gradient(ellipse 45% 45% at ${py}% ${px}%, rgba(255,45,120,0.18), transparent 55%),
          radial-gradient(ellipse 55% 40% at ${100-py}% ${100-px}%, rgba(30,215,96,0.15), transparent 60%)
        `;
      }

      raf.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    raf.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.root} aria-hidden>
      {/* mesh gradient layer */}
      <div data-mesh className={styles.mesh} />

      {/* scanline grain */}
      <div className={styles.grain} />

      {/* equalizer bars decoration */}
      <div className={styles.eqBars}>
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className={styles.eqBar} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>

      {/* floating album cards */}
      {ALBUMS.map(([from, to, symbol, depth], i) => {
        const bx = 3 + sr(i, 1) * 92;   // base x %
        const by = 2 + sr(i, 2) * 90;   // base y %
        const size = 52 + sr(i, 3) * 64; // px
        const rot = (sr(i, 4) - 0.5) * 40;

        return (
          <div
            key={i}
            data-depth={depth}
            className={styles.album}
            style={
              {
                left: `${bx}%`,
                top: `${by}%`,
                width: size,
                height: size,
                "--rot": `${rot}deg`,
                "--from": from,
                "--to": to,
                "--delay": `${sr(i, 5) * 6}s`,
                "--duration": `${5 + sr(i, 6) * 7}s`,
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
