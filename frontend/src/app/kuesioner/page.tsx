"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { ComicStarField, type StarSwarmState } from "@/components/common/ComicStarField";
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
  activity: "",
  timeOfDay: "",
  mood: "",
  durationMinutes: 0,
  profileName: "",
  createdAt: "",
};

export default function KuesionerPage() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "dark" || savedTheme === "light" ? savedTheme : "dark";
  });
  const [contextData] = useState<ContextData>(() => {
    if (typeof window === "undefined") {
      return defaultContext;
    }

    const savedContext = localStorage.getItem(CONTEXT_STORAGE_KEY);
    if (!savedContext) {
      return defaultContext;
    }

    try {
      return JSON.parse(savedContext) as ContextData;
    } catch {
      return defaultContext;
    }
  });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [step, setStep] = useState(1);
  const [isSaved, setIsSaved] = useState(false);
  const [swarm, setSwarm] = useState<StarSwarmState>({
    trail: [{ xPct: 50, yPct: 50 }],
    active: false,
  });
  const trailLengthRef = useRef(30);

  const totalSteps = Math.ceil(questions.length / QUESTIONS_PER_STEP);

  const currentQuestions = useMemo(() => {
    const start = (step - 1) * QUESTIONS_PER_STEP;
    const end = start + QUESTIONS_PER_STEP;
    return questions.map((question, index) => ({ question, index })).slice(start, end);
  }, [step]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => value >= 1 && value <= 5).length,
    [answers],
  );
  const progressPercentage = (answeredCount / questions.length) * 100;

  const isCurrentStepComplete = currentQuestions.every(({ index }) => {
    const answerValue = answers[index];
    return answerValue >= 1 && answerValue <= 5;
  });

  const contextNarrative = useMemo(() => {
    const activityText = contextData.activity || "aktivitas pilihanmu";
    const timeText = contextData.timeOfDay || "waktu yang kamu tentukan";
    const moodText = contextData.mood || "suasana yang kamu pilih";
    const durationText =
      contextData.durationMinutes > 0
        ? `${contextData.durationMinutes} menit`
        : "durasi yang kamu atur";

    return `Untuk sesi ${activityText} di ${timeText} dengan suasana ${moodText} selama ${durationText}, jawab pernyataan berikut sesuai preferensi musik yang ingin kamu dengarkan.`;
  }, [contextData]);

  const handleSave = () => {
    if (answeredCount !== questions.length) {
      return;
    }

    localStorage.setItem("playlist-questionnaire-v1", JSON.stringify(answers));
    setIsSaved(true);
  };

  return (
    <main
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

      <section className={styles.layout}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.backLink}>
            ← Balik ke halaman awal
          </Link>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </header>

        <section className={styles.contextCard}>
          <h1>Pertanyaan preferensi musik</h1>
          <p>
            Berikan jawaban terhadap setiap pernyataan berikut sesuai dengan preferensi musik
            yang ingin Anda dengarkan pada aktivitas yang telah Anda pilih sebelumnya.
            Bayangkan Anda sedang melakukan aktivitas tersebut, kemudian tentukan sejauh mana
            Anda setuju dengan pernyataan yang diberikan.
          </p>
        </section>

        <section className={styles.formCard}>
          <p className={styles.descriptionText}>{contextNarrative}</p>

          <div className={styles.progressBarWrap} aria-label="Progress jawaban">
            <div
              className={styles.progressBarFill}
              style={{ width: `${progressPercentage}%` }}
            />
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
                          setAnswers((previous) => ({
                            ...previous,
                            [index]: choice.value,
                          }))
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
                onClick={() => setStep((previous) => Math.max(1, previous - 1))}
              >
                ← Sebelumnya
              </button>
            )}

            {step < totalSteps && (
              <button
                type="button"
                className={styles.saveButton}
                disabled={!isCurrentStepComplete}
                onClick={() => setStep((previous) => Math.min(totalSteps, previous + 1))}
              >
                Lanjut pertanyaan berikutnya →
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

            {step < totalSteps && !isCurrentStepComplete && <span className={styles.savedBadge}>Lengkapi pilihan di halaman ini dulu ya.</span>}

            {isSaved && <span className={styles.savedBadge}>Jawaban tersimpan ✅</span>}
          </div>
        </section>
      </section>
    </main>
  );
}
