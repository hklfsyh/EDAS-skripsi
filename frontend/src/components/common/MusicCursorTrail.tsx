"use client";

import { useEffect, useRef } from "react";

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  born: number;
  type: "dot" | "ring" | "note" | "spark";
  color: string;
  size: number;
  char?: string;
};

const COLORS_DARK = [
  "#1ed760", "#ff2d78", "#00c3ff", "#9747ff",
  "#ffb800", "#b5ff2d", "#ff5f5f", "#ff6b35",
];

const COLORS_LIGHT = [
  "#6FA37B", "#8D7AAE", "#C9A56A", "#D8A0A8",
  "#8FAFD1", "#6FA37B", "#C9A56A", "#8D7AAE",
];

const NOTES = ["♪", "♫", "♩", "♬", "🎵", "🎶"];

let nextId = 0;

function getColors(): string[] {
  if (typeof window === "undefined") return COLORS_DARK;
  return document.documentElement.dataset.theme === "light" ? COLORS_LIGHT : COLORS_DARK;
}

export function MusicCursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const pointer = useRef({ x: -999, y: -999, px: -999, py: -999, speed: 0 });
  const raf = useRef<number>(0);
  const isDrawing = useRef(false);
  const lastSpawnAt = useRef(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const prefersCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const isLowPowerMode = prefersReducedMotion || prefersCoarsePointer;
    const maxParticles = prefersCoarsePointer ? 36 : 96;

    let dot: HTMLDivElement | null = null;
    if (!prefersCoarsePointer) {
      dot = document.createElement("div");
      dot.id = "custom-cursor-dot";
      const isDarkMode = document.documentElement.dataset.theme !== "light";
      const dotColor = isDarkMode ? "#1ed760" : "#6FA37B";
      dot.style.cssText = [
        "position:fixed",
        "top:0",
        "left:0",
        "width:10px",
        "height:10px",
        "border-radius:50%",
        `background:${dotColor}`,
        `box-shadow:0 0 12px 3px ${isDarkMode ? "rgba(30,215,96,.55)" : "rgba(111,163,123,.35)"}`,
        "pointer-events:none",
        "z-index:99999",
        "transform:translate(-50%,-50%)",
        "will-change:transform",
      ].join(";") + ";";
      document.body.appendChild(dot);
    }

    const updateDot = (mx: number, my: number) => {
      if (!dot) return;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    };

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const renderingContext = ctx;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawnParticles = (x: number, y: number, speed: number, burst = false) => {
      const now = performance.now();
      const minGap = prefersCoarsePointer ? 150 : 24;
      if (!burst && now - lastSpawnAt.current < minGap) return;
      lastSpawnAt.current = now;

      const color = getColors()[Math.floor(Math.random() * getColors().length)];
      const dotSize = prefersCoarsePointer ? 3 : 3.8;
      const dotLife = prefersCoarsePointer ? 260 : 360;

      particles.current.push({
        id: nextId++,
        x,
        y,
        vx: (Math.random() - 0.5) * (prefersCoarsePointer ? 0.75 : 1.1),
        vy: (Math.random() - 0.5) * (prefersCoarsePointer ? 0.75 : 1.1),
        life: 1,
        maxLife: dotLife + Math.random() * 120,
        born: now,
        type: "dot",
        color,
        size: dotSize + Math.random() * (prefersCoarsePointer ? 1.6 : 2.8),
      });

      if (prefersReducedMotion) {
        particles.current = particles.current.slice(-maxParticles);
        return;
      }

      if (speed > 18 && Math.random() < (prefersCoarsePointer ? 0.18 : 0.26)) {
        particles.current.push({
          id: nextId++,
          x,
          y,
          vx: 0,
          vy: 0,
          life: 1,
          maxLife: 280 + Math.random() * 100,
          born: now,
          type: "ring",
          color,
          size: prefersCoarsePointer ? 5 : 7,
        });
      }

      if (!isLowPowerMode && speed > 10 && Math.random() < 0.18) {
        particles.current.push({
          id: nextId++,
          x: x + (Math.random() - 0.5) * 18,
          y: y + (Math.random() - 0.5) * 18,
          vx: (Math.random() - 0.5) * 2.1,
          vy: -1.1 - Math.random() * 1.5,
          life: 1,
          maxLife: 420 + Math.random() * 180,
          born: now,
          type: "note",
          color,
          size: 11 + Math.random() * 4,
          char: NOTES[Math.floor(Math.random() * NOTES.length)],
        });
      }

      if (!isLowPowerMode && burst) {
        const sparkCount = 2;
        for (let index = 0; index < sparkCount; index++) {
          const angle = Math.random() * Math.PI * 2;
          const magnitude = 2 + Math.random() * 2.8;
          particles.current.push({
            id: nextId++,
            x,
            y,
            vx: Math.cos(angle) * magnitude,
            vy: Math.sin(angle) * magnitude,
            life: 1,
            maxLife: 180 + Math.random() * 80,
            born: now,
            type: "spark",
            color,
            size: 1.8 + Math.random() * 1.2,
          });
        }
      }

      if (particles.current.length > maxParticles) {
        particles.current = particles.current.slice(-maxParticles);
      }
    };

    const startDraw = () => {
      if (!isDrawing.current) {
        isDrawing.current = true;
        raf.current = requestAnimationFrame(draw);
      }
    };

    const activateTrail = (x: number, y: number, speed?: number, burst = false) => {
      const dx = x - pointer.current.x;
      const dy = y - pointer.current.y;
      pointer.current.speed = speed ?? Math.sqrt(dx * dx + dy * dy);
      pointer.current.px = pointer.current.x;
      pointer.current.py = pointer.current.y;
      pointer.current.x = x;
      pointer.current.y = y;

      updateDot(x, y);
      spawnParticles(x, y, pointer.current.speed, burst);
      startDraw();
    };

    const onMouseMove = (event: MouseEvent) => {
      activateTrail(event.clientX, event.clientY);
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (!touch) return;
      activateTrail(touch.clientX, touch.clientY, 22, true);
    };

    function draw() {
      const now = performance.now();
      renderingContext.clearRect(0, 0, width, height);

      const isLight = document.documentElement.dataset.theme === "light";
      const alphaMultiplier = isLight ? 0.45 : 1;
      const blurMultiplier = isLowPowerMode ? 0 : isLight ? 0.25 : 0.7;

      particles.current = particles.current.filter((particle) => {
        const age = now - particle.born;
        particle.life = 1 - age / particle.maxLife;
        if (particle.life <= 0) return false;

        const alpha = particle.life;

        switch (particle.type) {
          case "dot": {
            particle.vy += 0.035;
            particle.x += particle.vx;
            particle.y += particle.vy;
            renderingContext.save();
            renderingContext.globalAlpha = alpha * 0.82 * alphaMultiplier;
            renderingContext.beginPath();
            renderingContext.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
            renderingContext.fillStyle = particle.color;
            renderingContext.shadowColor = particle.color;
            renderingContext.shadowBlur = 5 * blurMultiplier;
            renderingContext.fill();
            renderingContext.restore();
            break;
          }
          case "ring": {
            const radius = particle.size + (1 - particle.life) * 24;
            renderingContext.save();
            renderingContext.globalAlpha = alpha * 0.62 * alphaMultiplier;
            renderingContext.strokeStyle = particle.color;
            renderingContext.lineWidth = prefersCoarsePointer ? 1.4 : 1.8;
            renderingContext.shadowColor = particle.color;
            renderingContext.shadowBlur = 6 * blurMultiplier;
            renderingContext.beginPath();
            renderingContext.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
            renderingContext.stroke();
            renderingContext.restore();
            break;
          }
          case "note": {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vx *= 0.96;
            renderingContext.save();
            renderingContext.globalAlpha = alpha * alphaMultiplier;
            renderingContext.fillStyle = particle.color;
            renderingContext.font = `${particle.size}px serif`;
            renderingContext.shadowColor = particle.color;
            renderingContext.shadowBlur = 7 * blurMultiplier;
            renderingContext.fillText(particle.char ?? "♪", particle.x, particle.y);
            renderingContext.restore();
            break;
          }
          case "spark": {
            particle.vx *= 0.9;
            particle.vy *= 0.9;
            particle.vy += 0.08;
            particle.x += particle.vx;
            particle.y += particle.vy;
            renderingContext.save();
            renderingContext.globalAlpha = alpha * alphaMultiplier;
            renderingContext.strokeStyle = particle.color;
            renderingContext.lineWidth = particle.size;
            renderingContext.shadowColor = particle.color;
            renderingContext.shadowBlur = 4 * blurMultiplier;
            renderingContext.lineCap = "round";
            renderingContext.beginPath();
            renderingContext.moveTo(particle.x, particle.y);
            renderingContext.lineTo(particle.x - particle.vx * 2, particle.y - particle.vy * 2);
            renderingContext.stroke();
            renderingContext.restore();
            break;
          }
        }

        return true;
      });

      if (particles.current.length > 0) {
        raf.current = requestAnimationFrame(draw);
      } else {
        isDrawing.current = false;
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchstart", onTouchStart, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf.current);
      if (dot?.parentNode) {
        dot.remove();
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9998,
      }}
    />
  );
}
