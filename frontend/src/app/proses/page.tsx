"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import { getOrCreateClientId } from "@/lib/clientId";
import { mapQuestionnaireToPreferences, type PreferenceParameter } from "@/server/utils/preferenceMapping";
import styles from "./page.module.css";

const CONTEXT_STORAGE_KEY = "playlist-context-v1";
const QUESTIONNAIRE_STORAGE_KEY = "playlist-questionnaire-v1";
const RESULT_STORAGE_KEY = "playlist-result-v1";
const THEME_STORAGE_KEY = "playlist-theme-v1";
const DEFAULT_NLG_TIMEOUT_MS = 60000;
const NLG_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_NLG_TIMEOUT_MS ?? DEFAULT_NLG_TIMEOUT_MS,
);

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
  id_song?: number;
  title: string;
  artist: string;
  durationSec: number;
  appraisalScore: number;
};

type NlgMeta = {
  source: string;
  model?: string;
  fallbackUsed: boolean;
  reason?: string | null;
};

type PreferenceSummary = {
  primary: string[];
  secondary: string[];
  avoid: string[];
};

const PREFERENCE_LABELS: Record<PreferenceParameter, { high: string; low: string }> = {
  tempo: {
    high: "musik dengan tempo yang terasa lebih cepat",
    low: "musik dengan tempo yang terasa lebih santai",
  },
  energy: {
    high: "musik yang terasa lebih berenergi",
    low: "musik yang terasa lebih lembut dan tidak terlalu intens",
  },
  danceability: {
    high: "musik dengan alur ritme yang terasa lebih mengalir dan enak diikuti",
    low: "musik yang tidak terlalu menonjolkan dorongan untuk ikut bergerak",
  },
  happiness: {
    high: "musik dengan nuansa yang lebih cerah dan positif",
    low: "musik dengan nuansa yang lebih tenang dan tidak terlalu ceria",
  },
  popularity: {
    high: "lagu-lagu yang terasa lebih familiar di telinga",
    low: "lagu-lagu yang tidak terlalu bergantung pada kesan familiar",
  },
  acousticness: {
    high: "musik dengan sentuhan akustik yang lebih terasa",
    low: "musik dengan nuansa yang tidak terlalu menonjolkan unsur akustik",
  },
  instrumentalness: {
    high: "musik yang memberi ruang lebih besar pada instrumen",
    low: "musik yang lebih menonjolkan unsur vokal",
  },
  speechiness: {
    high: "musik yang unsur lirik atau kata-katanya terasa lebih menonjol",
    low: "musik yang tidak terlalu padat oleh kata-kata",
  },
};

  function joinList(items: string[]): string {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} dan ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, dan ${items[items.length - 1]}`;
  }

  function buildPreferenceSummary(answers: Record<number, number>): PreferenceSummary {
    const preferences = mapQuestionnaireToPreferences(answers);
    const entries = Object.entries(preferences.parameters).map(([parameter, info]) => ({
      parameter: parameter as PreferenceParameter,
      meanLikert: info.meanLikert,
      weight: info.weight,
    }));

    const sorted = [...entries].sort((a, b) => b.weight - a.weight);
    const primaryCandidates = sorted.filter((entry) => entry.meanLikert >= 3.2);
    const secondaryCandidates = sorted.filter((entry) => entry.meanLikert >= 3 && entry.meanLikert < 3.2);
    const avoidCandidates = sorted.filter((entry) => entry.meanLikert <= 2.6);

    const primary = (primaryCandidates.length > 0 ? primaryCandidates : sorted)
      .slice(0, 2)
      .map((entry) => PREFERENCE_LABELS[entry.parameter].high);

    const secondary = secondaryCandidates.slice(0, 2).map((entry) => PREFERENCE_LABELS[entry.parameter].high);
    const avoid = avoidCandidates.slice(0, 2).map((entry) => PREFERENCE_LABELS[entry.parameter].low);

    return { primary, secondary, avoid };
  }

  function buildFallbackNarration(
    context: ContextData,
    playlist: PlaylistItem[],
    preferenceSummary: PreferenceSummary,
  ): string {
    const totalSec = playlist.reduce((sum, item) => sum + item.durationSec, 0);
    const totalMinutes = Math.max(0, Math.round(totalSec / 60));
    const activity = context.activity || "aktivitas";
    const timeOfDay = context.timeOfDay || "waktu yang dipilih";
    const mood = context.mood || "netral";

    const topSongs = playlist.slice(0, 2).map((song) => song.title).filter(Boolean);

    const primaryText =
      preferenceSummary.primary.length > 0
        ? joinList(preferenceSummary.primary)
        : "karakter musik yang terasa seimbang dan tidak terlalu ekstrem";

    const secondaryText =
      preferenceSummary.secondary.length > 0
        ? ` Selain itu, sesi ini juga cenderung cocok dengan ${joinList(preferenceSummary.secondary)}.`
        : "";

    const avoidText =
      preferenceSummary.avoid.length > 0
        ? ` Di sisi lain, sistem tidak terlalu memprioritaskan ${joinList(preferenceSummary.avoid)} pada sesi ini.`
        : "";

    const songsText =
      topSongs.length > 0
        ? ` Beberapa lagu teratas seperti ${joinList(topSongs)} ikut mewakili arah rekomendasi ini.`
        : "";

    return (
      `Untuk sesi ${activity} pada ${timeOfDay} dengan suasana saat ini ${mood}, jawaban kuesionermu menunjukkan kecenderungan ke ${primaryText}.${secondaryText}${avoidText} ` +
      `Karena itu, playlist ini dipilih dari lagu-lagu yang tingkat kecocokannya paling tinggi dengan kebutuhan sesi ini, sehingga hasilnya tidak terasa dipilih secara acak.${songsText} ` +
      `Dengan total durasi sekitar ${totalMinutes} menit, playlist ini disusun agar tetap terasa nyambung dan relevan untuk menemani sesi yang kamu pilih.`
    )
      .replace(/\s+/g, " ")
      .trim();
  }

  async function generateNlgText(
    context: ContextData,
    playlist: PlaylistItem[],
    preferenceSummary: PreferenceSummary,
  ): Promise<{ text: string; meta: NlgMeta }> {
    const fallback = buildFallbackNarration(context, playlist, preferenceSummary);
    const totalDurationSec = playlist.reduce((sum, item) => sum + item.durationSec, 0);

    try {
      const response = await fetchWithTimeout(
        "/api/nlg/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            context: {
              activity: context.activity,
              timeOfDay: context.timeOfDay,
              mood: context.mood,
            },
            targetDurationSec: context.durationMinutes * 60,
            totalDurationSec,
            selectedSongs: playlist.length,
            topSongs: playlist.slice(0, 5).map((item) => ({
              title: item.title,
              artist: item.artist,
            })),
            preferenceSummary,
          }),
        },
        NLG_TIMEOUT_MS,
      );

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        text?: string | null;
        meta?: {
          source?: string;
          model?: string;
          reason?: string | null;
        };
      };

      if (!response.ok || !payload.ok || !payload.text) {
        return {
          text: fallback,
          meta: {
            source: "fallback-local",
            model: payload.meta?.model,
            fallbackUsed: true,
            reason: payload.meta?.reason ?? "nlg_failed",
          },
        };
      }

      return {
        text: payload.text.trim(),
        meta: {
          source: payload.meta?.source ?? "gemini",
          model: payload.meta?.model,
          fallbackUsed: false,
          reason: payload.meta?.reason ?? null,
        },
      };
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === "AbortError";
      return {
        text: fallback,
        meta: {
          source: "fallback-local",
          model: undefined,
          fallbackUsed: true,
          reason: isAbort ? "timeout" : "network_or_unexpected",
        },
      };
    }
  }

  function formatDuration(sec: number): string {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchEdasPlaylist(
    targetMinutes: number,
    answers: Record<number, number>,
  ): Promise<PlaylistItem[]> {
    const response = await fetch("/api/dummy-playlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetMinutes,
        answers,
      }),
    });

    if (!response.ok) {
      throw new Error("gagal_memuat_playlist");
    }

    const payload = (await response.json().catch(() => ({}))) as {
      playlist?: PlaylistItem[];
    };

    if (!Array.isArray(payload.playlist) || payload.playlist.length === 0) {
      throw new Error("playlist_kosong");
    }

    return payload.playlist;
  }

// Simpan hasil rekomendasi ke database
async function saveRecommendation(
  clientId: string,
  context: ContextData,
  answers: Record<number, number>,
  playlist: PlaylistItem[],
) {
  const payload = {
    clientId,
    context: {
      activity: context.activity,
      timeOfDay: context.timeOfDay,
      mood: context.mood,
      durationMinutes: context.durationMinutes,
    },
    answers,
    playlist: playlist.map((item) => ({
      id_song: item.id_song,
      rank: item.rank,
      appraisalScore: item.appraisalScore,
    })),
  };

  await fetch("/api/recommendations/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export default function ProsesPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(8);
  const [currentStep, setCurrentStep] = useState(0);
  const [nlgStatusText, setNlgStatusText] = useState("");
  const runIdRef = useRef(0);
  const isMountedRef = useRef(false);
  const inflightRef = useRef<{ key: string; promise: Promise<PlaylistItem[]> } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
    getOrCreateClientId();
  }, []);

  const steps = useMemo(
    () => [
      "Membaca konteks aktivitas pengguna",
      "Mengonversi jawaban kuesioner jadi bobot preferensi",
      "Mengambil daftar lagu dari basis data",
      "Memproses EDAS berdasarkan bobot preferensi",
      "Menyusun playlist rekomendasi sesuai target durasi",
      "Menyusun penjelasan rekomendasi",
    ],
    [],
  );

  useEffect(() => {
    isMountedRef.current = true;
    const runId = ++runIdRef.current;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;
    let nlgStatusTimer: ReturnType<typeof setTimeout> | undefined;

    const contextRaw = localStorage.getItem(CONTEXT_STORAGE_KEY);
    const answersRaw = localStorage.getItem(QUESTIONNAIRE_STORAGE_KEY);

    if (!contextRaw || !answersRaw) {
      router.replace("/");
      return undefined;
    }

    const context = JSON.parse(contextRaw) as ContextData;
    const answers = JSON.parse(answersRaw) as Record<number, number>;
    const preferenceSummary = buildPreferenceSummary(answers);
    const requestKey = `${context.durationMinutes}::${answersRaw}`;

    // Orkestrasi proses rekomendasi + NLG
    const runFlow = async () => {
      try {
        setCurrentStep(0);
        setProgress(12);
        // Generate playlist rekomendasi dari API
        const playlistPromise =
          inflightRef.current?.key === requestKey
            ? inflightRef.current.promise
            : fetchEdasPlaylist(context.durationMinutes, answers);

        setCurrentStep(1);
        setProgress(28);
        inflightRef.current = { key: requestKey, promise: playlistPromise };
        setCurrentStep(2);
        setProgress(42);
        const playlist = await playlistPromise;
        if (!isMountedRef.current || runId !== runIdRef.current) return;

        setCurrentStep(3);
        setProgress(55);
        const totalSec = playlist.reduce((sum, item) => sum + item.durationSec, 0);
        // Fallback narasi lokal sementara NLG diproses
        const fallbackNarration = buildFallbackNarration(context, playlist, preferenceSummary);
        const fallbackMeta: NlgMeta = {
          source: "fallback-local",
          model: undefined,
          fallbackUsed: true,
          reason: "not_generated_yet",
        };
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
          nlgText: fallbackNarration,
          nlgMeta: fallbackMeta,
        };

        localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(resultPayload));
        setCurrentStep(4);
        setProgress(68);

        // Simpan rekomendasi ke database tanpa blok UI
        void saveRecommendation(getOrCreateClientId(), context, answers, playlist).catch(() => undefined);

        setCurrentStep(4);
        setProgress(74);
        setNlgStatusText("Penjelasan rekomendasi sedang disusun.");
        nlgStatusTimer = setTimeout(() => {
          if (!isMountedRef.current || runId !== runIdRef.current) return;
          setNlgStatusText("Masih mencoba menyusun narasi terbaik...");
        }, 15000);
        // Generate narasi rekomendasi (NLG)
        const nlgResult = await generateNlgText(context, playlist, preferenceSummary);
        if (!isMountedRef.current || runId !== runIdRef.current) return;
        if (nlgStatusTimer) clearTimeout(nlgStatusTimer);
        setNlgStatusText("");

        const finalPayload = {
          ...resultPayload,
          nlgText: nlgResult.text,
          nlgMeta: nlgResult.meta,
        };
        localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(finalPayload));
        setCurrentStep(5);
        setProgress(100);

        // Redirect ke halaman hasil setelah final siap
        redirectTimer = setTimeout(() => {
          router.replace("/hasil");
        }, 500);
      } catch {
        if (!isMountedRef.current || runId !== runIdRef.current) return;
        if (nlgStatusTimer) clearTimeout(nlgStatusTimer);
        setNlgStatusText("");
        router.replace("/");
      }
    };

    void runFlow();

    return () => {
      isMountedRef.current = false;
      if (redirectTimer) clearTimeout(redirectTimer);
      if (nlgStatusTimer) clearTimeout(nlgStatusTimer);
    };
  }, [router, steps]);

  return (
    <main className={`app-shell ${styles.page}`}>
      <MusicBackground />
      <MusicCursorTrail />

      <section className={`app-container ${styles.card}`}>
        <h1>Menyusun playlist terbaik untukmu</h1>
        <p>
          Sistem sedang menganalisis preferensi musikmu, memeringkat lagu dengan metode EDAS, dan menyiapkan penjelasan rekomendasi.
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

        {currentStep >= 4 && currentStep < 5 && nlgStatusText ? (
          <p className={styles.previewTime}>{nlgStatusText}</p>
        ) : null}

        <p className={styles.note}>Kamu akan diarahkan otomatis ke halaman hasil.</p>
        <p className={styles.previewTime}>
          Proses ini biasanya selesai dalam beberapa detik hingga kurang dari satu menit.
        </p>
      </section>

    </main>
  );
}
