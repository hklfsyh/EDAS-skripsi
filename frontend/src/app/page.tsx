"use client";

import { useEffect, useRef, useState } from "react";

import { ComicStarField, type StarSwarmState } from "@/components/common/ComicStarField";
import { ContextFormCard } from "@/components/home/ContextFormCard";
import { HeroCard } from "@/components/home/HeroCard";
import styles from "./page.module.css";

const THEME_STORAGE_KEY = "playlist-theme-v1";

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "dark" || savedTheme === "light" ? savedTheme : "dark";
  });
  const [swarm, setSwarm] = useState<StarSwarmState>({
    trail: [{ xPct: 50, yPct: 50 }],
    active: false,
  });
  const trailLengthRef = useRef(30);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div
      className={styles.page}
      data-theme={theme}
      onMouseMove={(event) => {
        const xPct = (event.clientX / window.innerWidth) * 100;
        const yPct = (event.clientY / window.innerHeight) * 100;
        setSwarm((previous) => ({
          trail: [{ xPct, yPct }, ...previous.trail].slice(0, trailLengthRef.current),
          active: true,
        }));
      }}
      onMouseLeave={() => {
        setSwarm((previous) => ({ ...previous, active: false }));
      }}
    >
      <ComicStarField swarm={swarm} />

      <main className={styles.main}>
        <header className={styles.topBar}>
          <p>Isi konteks singkat dulu, lalu lanjut ke kuesioner musik.</p>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </header>

        <HeroCard />
        <ContextFormCard />

        <section className={styles.note}>
          <h3>Catatan</h3>
          <p>Isi pilihan sesuai kebutuhan sesi kamu saat ini, nanti sistem menyesuaikan rekomendasinya.</p>
        </section>
      </main>
    </div>
  );
}
