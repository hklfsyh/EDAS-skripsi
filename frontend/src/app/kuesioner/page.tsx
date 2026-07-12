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

// kunci localstorage buat tema
const THEME_STORAGE_KEY = "playlist-theme-v1";

// 14 pertanyaan kuesioner preferensi musik
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

// label jawaban likert 1-5
const choiceLabels = [
  { value: 1, label: "Nggak banget" },
  { value: 2, label: "Kurang" },
  { value: 3, label: "Tengah-tengah" },
  { value: 4, label: "Setuju" },
  { value: 5, label: "Banget" },
] as const;

// data konteks aktivitas dari localstorage
type ContextData = {
  activity: string;
  time_category: string;
  timeOfDay?: string;
  mood: string;
  durationMinutes: number;
};

// halaman kuesioner 1 soal per layar dengan auto-advance
export default function KuesionerPage() {
  const router = useRouter();
  // timer auto-advance buat lanjut ke soal berikutnya
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRouteReady, setIsRouteReady] = useState(false);

  // state tema, dibaca dari localstorage pas mount
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark") as "dark" | "light";
  });

  // tukar dark/light mode
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
  };

  // nyocokin tema ke html
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // guard: redirect ke beranda kalo flow udah selesai atau konteks belum diisi
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

  // baca konteks aktivitas dari localstorage
  const contextData = useMemo(() => {
    try {
      const saved = localStorage.getItem(PLAYLIST_CONTEXT_STORAGE_KEY);
      if (!saved) return null;
      return JSON.parse(saved) as ContextData;
    } catch {
      return null;
    }
  }, []);

  // narasi konteks yang muncul di atas soal
  const framingText = useMemo(() => {
    if (!contextData) {
      return "Jawab pertanyaan berikut berdasarkan konteks aktivitas yang kamu pilih sebelumnya.";
    }
    const activity = contextData.activity || "aktivitas pilihanmu";
    const time = (contextData.time_category ?? contextData.timeOfDay) || "waktu yang kamu tentukan";
    const mood = contextData.mood || "suasana yang kamu pilih";
    return `Bayangkan kamu sedang ${activity} pada ${time} dengan suasana saat ini ${mood}. Jawab pertanyaan berikut berdasarkan konteks tersebut.`;
  }, [contextData]);

  // state jawaban kuesioner (key = index soal, value = skor 1-5)
  const [answers, setAnswers] = useState<Record<number, number>>({});
  // index soal yang lagi aktif
  const [currentIndex, setCurrentIndex] = useState(0);
  // flag apakah jawaban udah disimpan dan siap redirect ke /proses
  const [isSaved, setIsSaved] = useState(false);
  // flag layar completion (semua soal terjawab)
  const [showCompletion, setShowCompletion] = useState(false);

  // jumlah soal yang udah dijawab
  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v >= 1 && v <= 5).length,
    [answers],
  );

  const progressPct = (answeredCount / TOTAL_QUESTIONS) * 100;
  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex];

  // simpen jawaban lalu otomatis lanjut 300ms ke soal berikutnya
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

  // tampilin layar completion pas semua soal terjawab
  useEffect(() => {
    if (!showCompletion && answeredCount === TOTAL_QUESTIONS && currentIndex >= TOTAL_QUESTIONS - 1) {
      setShowCompletion(true);
    }
  }, [answeredCount, currentIndex, showCompletion]);

  // maju ke soal berikutnya (manual, bukan auto-next)
  const goToNext = () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    if (currentIndex < TOTAL_QUESTIONS - 1) {
      setCurrentIndex((p) => p + 1);
    }
  };

  // balik ke soal sebelumnya
  const handlePrevious = () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setShowCompletion(false);
    setCurrentIndex((p) => Math.max(0, p - 1));
  };

  // simpen jawaban ke localstorage lalu redirect
  const handleSaveAndContinue = () => {
    if (answeredCount !== TOTAL_QUESTIONS) return;
    localStorage.setItem(PLAYLIST_QUESTIONNAIRE_STORAGE_KEY, JSON.stringify(answers));
    setIsSaved(true);
  };

  // bersihin timer pas komponen unmount
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

  // layar "jawaban tersimpan" → redirect ke /proses
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

  // layar completion (semua soal udah dijawab, tapi belum disimpen)
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

  // layar utama: 1 soal + 5 pilihan jawaban
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
            {currentIndex < TOTAL_QUESTIONS - 1 && (
              <button
                type="button"
                className={currentAnswer !== undefined ? styles.saveButton : styles.ghostButton}
                disabled={currentAnswer === undefined}
                onClick={goToNext}
              >
                Lanjut →
              </button>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
