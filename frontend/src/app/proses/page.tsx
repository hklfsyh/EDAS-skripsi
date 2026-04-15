"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import styles from "./page.module.css";

const CONTEXT_STORAGE_KEY = "playlist-context-v1";
const QUESTIONNAIRE_STORAGE_KEY = "playlist-questionnaire-v1";
const RESULT_STORAGE_KEY = "playlist-result-v1";
const THEME_STORAGE_KEY = "playlist-theme-v1";

type ContextData = {
  activity: string;
  timeOfDay: string;
  mood: string;
  durationMinutes: number;
  profileName: string;
  createdAt: string;
};

type PlaylistItem = {
  rank: number;
  title: string;
  artist: string;
  durationSec: number;
  appraisalScore: number;
};

function formatDuration(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function fetchDummyPlaylist(targetMinutes: number): Promise<PlaylistItem[]> {
  const response = await fetch(`/api/dummy-playlist?targetMinutes=${targetMinutes}`);

  if (!response.ok) {
    throw new Error("Gagal memuat data lagu dari output.csv");
  }

  const payload = (await response.json()) as { playlist: PlaylistItem[] };
  return payload.playlist;
}

export default function ProsesPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(8);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "dark");
  }, []);

  const steps = useMemo(
    () => [
      "Membaca konteks aktivitas pengguna",
      "Mengonversi jawaban kuesioner jadi bobot preferensi",
      "Mengambil daftar lagu langsung dari output.csv",
      "Menyusun playlist dummy sesuai target durasi",
      "Menyusun narasi rekomendasi (dummy NLG)",
    ],
    [],
  );

  useEffect(() => {
    let isCancelled = false;
    const contextRaw = localStorage.getItem(CONTEXT_STORAGE_KEY);
    const answersRaw = localStorage.getItem(QUESTIONNAIRE_STORAGE_KEY);

    if (!contextRaw || !answersRaw) {
      router.replace("/");
      return;
    }

    const context = JSON.parse(contextRaw) as ContextData;
    const answers = JSON.parse(answersRaw) as Record<number, number>;
    let stepTimer: ReturnType<typeof setInterval> | undefined;
    let progressTimer: ReturnType<typeof setInterval> | undefined;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      try {
        const playlist = await fetchDummyPlaylist(context.durationMinutes);
        if (isCancelled) return;

        const totalSec = playlist.reduce((sum, item) => sum + item.durationSec, 0);
        const resultPayload = {
          context,
          answers,
          playlist,
          summary: {
            targetDurationSec: context.durationMinutes * 60,
            totalDurationSec: totalSec,
            selectedSongs: playlist.length,
          },
          createdAt: new Date().toISOString(),
          nlgText: `Berdasarkan konteks ${context.activity || "aktivitas"} pada ${context.timeOfDay || "waktu dipilih"} dengan mood ${context.mood || "netral"}, sistem menampilkan dummy playlist langsung dari data output.csv hingga durasinya mendekati target ${context.durationMinutes} menit.`,
        };

        localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(resultPayload));

        stepTimer = setInterval(() => {
          setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
        }, 500);

        progressTimer = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 100) return 100;
            return prev + 6;
          });
        }, 180);

        redirectTimer = setTimeout(() => {
          router.replace("/hasil");
        }, 3300);
      } catch {
        if (isCancelled) return;
        router.replace("/");
      }
    })();

    return () => {
      isCancelled = true;
      if (stepTimer) clearInterval(stepTimer);
      if (progressTimer) clearInterval(progressTimer);
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [router, steps]);

  return (
    <main className={styles.page}>
      <MusicBackground />
      <MusicCursorTrail />

      <section className={styles.card}>
        <h1>Menyiapkan rekomendasi playlist kamu...</h1>
        <p>
          Ini masih mode dummy UI/UX. Data lagu langsung dibaca dari output.csv
          tanpa menjalankan algoritma EDAS.
        </p>

        <div className={styles.progressWrap}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.percentLabel}>{Math.min(progress, 100)}%</span>

        <ul className={styles.stepList}>
          {steps.map((step, idx) => (
            <li
              key={step}
              className={idx <= currentStep ? styles.stepDone : styles.stepIdle}
            >
              {idx <= currentStep ? "✅" : "⏳"} {step}
            </li>
          ))}
        </ul>

        <p className={styles.note}>Kamu akan diarahkan otomatis ke halaman hasil.</p>
        <p className={styles.previewTime}>Estimasi: ±3 detik</p>
      </section>

      <span className={styles.helperDuration}>{formatDuration(Math.max(0, Math.round((100 - progress) * 0.08)))}</span>
    </main>
  );
}
