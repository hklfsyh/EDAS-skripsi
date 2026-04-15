"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import styles from "./page.module.css";

const EVALUATION_STORAGE_KEY = "playlist-evaluation-v1";
const THEME_STORAGE_KEY = "playlist-theme-v1";

export default function SelesaiPage() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "dark");
  }, []);

  const evaluation = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(EVALUATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) as { usability: number; understanding: number; comment: string } : null;
  }, []);

  return (
    <main className={styles.page}>
      <MusicBackground />
      <MusicCursorTrail />

      <section className={styles.card}>
        <h1>Flow UI/UX dummy selesai 🎉</h1>
        <p>
          Kamu sudah sampai tahap paling akhir: hasil rekomendasi, penjelasan NLG,
          dan evaluasi usability dasar.
        </p>

        {evaluation && (
          <div className={styles.summary}>
            <h2>Ringkasan evaluasi kamu</h2>
            <ul>
              <li>Usability: {evaluation.usability}/5</li>
              <li>Kejelasan penjelasan: {evaluation.understanding}/5</li>
              <li>Komentar: {evaluation.comment || "-"}</li>
            </ul>
          </div>
        )}

        <div className={styles.actions}>
          <Link href="/">Ulangi dari awal</Link>
          <Link href="/hasil">Lihat hasil lagi</Link>
        </div>
      </section>
    </main>
  );
}
