"use client";

// CSSProperties — untuk CSS custom properties pada elemen bintang
import { CSSProperties, useMemo } from "react";

import styles from "./ComicStarField.module.css";

// TrailPoint — titik posisi swarm dalam persen
type TrailPoint = {
  xPct: number;
  yPct: number;
};

// StarSwarmState — state swarm bintang (trail + status aktif)
type StarSwarmState = {
  trail: TrailPoint[];
  active: boolean;
};

// ComicStarFieldProps — props komponen (swarm state + jumlah bintang)
type ComicStarFieldProps = {
  swarm: StarSwarmState;
  count?: number;
};

// StarConfig — konfigurasi per-bintang (posisi, ukuran, animasi, jitter)
type StarConfig = {
  id: number;
  baseX: number;
  baseY: number;
  size: number;
  twinkleDuration: number;
  twinkleDelay: number;
  trailIndex: number;
  jitterX: number;
  jitterY: number;
};

// seededValue — PRNG sederhana untuk posisi bintang deterministik
function seededValue(seed: number, offset = 0): number {
  const value = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

// clamp — batasi angka dalam rentang min-max
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

// ComicStarField — kumpulan bintang dengan efek kedip dan follow swarm
export function ComicStarField({ swarm, count = 88 }: ComicStarFieldProps) {
  // Buat konfigurasi bintang dengan useMemo (hitung sekali)
  const stars = useMemo<StarConfig[]>(() => {
    return Array.from({ length: count }, (_, index) => {
      const baseX = 2 + seededValue(index + 1, 1) * 96;
      const baseY = 2 + seededValue(index + 1, 2) * 96;
      const size = 2.2 + seededValue(index + 1, 3) * 4.2;
      const twinkleDuration = 2.4 + seededValue(index + 1, 4) * 2.6;
      const twinkleDelay = seededValue(index + 1, 5) * 2.5;

      return {
        id: index,
        baseX,
        baseY,
        size,
        twinkleDuration,
        twinkleDelay,
        trailIndex: Math.floor(index / 2),
        jitterX: (seededValue(index + 1, 6) - 0.5) * 8,
        jitterY: (seededValue(index + 1, 7) - 0.5) * 8,
      };
    });
  }, [count]);

  return (
    <div className={styles.field} aria-hidden>
      {stars.map((star) => {
        // Ambil titik trail terakhir sebagai target
        const lastTrailPoint = swarm.trail[swarm.trail.length - 1] ?? { xPct: 50, yPct: 50 };
        const targetTrailPoint =
          swarm.trail[Math.min(star.trailIndex, Math.max(0, swarm.trail.length - 1))] ??
          lastTrailPoint;

        const targetX = clamp(targetTrailPoint.xPct + star.jitterX, -14, 114);
        const targetY = clamp(targetTrailPoint.yPct + star.jitterY, -14, 114);

        return (
          <span
            key={star.id}
            className={styles.star}
            style={
              {
                "--bx": star.baseX,
                "--by": star.baseY,
                "--tx": targetX,
                "--ty": targetY,
                "--follow": swarm.active ? 1 : 0,
                "--size": star.size,
                "--twinkle-duration": star.twinkleDuration,
                "--twinkle-delay": star.twinkleDelay,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

export type { StarSwarmState };
