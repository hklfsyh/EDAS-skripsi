"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import styles from "./page.module.css";

const THEME_STORAGE_KEY = "playlist-theme-v1";
const CONTEXT_STORAGE_KEY = "playlist-context-v1";
const QUESTIONS_PER_STEP = 4;

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
  profileName: string;
  createdAt: string;
};

const defaultContext: ContextData = {
  activity: "", timeOfDay: "", mood: "",
  durationMinutes: 0, profileName: "", createdAt: "",
};

export default function KuesionerPage() {
  const router = useRouter();

  const applyTheme = (t: "dark" | "light") => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem(THEME_STORAGE_KEY, t);
  };

  // Ambil preferensi tema dari localStorage — set html[data-theme] synchronous
  const [theme, setThemeState] = useState<"dark" | "light">(() => {
    if (globalThis.window === undefined) return "dark";
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    const t = saved === "light" ? "light" : "dark";
    applyTheme(t);
    return t;
  });

  const setTheme = (next: "dark" | "light") => {
    applyTheme(next);
    setThemeState(next);
  };

  // Ambil konteks aktivitas dari localStorage
  const [contextData] = useState<ContextData>(() => {
    if (globalThis.window === undefined) return defaultContext;
    try {
      const saved = localStorage.getItem(CONTEXT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultContext;
    } catch { return defaultContext; }
  });

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [step, setStep] = useState(1);
  const [isSaved, setIsSaved] = useState(false);

  const totalSteps = Math.ceil(questions.length / QUESTIONS_PER_STEP);

  // Render subset pertanyaan per step
  const currentQuestions = useMemo(() => {
    const start = (step - 1) * QUESTIONS_PER_STEP;
    return questions
      .map((question, index) => ({ question, index }))
      .slice(start, start + QUESTIONS_PER_STEP);
  }, [step]);

  const handleAnswerSelect = (index: number, value: number) => {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  };

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v >= 1 && v <= 5).length,
    [answers],
  );
  const progressPct = (answeredCount / questions.length) * 100;
  const isCurrentStepComplete = currentQuestions.every(({ index }) => {
    const v = answers[index];
    return v >= 1 && v <= 5;
  });

  // Narasi konteks untuk pengantar kuesioner
  const contextNarrative = useMemo(() => {
    const activity = contextData.activity || "aktivitas pilihanmu";
    const time = contextData.timeOfDay || "waktu yang kamu tentukan";
    const mood = contextData.mood || "suasana yang kamu pilih";
    const dur = contextData.durationMinutes > 0
      ? `${contextData.durationMinutes} menit`
      : "durasi yang kamu atur";
    return `Bayangkan kamu sedang ${activity} di ${time} dengan suasana saat ini ${mood} selama ${dur}. Jawab pernyataan berikut sesuai preferensi musik yang ingin kamu dengarkan pada aktivitas tersebut.`;
  }, [contextData]);

  // Simpan jawaban kuesioner ke localStorage
  const handleSave = () => {
    if (answeredCount !== questions.length) return;
    localStorage.setItem("playlist-questionnaire-v1", JSON.stringify(answers));
    setIsSaved(true);
  };

  // Lanjut ke proses rekomendasi
  const handleContinueToProcess = () => {
    router.push("/proses");
  };

  return (
    <main className={`app-shell ${styles.page}`} data-theme={theme}>
      <MusicBackground />
      <MusicCursorTrail />

      <section className={`app-container ${styles.layout}`}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.backLink}>← Kembali</Link>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </header>

        <section className={styles.contextCard}>
          <h1>Pilih preferensi musikmu</h1>
          <p>
            Jawab 14 pernyataan berikut sesuai selera musikmu untuk aktivitas yang sudah
            kamu pilih sebelumnya. Hasilnya akan dipakai untuk merangkai playlist terbaik.
          </p>
        </section>

        <section className={styles.formCard}>
          <p className={styles.descriptionText}>{contextNarrative}</p>

          <div className={styles.progressBarWrap} aria-label="Progress jawaban">
            <div className={styles.progressBarFill} style={{ width: `${progressPct}%` }} />
          </div>

          <ol className={styles.questionList}>
            {currentQuestions.map(({ question, index }) => (
              <li key={question} className={styles.questionItem}>
                <p>{question}</p>
                <div className={styles.choiceRow}>
                  {choiceLabels.map((choice) => (
                    <label key={`${index}-${choice.value}`} className={styles.choiceChip}>
                      <input
                        type="radio"
                        name={`q-${index}`}
                        value={choice.value}
                        checked={answers[index] === choice.value}
                        onChange={() => handleAnswerSelect(index, choice.value)}
                      />
                      <span>{choice.label}</span>
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <div className={styles.actionRow}>
            {step > 1 && (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setStep((p) => Math.max(1, p - 1))}
              >
                ← Sebelumnya
              </button>
            )}

            {step < totalSteps && (
              <button
                type="button"
                className={styles.saveButton}
                disabled={!isCurrentStepComplete}
                onClick={() => setStep((p) => Math.min(totalSteps, p + 1))}
              >
                Lanjut →
              </button>
            )}

            {step === totalSteps && (
              <button
                type="button"
                className={styles.saveButton}
                disabled={answeredCount !== questions.length}
                onClick={handleSave}
              >
                Simpan jawaban
              </button>
            )}

            {step < totalSteps && !isCurrentStepComplete && (
              <span className={styles.savedBadge}>Lengkapi pilihan di halaman ini dulu ya.</span>
            )}
            {isSaved && <span className={styles.savedBadge}>Jawaban tersimpan ✅</span>}
            {isSaved && (
              <button
                type="button"
                className={styles.saveButton}
                onClick={handleContinueToProcess}
              >
                Lanjut ke proses rekomendasi →
              </button>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
