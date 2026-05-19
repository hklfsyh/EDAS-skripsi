"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import {
  PLAYLIST_CONTEXT_STORAGE_KEY,
  PLAYLIST_QUESTIONNAIRE_STORAGE_KEY,
  isPlaylistFlowFinished,
} from "@/lib/playlistFlow";
import styles from "./page.module.css";

const THEME_STORAGE_KEY = "playlist-theme-v1";

const questions = [
  "Saya lebih suka musik yang terasa cepat dan bikin suasana jadi lebih hidup.",
  "Saya lebih nyaman dengan musik yang terdengar santai dan mengalir pelan.",
  "Saya suka musik yang bisa bikin saya lebih semangat.",
  "Saya lebih suka musik yang terasa tenang dan tidak terlalu kuat.",
  "Saya menikmati musik yang terasa bersemangat dan penuh energi.",
  "Saya suka musik yang membuat saya ingin ikut bergerak.",
  "Saya menikmati musik yang ritmenya enak untuk diikuti.",
  "Saya lebih menikmati musik yang terasa ceria dan positif.",
  "Saya lebih suka lagu yang sudah familiar di telinga saya.",
  "Saya suka musik yang terdengar alami, seperti petikan gitar atau permainan alat musik akustik.",
  "Saya lebih suka musik yang vokalnya tidak terlalu dominan.",
  "Saya menikmati musik yang lebih menonjolkan suara alat musik.",
  "Saya suka musik dengan lirik yang jelas dan menonjol.",
  "Saya nyaman dengan musik yang tidak terlalu banyak kata-kata.",
] as const;

const TOTAL_QUESTIONS = questions.length;

const choiceLabels = [
  { value: 1, label: "Nggak banget" },
  { value: 2, label: "Kurang" },
  { value: 3, label: "Tengah-tengah" },
  { value: 4, label: "Setuju" },
  { value: 5, label: "Banget" },
] as const;

type ContextData = {
  activity: string;
  timeOfDay: string;
  mood: string;
  durationMinutes: number;
};

