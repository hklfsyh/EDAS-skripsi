"use client";

import { useEffect, useState } from "react";
import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import { ContextFormCard } from "@/components/home/ContextFormCard";
import { HeroCard } from "@/components/home/HeroCard";
import styles from "./page.module.css";

const THEME_STORAGE_KEY = "playlist-theme-v1";

export default function Home() {
  const applyTheme = (nextTheme: "dark" | "light") => {
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  // Ambil preferensi tema dari localStorage dan langsung sinkronkan ke html
  const [theme, setThemeState] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme = saved === "light" ? "light" : "dark";
    applyTheme(nextTheme);
    return nextTheme;
  });

  const setTheme = (updater: "dark" | "light" | ((prev: "dark" | "light") => "dark" | "light")) => {
    const nextTheme = typeof updater === "function" ? updater(theme) : updater;
    applyTheme(nextTheme);
    setThemeState(nextTheme);
  };

  // Jaga agar html theme tetap sinkron
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className={`app-shell ${styles.page}`} data-theme={theme}>
      <MusicBackground />
      <MusicCursorTrail />

      <main className={`app-container ${styles.main}`}>
        <header className={styles.topBar}>
          <span className={styles.logo}>
            <span className={styles.logoIcon}>🎧</span>
            VibePlay
          </span>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={() => setTheme((p) => (p === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </header>

        {/* Render hero dan form konteks */}
        <HeroCard />
        <ContextFormCard />

        <section className={styles.note}>
          <h3>💡 Cara kerjanya</h3>
          <p>Kami menggunakan metode <strong>EDAS</strong> (Evaluation based on Distance from Average Solution) untuk memeringkat lagu berdasarkan preferensi musikmu. Hasilnya adalah playlist yang paling cocok dengan aktivitas dan suasana hatimu saat ini.</p>
        </section>
      </main>
    </div>
  );
}
