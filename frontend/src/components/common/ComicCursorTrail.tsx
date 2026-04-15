"use client";

import { useEffect, useRef } from "react";
import styles from "./ComicCursorTrail.module.css";

type Star = {
  el: HTMLSpanElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
};

const STAR_CHARS = ["★", "✦", "✧", "⭐", "✵", "✴", "✸", "✹", "✺"];
const TRAIL_COLORS = ["#ffe033", "#ff3c5a", "#3a8fff", "#ff9f3f", "#ffffff", "#ff6dde"];

export function ComicCursorTrail() {
  const containerRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<Star[]>([]);
  const mouseRef = useRef({ x: -999, y: -999 });
  const isMovingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number>(0);
  const idleStarsRef = useRef<Star[]>([]);
  const idleInitRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerEl = container;
    const idleStars = idleStarsRef.current;

    const NUM_IDLE = 22;

    function createStar(x: number, y: number, isIdle = false): Star {
      const el = document.createElement("span");
      el.className = styles.star;
      const char = STAR_CHARS[Math.floor(Math.random() * STAR_CHARS.length)];
      const color = TRAIL_COLORS[Math.floor(Math.random() * TRAIL_COLORS.length)];
      el.textContent = char;
      el.style.color = color;
      el.style.textShadow = `0 0 6px ${color}, 0 0 12px ${color}`;
      containerEl.appendChild(el);

      const size = isIdle ? 10 + Math.random() * 10 : 12 + Math.random() * 14;
      el.style.fontSize = `${size}px`;

      const angle = Math.random() * Math.PI * 2;
      const speed = isIdle ? 0.1 + Math.random() * 0.3 : 2 + Math.random() * 3;

      return {
        el,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: isIdle ? 9999 : 38 + Math.random() * 28,
        size,
      };
    }

    function initIdleStars() {
      if (idleInitRef.current) return;
      idleInitRef.current = true;
      for (let index = 0; index < NUM_IDLE; index++) {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        const star = createStar(x, y, true);
        star.el.style.opacity = String(0.2 + Math.random() * 0.5);
        idleStars.push(star);
      }
    }

    initIdleStars();

    let spawnCount = 0;
    function spawnTrailStar() {
      const star = createStar(mouseRef.current.x, mouseRef.current.y);
      starsRef.current.push(star);
    }

    function onMouseMove(event: MouseEvent) {
      mouseRef.current = { x: event.clientX, y: event.clientY };
      isMovingRef.current = true;

      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      stopTimerRef.current = setTimeout(() => {
        isMovingRef.current = false;
      }, 80);
    }

    window.addEventListener("mousemove", onMouseMove);

    function animate() {
      if (isMovingRef.current) {
        spawnCount++;
        if (spawnCount % 2 === 0) spawnTrailStar();
      }

      starsRef.current = starsRef.current.filter((star) => {
        star.life++;
        star.x += star.vx;
        star.y += star.vy;
        star.vx *= 0.93;
        star.vy *= 0.93;

        const progress = star.life / star.maxLife;
        const opacity =
          progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;

        star.el.style.transform = `translate(${star.x - star.size / 2}px, ${star.y - star.size / 2}px) rotate(${star.life * 4}deg) scale(${1 - progress * 0.5})`;
        star.el.style.opacity = String(Math.max(0, opacity));

        if (star.life >= star.maxLife) {
          star.el.remove();
          return false;
        }
        return true;
      });

      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      idleStars.forEach((star) => {
        if (isMovingRef.current) {
          const dx = mouseX - star.x;
          const dy = mouseY - star.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 220;
          if (dist > 0 && dist < maxDist) {
            const pull = (1 - dist / maxDist) * 0.08;
            star.vx += (dx / dist) * pull * 8;
            star.vy += (dy / dist) * pull * 8;
          }
        } else {
          star.vx *= 0.94;
          star.vy *= 0.94;
          star.vy += Math.sin(Date.now() * 0.001 + star.x) * 0.01;
        }

        star.x += star.vx;
        star.y += star.vy;

        if (star.x < -20) star.x = window.innerWidth + 20;
        if (star.x > window.innerWidth + 20) star.x = -20;
        if (star.y < -20) star.y = window.innerHeight + 20;
        if (star.y > window.innerHeight + 20) star.y = -20;

        const baseOpacity = isMovingRef.current
          ? 0.08
          : 0.2 + 0.3 * Math.abs(Math.sin(Date.now() * 0.001 + star.x * 0.01));
        star.el.style.transform = `translate(${star.x}px, ${star.y}px) rotate(${Date.now() * 0.03}deg)`;
        star.el.style.opacity = String(baseOpacity);
      });

      frameRef.current = requestAnimationFrame(animate);
    }

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(frameRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      const trailStars = starsRef.current;
      trailStars.forEach((star) => star.el.remove());
      idleStars.forEach((star) => star.el.remove());
    };
  }, []);

  return <div ref={containerRef} className={styles.container} aria-hidden />;
}