export default function KuesionerPage() {
  const router = useRouter();
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRouteReady, setIsRouteReady] = useState(false);

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark") as "dark" | "light";
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (isPlaylistFlowFinished()) {
      router.replace("/");
      return;
    }

    if (!localStorage.getItem(PLAYLIST_CONTEXT_STORAGE_KEY)) {
      router.replace("/");
      return;
    }

    setIsRouteReady(true);
  }, [router]);

  const contextData = useMemo(() => {
    try {
      const saved = localStorage.getItem(PLAYLIST_CONTEXT_STORAGE_KEY);
      if (!saved) return null;
      return JSON.parse(saved) as ContextData;
    } catch {
      return null;
    }
  }, []);

  const framingText = useMemo(() => {
    if (!contextData) {
      return "Jawab pertanyaan berikut berdasarkan konteks aktivitas yang kamu pilih sebelumnya.";
    }
    const activity = contextData.activity || "aktivitas pilihanmu";
    const time = contextData.timeOfDay || "waktu yang kamu tentukan";
    const mood = contextData.mood || "suasana yang kamu pilih";
    return `Bayangkan kamu sedang ${activity} pada ${time} dengan suasana saat ini ${mood}. Jawab pertanyaan berikut berdasarkan konteks tersebut.`;
  }, [contextData]);

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v >= 1 && v <= 5).length,
    [answers],
  );

  const progressPct = (answeredCount / TOTAL_QUESTIONS) * 100;
  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex];

  const handleSelect = (value: number) => {
    setAnswers((prev) => ({ ...prev, [currentIndex]: value }));

    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
    }

    if (currentIndex < TOTAL_QUESTIONS - 1) {
      advanceTimerRef.current = setTimeout(() => {
        setCurrentIndex((p) => p + 1);
      }, 300);
    }
  };

  useEffect(() => {
    if (!showCompletion && answeredCount === TOTAL_QUESTIONS && currentIndex >= TOTAL_QUESTIONS - 1) {
      setShowCompletion(true);
    }
  }, [answeredCount, currentIndex, showCompletion]);

  const handlePrevious = () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setShowCompletion(false);
    setCurrentIndex((p) => Math.max(0, p - 1));
  };

  const handleSaveAndContinue = () => {
    if (answeredCount !== TOTAL_QUESTIONS) return;
    localStorage.setItem(PLAYLIST_QUESTIONNAIRE_STORAGE_KEY, JSON.stringify(answers));
    setIsSaved(true);
  };

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  if (!isRouteReady) {
    return null;
  }

  if (isSaved) {
    return (
      <main className={`app-shell ${styles.page}`} data-theme={theme}>
        <MusicBackground />
        <MusicCursorTrail />
        <section className={`app-container ${styles.layout}`}>
          <header className={styles.topBar}>
            <Link href="/" className={styles.backLink}>
              ← Kembali
            </Link>
            <button type="button" className={styles.themeToggle} onClick={toggleTheme}>
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
          </header>
          <section className={styles.formCard}>
            <h2>Semua pertanyaan sudah dijawab ✅</h2>
            <p className={styles.doneText}>
              Jawabanmu sudah lengkap. Sekarang sistem akan memproses rekomendasi playlist terbaik untukmu.
            </p>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => router.push("/proses")}
            >
              Lanjut ke proses rekomendasi
            </button>
          </section>
        </section>
      </main>
    );
  }

  if (showCompletion) {
    return (
      <main className={`app-shell ${styles.page}`} data-theme={theme}>
        <MusicBackground />
        <MusicCursorTrail />
        <section className={`app-container ${styles.layout}`}>
          <header className={styles.topBar}>
            <Link href="/" className={styles.backLink}>
              ← Kembali
            </Link>
            <button type="button" className={styles.themeToggle} onClick={toggleTheme}>
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
          </header>
          <section className={styles.formCard}>
            <div className={styles.progressBarWrap}>
              <div className={styles.progressBarFill} style={{ width: "100%" }} />
            </div>
            <p className={styles.questionCount}>Pertanyaan {TOTAL_QUESTIONS} dari {TOTAL_QUESTIONS}</p>
            <h2 className={styles.lastQuestion}>Semua pertanyaan sudah dijawab.</h2>
            <p className={styles.doneText}>
              Simpan jawabanmu dulu ya sebelum lanjut ke proses rekomendasi.
            </p>
            <div className={styles.actionRow}>
              <button type="button" className={styles.ghostButton} onClick={handlePrevious}>
                ← Sebelumnya
              </button>
              <button
                type="button"
                className={styles.saveButton}
                onClick={handleSaveAndContinue}
              >
                Simpan & Lanjut
              </button>
            </div>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell ${styles.page}`} data-theme={theme}>
      <MusicBackground />
      <MusicCursorTrail />

      <section className={`app-container ${styles.layout}`}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.backLink}>
            ← Kembali
          </Link>
          <button type="button" className={styles.themeToggle} onClick={toggleTheme}>
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </header>

        <section className={styles.formCard}>
          <div className={styles.progressBarWrap}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <p className={styles.questionCount}>
            Pertanyaan {currentIndex + 1} dari {TOTAL_QUESTIONS}
          </p>

          <p className={styles.framingText}>{framingText}</p>

          <p className={styles.questionText}>{currentQuestion}</p>

          <div className={styles.choiceRow}>
            {choiceLabels.map((choice) => (
              <label
                key={choice.value}
                className={`${styles.choiceChip} ${currentAnswer === choice.value ? styles.choiceActive : ""}`}
              >
                <input
                  type="radio"
                  name={`q-${currentIndex}`}
                  value={choice.value}
                  checked={currentAnswer === choice.value}
                  onChange={() => handleSelect(choice.value)}
                />
                <span className={styles.choiceValue}>{choice.value}</span>
                <span className={styles.choiceLabel}>{choice.label}</span>
              </label>
            ))}
          </div>

          <div className={styles.actionRow}>
            {currentIndex > 0 && (
              <button type="button" className={styles.ghostButton} onClick={handlePrevious}>
                ← Sebelumnya
              </button>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
