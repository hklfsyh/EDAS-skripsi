"use client";

import { CSSProperties, useMemo } from "react";

import styles from "./ComicStarField.module.css";

type TrailPoint = {
  xPct: number;
  yPct: number;
};

type StarSwarmState = {
  trail: TrailPoint[];
  active: boolean;
};

type ComicStarFieldProps = {
  swarm: StarSwarmState;
  count?: number;
};

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

function seededValue(seed: number, offset = 0): number {
  const value = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function ComicStarField({ swarm, count = 88 }: ComicStarFieldProps) {
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
