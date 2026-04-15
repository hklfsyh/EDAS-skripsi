"use client";

import { useEffect, useRef } from "react";

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;       // 0..1
  maxLife: number;    // ms
  born: number;       // timestamp
  type: "dot" | "ring" | "note" | "spark";
  color: string;
  size: number;
  char?: string;
};

const COLORS = [
  "#1ed760", "#ff2d78", "#00c3ff", "#9747ff",
  "#ffb800", "#b5ff2d", "#ff5f5f", "#ff6b35",
];

const NOTES = ["♪", "♫", "♩", "♬", "🎵", "🎶"];

let nextId = 0;

export function MusicCursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const mouse = useRef({ x: -999, y: -999, px: -999, py: -999, speed: 0 });
  const raf = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = window.innerWidth, H = window.innerHeight;

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
    };
    resize();
    window.addEventListener("resize", resize);

    /* cursor dot element */
    const dot = document.createElement("div");
    dot.style.cssText = `
      position:fixed;top:0;left:0;width:10px;height:10px;
      border-radius:50%;background:#1ed760;
      box-shadow:0 0 14px 4px rgba(30,215,96,.7);
      pointer-events:none;z-index:99999;
      transition:background 0.15s,box-shadow 0.15s;
      transform:translate(-50%,-50%);
    `;
    document.body.appendChild(dot);

    const onMove = (e: MouseEvent) => {
      const mx = e.clientX, my = e.clientY;
      const dx = mx - mouse.current.x, dy = my - mouse.current.y;
      mouse.current.speed = Math.sqrt(dx * dx + dy * dy);
      mouse.current.px = mouse.current.x;
      mouse.current.py = mouse.current.y;
      mouse.current.x = mx; mouse.current.y = my;

      dot.style.left = mx + "px";
      dot.style.top = my + "px";

      spawnParticles(mx, my, mouse.current.speed);
    };

    function spawnParticles(x: number, y: number, speed: number) {
      const now = performance.now();
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];

      // always spawn a trailing dot
      particles.current.push({
        id: nextId++, x, y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        life: 1, maxLife: 380 + Math.random() * 200, born: now,
        type: "dot", color, size: 4 + Math.random() * 4,
      });

      // medium speed → note
      if (speed > 8 && Math.random() < 0.35) {
        particles.current.push({
          id: nextId++, x: x + (Math.random()-0.5)*24, y: y + (Math.random()-0.5)*24,
          vx: (Math.random()-0.5) * 3,
          vy: -1.5 - Math.random() * 2.5,
          life: 1, maxLife: 700 + Math.random()*400, born: now,
          type: "note", color, size: 14 + Math.random() * 8,
          char: NOTES[Math.floor(Math.random() * NOTES.length)],
        });
      }

      // fast → expanding ring
      if (speed > 18 && Math.random() < 0.4) {
        particles.current.push({
          id: nextId++, x, y,
          vx: 0, vy: 0,
          life: 1, maxLife: 450 + Math.random()*150, born: now,
          type: "ring", color, size: 8,
        });
      }

      // very fast → sparks
      if (speed > 30) {
        const count = 2 + Math.floor(speed / 18);
        for (let k = 0; k < count; k++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 3 + Math.random() * 6;
          particles.current.push({
            id: nextId++, x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 1, maxLife: 300 + Math.random()*200, born: now,
            type: "spark", color, size: 2 + Math.random() * 3,
          });
        }
      }

      // keep array sane
      if (particles.current.length > 300) {
        particles.current = particles.current.slice(-300);
      }
    }

    function draw() {
      const now = performance.now();
      ctx.clearRect(0, 0, W, H);

      particles.current = particles.current.filter((p) => {
        const age = now - p.born;
        p.life = 1 - age / p.maxLife;
        if (p.life <= 0) return false;

        const alpha = p.life;

        switch (p.type) {
          case "dot": {
            // slight gravity
            p.vy += 0.04;
            p.x += p.vx; p.y += p.vy;
            ctx.save();
            ctx.globalAlpha = alpha * 0.9;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.restore();
            break;
          }
          case "ring": {
            const r = p.size + (1 - p.life) * 38;
            ctx.save();
            ctx.globalAlpha = alpha * 0.7;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case "note": {
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.97;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.font = `${p.size}px serif`;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 14;
            ctx.fillText(p.char ?? "♪", p.x, p.y);
            ctx.restore();
            break;
          }
          case "spark": {
            p.vx *= 0.93; p.vy *= 0.93;
            p.vy += 0.15;
            p.x += p.vx; p.y += p.vy;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
            ctx.stroke();
            ctx.restore();
            break;
          }
        }

        return true;
      });

      raf.current = requestAnimationFrame(draw);
    }

    window.addEventListener("mousemove", onMove);
    raf.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf.current);
      dot.remove();
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
