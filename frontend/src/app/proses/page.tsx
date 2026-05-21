"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import { getOrCreateClientId } from "@/lib/clientId";
import {
  PLAYLIST_CONTEXT_STORAGE_KEY,
  PLAYLIST_QUESTIONNAIRE_STORAGE_KEY,
  PLAYLIST_RESULT_STORAGE_KEY,
  isPlaylistFlowFinished,
} from "@/lib/playlistFlow";
import { buildPreferenceInterpretation, type PreferenceInterpretation } from "@/server/utils/preferenceSummary";
import styles from "./page.module.css";

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

type ResultPreferenceSummary = PreferenceInterpretation & {
  narrativeText: string;
  narrativeMeta: NlgMeta;
};

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} dan ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, dan ${items[items.length - 1]}`;
}

function buildFallbackNarration(
  context: ContextData,
  playlist: PlaylistItem[],
  preferenceSummary: PreferenceInterpretation["narrativeSummary"],
): string {
  const totalSec = playlist.reduce((sum, item) => sum + item.durationSec, 0);
  const totalMinutes = Math.max(0, Math.round(totalSec / 60));
  const activity = context.activity || "aktivitas";
  const timeOfDay = context.timeOfDay || "waktu yang dipilih";
  const mood = context.mood || "netral";

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

  return (
    `Untuk sesi ${activity} pada ${timeOfDay} dengan suasana saat ini ${mood}, jawaban kuesionermu menunjukkan kecenderungan ke ${primaryText}.${secondaryText}${avoidText} ` +
    "Karena itu, playlist ini dipilih dari lagu-lagu yang tingkat kecocokannya paling tinggi dengan kebutuhan sesi ini, sehingga hasilnya tidak terasa dipilih secara acak. " +
    `Dengan total durasi sekitar ${totalMinutes} menit, playlist ini disusun agar tetap terasa nyambung dan relevan untuk menemani sesi yang kamu pilih.`
  )
    .replace(/\s+/g, " ")
    .trim();
}

function buildFallbackPreferenceNarrative(preferenceSummary: PreferenceInterpretation): string {
  const topAspects = preferenceSummary.aspects.slice(0, 3);
  if (topAspects.length === 0) {
    return "Dari jawaban kuesioner Anda, sistem membaca preferensi musik secara cukup seimbang. Ringkasan ini tetap dapat digunakan sebagai acuan saat mengisi evaluasi UAT.";
  }

  const [first, second, third] = topAspects;
  const firstSentence = `${first.title} menjadi salah satu aspek yang ${first.priorityLabel}, dengan kontribusi sekitar ${first.contributionPercent.toFixed(1)}%.`;
  const secondSentence = second
    ? `${second.title} juga ikut dibaca sebagai ${second.preferenceDirection}.`
    : "Sistem memakai pembacaan ini untuk menentukan karakter lagu yang lebih sesuai.";
  const thirdSentence = third
    ? `${third.title} berada di posisi ${third.criterionLabel}, sehingga sistem tidak memilih lagu secara acak.`
    : "Pembacaan ini membantu sistem menyusun rekomendasi yang lebih selaras dengan jawaban Anda.";

  return `${firstSentence} ${secondSentence} ${thirdSentence} Ringkasan ini bisa digunakan sebagai acuan saat mengisi evaluasi UAT.`
    .replace(/\s+/g, " ")
    .trim();
}

async function generateNlgText(
  context: ContextData,
  playlist: PlaylistItem[],
  preferenceSummary: PreferenceInterpretation["narrativeSummary"],
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

async function generatePreferenceNarrative(
  preferenceSummary: PreferenceInterpretation,
): Promise<{ text: string; meta: NlgMeta }> {
  const fallback = buildFallbackPreferenceNarrative(preferenceSummary);

  try {
    const response = await fetchWithTimeout(
      "/api/preference-summary/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aspects: preferenceSummary.aspects,
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
        fallbackUsed?: boolean;
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
          reason: payload.meta?.reason ?? "preference_summary_failed",
        },
      };
    }

    return {
      text: payload.text.trim(),
      meta: {
        source: payload.meta?.source ?? "gemini",
        model: payload.meta?.model,
        fallbackUsed: Boolean(payload.meta?.fallbackUsed),
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

async function saveRecommendation(
  clientId: string,
  context: ContextData,
  answers: Record<number, number>,
  playlist: PlaylistItem[],
): Promise<number | undefined> {
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

  const res = await fetch("/api/recommendations/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  return data?.id_session ? Number(data.id_session) : undefined;
}

const STATUS_LABELS: Record<number, string> = {
  0: "Membaca konteks aktivitas...",
  1: "Mengonversi jawaban jadi preferensi...",
  2: "Mengambil daftar lagu...",
  3: "Memproses EDAS...",
  4: "Menyusun playlist...",
  5: "Menyusun penjelasan preferensi...",
  6: "Menyusun penjelasan rekomendasi...",
};

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
    if (isPlaylistFlowFinished()) {
      router.replace("/");
      return;
    }
    getOrCreateClientId();
  }, [router]);

  useEffect(() => {
    isMountedRef.current = true;
    const runId = ++runIdRef.current;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;
    let nlgStatusTimer: ReturnType<typeof setTimeout> | undefined;

    if (isPlaylistFlowFinished()) {
      router.replace("/");
      return undefined;
    }

    const contextRaw = localStorage.getItem(PLAYLIST_CONTEXT_STORAGE_KEY);
    const answersRaw = localStorage.getItem(PLAYLIST_QUESTIONNAIRE_STORAGE_KEY);

    if (!contextRaw || !answersRaw) {
      router.replace("/");
      return undefined;
    }

    const context = JSON.parse(contextRaw) as ContextData;
    const answers = JSON.parse(answersRaw) as Record<number, number>;
    const preferenceSummary = buildPreferenceInterpretation(answers);
    const requestKey = `${context.durationMinutes}::${answersRaw}`;

    const runFlow = async () => {
      try {
        setCurrentStep(0);
        setProgress(12);

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
        const fallbackNarration = buildFallbackNarration(
          context,
          playlist,
          preferenceSummary.narrativeSummary,
        );
        const fallbackPreferenceNarration = buildFallbackPreferenceNarrative(preferenceSummary);
        const fallbackMeta: NlgMeta = {
          source: "fallback-local",
          model: undefined,
          fallbackUsed: true,
          reason: "not_generated_yet",
        };

        const savedSessionId = await saveRecommendation(
          getOrCreateClientId(),
          context,
          answers,
          playlist,
        ).catch(() => undefined);

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
          preferenceSummary: {
            ...preferenceSummary,
            narrativeText: fallbackPreferenceNarration,
            narrativeMeta: fallbackMeta,
          } satisfies ResultPreferenceSummary,
          id_session: savedSessionId,
        };

        localStorage.setItem(PLAYLIST_RESULT_STORAGE_KEY, JSON.stringify(resultPayload));
        setCurrentStep(4);
        setProgress(70);
        setNlgStatusText("Ringkasan preferensi sedang disusun.");

        nlgStatusTimer = setTimeout(() => {
          if (!isMountedRef.current || runId !== runIdRef.current) return;
          setNlgStatusText("Masih mencoba menyusun ringkasan terbaik...");
        }, 15000);

        const preferenceNarrative = await generatePreferenceNarrative(preferenceSummary);
        if (!isMountedRef.current || runId !== runIdRef.current) return;

        const intermediatePayload = {
          ...resultPayload,
          preferenceSummary: {
            ...preferenceSummary,
            narrativeText: preferenceNarrative.text,
            narrativeMeta: preferenceNarrative.meta,
          } satisfies ResultPreferenceSummary,
        };

        localStorage.setItem(PLAYLIST_RESULT_STORAGE_KEY, JSON.stringify(intermediatePayload));
        setCurrentStep(5);
        setProgress(84);
        setNlgStatusText("Penjelasan rekomendasi sedang disusun.");

        const nlgResult = await generateNlgText(
          context,
          playlist,
          preferenceSummary.narrativeSummary,
        );
        if (!isMountedRef.current || runId !== runIdRef.current) return;

        if (nlgStatusTimer) clearTimeout(nlgStatusTimer);
        setNlgStatusText("");

        const finalPayload = {
          ...intermediatePayload,
          nlgText: nlgResult.text,
          nlgMeta: nlgResult.meta,
        };

        localStorage.setItem(PLAYLIST_RESULT_STORAGE_KEY, JSON.stringify(finalPayload));
        setCurrentStep(6);
        setProgress(100);

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
  }, [router]);

  const statusText = nlgStatusText || STATUS_LABELS[currentStep] || "";

  return (
    <main className={`app-shell ${styles.page}`}>
      <MusicBackground />
      <MusicCursorTrail />

      <section className={`app-container ${styles.card}`}>
        <h1>Menyusun playlist terbaik untukmu</h1>
        <p className={styles.desc}>
          Sistem sedang menganalisis preferensi musikmu, memeringkat lagu, dan menyiapkan penjelasan rekomendasi.
        </p>

        <div className={styles.progressWrap}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.percentLabel}>{Math.min(progress, 100)}%</span>

        {statusText && <p className={styles.statusText}>{statusText}</p>}

        <p className={styles.note}>Kamu akan diarahkan otomatis ke halaman hasil.</p>
        <p className={styles.previewTime}>
          Proses ini biasanya selesai dalam beberapa detik hingga kurang dari satu menit.
        </p>
      </section>
    </main>
  );
}
