"use client";

import { useEffect, useState } from "react";
import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import { ContextFormCard } from "@/components/home/ContextFormCard";
import { HeroCard } from "@/components/home/HeroCard";
import styles from "./page.module.css";

const THEME_STORAGE_KEY = "playlist-theme-v1";

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div className={styles.page} data-theme={theme}>
      <MusicBackground />
      <MusicCursorTrail />

      <main className={styles.main}>
        <header className={styles.topBar}>
          <span className={styles.logo}>
            <span className={styles.logoIcon}>🎧</span>
            PlaylistAI
          </span>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={() => setTheme((p) => (p === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </header>

        <HeroCard />
        <ContextFormCard />

        <section className={styles.note}>
          <h3>📋 Catatan</h3>
          <p>Isi pilihan sesuai kebutuhan sesi kamu saat ini — sistem akan menyesuaikan rekomendasinya.</p>
        </section>
      </main>
    </div>
  );
}
