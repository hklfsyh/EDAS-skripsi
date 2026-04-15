"use client";

import { useEffect, useMemo, useState } from "react";
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
  "Saya lebih nyaman dengan musik yang santai dan tidak terburu-buru.",
  "Saya suka musik yang bisa bikin saya lebih semangat.",
  "Saya cenderung memilih musik yang tenang dan tidak terlalu kuat.",
  "Saya menikmati musik yang terasa aktif dan penuh energi.",
  "Saya suka musik yang bikin saya pengen ikut bergerak.",
  "Saya menikmati musik yang ritmenya enak untuk diikuti.",
  "Saya lebih menikmati musik yang terasa ceria dan positif.",
  "Saya biasanya lebih suka lagu yang sudah familiar di telinga saya.",
  "Saya suka musik yang terdengar alami seperti dimainkan dengan alat musik.",
  "Saya lebih suka musik tanpa banyak vokal.",
  "Saya menikmati musik yang fokus pada instrumen.",
  "Saya suka musik dengan lirik yang jelas dan menonjol.",
  "Saya lebih nyaman dengan musik yang tidak terlalu banyak kata-kata.",
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
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" ? "light" : "dark";
  });

  const [contextData] = useState<ContextData>(() => {
    if (typeof window === "undefined") return defaultContext;
    try {
      const saved = localStorage.getItem(CONTEXT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultContext;
    } catch { return defaultContext; }
  });

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [step, setStep] = useState(1);
  const [isSaved, setIsSaved] = useState(false);

  const totalSteps = Math.ceil(questions.length / QUESTIONS_PER_STEP);

  const currentQuestions = useMemo(() => {
    const start = (step - 1) * QUESTIONS_PER_STEP;
    return questions
      .map((question, index) => ({ question, index }))
      .slice(start, start + QUESTIONS_PER_STEP);
  }, [step]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v >= 1 && v <= 5).length,
    [answers],
  );
  const progressPct = (answeredCount / questions.length) * 100;
  const isCurrentStepComplete = currentQuestions.every(({ index }) => {
    const v = answers[index];
    return v >= 1 && v <= 5;
  });

  const contextNarrative = useMemo(() => {
    const activity = contextData.activity || "aktivitas pilihanmu";
    const time = contextData.timeOfDay || "waktu yang kamu tentukan";
    const mood = contextData.mood || "suasana yang kamu pilih";
    const dur = contextData.durationMinutes > 0
      ? `${contextData.durationMinutes} menit`
      : "durasi yang kamu atur";
    return `Untuk sesi ${activity} di ${time} dengan suasana ${mood} selama ${dur}, jawab pernyataan berikut sesuai preferensi musikmu.`;
  }, [contextData]);

  const handleSave = () => {
    if (answeredCount !== questions.length) return;
    localStorage.setItem("playlist-questionnaire-v1", JSON.stringify(answers));
    setIsSaved(true);
  };

  const handleContinueToProcess = () => {
    router.push("/proses");
  };

  return (
    <main className={styles.page} data-theme={theme}>
      <MusicBackground />
      <MusicCursorTrail />

      <section className={styles.layout}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.backLink}>← Balik ke halaman awal</Link>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={() => setTheme((p) => p === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </header>

        <section className={styles.contextCard}>
          <h1>Pertanyaan preferensi musik</h1>
          <p>
            Berikan jawaban terhadap setiap pernyataan berikut sesuai dengan preferensi musik
            yang ingin Anda dengarkan pada aktivitas yang telah Anda pilih sebelumnya.
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
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [index]: choice.value }))
                        }
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
