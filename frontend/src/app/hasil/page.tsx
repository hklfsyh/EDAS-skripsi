"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import styles from "./page.module.css";

const RESULT_STORAGE_KEY = "playlist-result-v1";
const TRANSFER_SESSION_STORAGE_KEY = "playlist-transfer-session-v1";
const EVALUATION_STORAGE_KEY = "playlist-evaluation-v1";
const THEME_STORAGE_KEY = "playlist-theme-v1";

type ContextData = {
  activity: string;
  timeOfDay: string;
  mood: string;
  durationMinutes: number;
};

type PlaylistItem = {
  rank: number;
  title: string;
  artist: string;
  durationSec: number;
  appraisalScore: number;
};

type ResultData = {
  context: ContextData;
  playlist: PlaylistItem[];
  summary: {
    targetDurationSec: number;
    totalDurationSec: number;
    selectedSongs: number;
  };
  nlgText: string;
};

type TransferTrack = {
  title: string;
  artist: string;
};

type TransferSessionData = {
  id: string;
  target: "spotify";
  stage: "draft" | "target-connected" | "transferring" | "done" | "failed";
  spotifyConnected: boolean;
  playlistName: string;
  tracks: TransferTrack[];
  updatedAt: string;
  errorMessage?: string;
  transferResult?: {
    playlistUrl?: string | null;
    totalAdded: number;
    totalRequested: number;
  };
};

type SpotifyStatusResponse = {
  connected: boolean;
  hasRequiredScopes?: boolean;
};

function getDefaultTransferSession(result: ResultData): TransferSessionData {
  return {
    id: crypto.randomUUID(),
    target: "spotify",
    stage: "draft",
    spotifyConnected: false,
    playlistName: `EDAS Dummy ${new Date().toLocaleDateString("id-ID")}`,
    tracks: result.playlist.map((song) => ({
      title: song.title,
      artist: song.artist,
    })),
    updatedAt: new Date().toISOString(),
  };
}

function loadTransferSession(result: ResultData): TransferSessionData {
  const raw = sessionStorage.getItem(TRANSFER_SESSION_STORAGE_KEY);
  if (!raw) {
    return getDefaultTransferSession(result);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TransferSessionData>;
    const fallback = getDefaultTransferSession(result);

    const tracks =
      Array.isArray(parsed.tracks) && parsed.tracks.length > 0
        ? parsed.tracks
            .filter((item) => item?.title?.trim() && item?.artist?.trim())
            .map((item) => ({
              title: item.title.trim(),
              artist: item.artist.trim(),
            }))
        : fallback.tracks;

    return {
      id: parsed.id || fallback.id,
      target: "spotify",
      stage: parsed.stage ?? fallback.stage,
      spotifyConnected: Boolean(parsed.spotifyConnected),
      playlistName: parsed.playlistName?.trim() || fallback.playlistName,
      tracks,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      errorMessage: parsed.errorMessage,
      transferResult: parsed.transferResult,
    };
  } catch {
    return getDefaultTransferSession(result);
  }
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function HasilPage() {
  const router = useRouter();
  const [usability, setUsability] = useState(4);
  const [understanding, setUnderstanding] = useState(4);
  const [comment, setComment] = useState("");
  const [transferSession, setTransferSession] = useState<TransferSessionData | null>(null);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyMessage, setSpotifyMessage] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "dark");
  }, []);

  const result = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw =
      sessionStorage.getItem(RESULT_STORAGE_KEY) ??
      localStorage.getItem(RESULT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResultData;
    sessionStorage.setItem(RESULT_STORAGE_KEY, raw);
    localStorage.removeItem(RESULT_STORAGE_KEY);
    return parsed;
  }, []);

  useEffect(() => {
    if (!result) return;

    const current = loadTransferSession(result);
    sessionStorage.setItem(TRANSFER_SESSION_STORAGE_KEY, JSON.stringify(current));
    setTransferSession(current);

    const params = new URLSearchParams(window.location.search);
    const spotifyStatus = params.get("spotify");
    const reason = params.get("reason");

    if (spotifyStatus === "success") {
      setSpotifyMessage("Target Spotify berhasil dihubungkan. Lanjut klik Mulai transfer.");
    } else if (spotifyStatus === "error") {
      setSpotifyMessage(`Gagal menghubungkan Spotify${reason ? ` (${reason})` : ""}.`);
    }

    void fetch("/api/spotify/status")
      .then((response) => response.json() as Promise<SpotifyStatusResponse>)
      .then((payload) => {
        const isConnected = Boolean(payload.connected && payload.hasRequiredScopes !== false);
        setTransferSession((prev) => {
          if (!prev) return prev;

          const nextStage =
            isConnected && (prev.stage === "draft" || prev.stage === "failed")
              ? "target-connected"
              : prev.stage;

          const next: TransferSessionData = {
            ...prev,
            spotifyConnected: isConnected,
            stage: nextStage,
            updatedAt: new Date().toISOString(),
          };

          sessionStorage.setItem(TRANSFER_SESSION_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      })
      .catch(() => {
        setTransferSession((prev) => {
          if (!prev) return prev;
          const next: TransferSessionData = {
            ...prev,
            spotifyConnected: false,
            updatedAt: new Date().toISOString(),
          };
          sessionStorage.setItem(TRANSFER_SESSION_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      });
  }, [result]);

  if (!result) {
    return (
      <main className={styles.fallback}>
        <h1>Data hasil belum tersedia</h1>
        <p>Mulai dari halaman awal dulu ya.</p>
        <Link href="/">Ke Beranda</Link>
      </main>
    );
  }

  const overDuration = Math.max(0, result.summary.totalDurationSec - result.summary.targetDurationSec);

  const handleConnectSpotify = () => {
    window.location.href = "/api/spotify/login";
  };

  const handleStartTransfer = async () => {
    if (!transferSession) {
      setSpotifyMessage("Data transfer sesi tidak ditemukan. Kembali ke proses rekomendasi dulu.");
      return;
    }

    setSpotifyLoading(true);
    setSpotifyMessage("Transfer dimulai: membuat playlist dan menambahkan lagu ke Spotify...");

    const transferringState: TransferSessionData = {
      ...transferSession,
      stage: "transferring",
      errorMessage: undefined,
      updatedAt: new Date().toISOString(),
    };

    setTransferSession(transferringState);
    sessionStorage.setItem(TRANSFER_SESSION_STORAGE_KEY, JSON.stringify(transferringState));

    try {
      const exportResponse = await fetch("/api/spotify/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playlistName: transferSession.playlistName,
          tracks: transferSession.tracks,
        }),
      });

      const payload = (await exportResponse.json()) as {
        playlistUrl?: string | null;
        totalAdded?: number;
        totalRequested?: number;
        error?: string;
      };

      if (!exportResponse.ok) {
        throw new Error(payload.error ?? "Export ke Spotify gagal.");
      }

      const added = payload.totalAdded ?? 0;
      const requested = payload.totalRequested ?? 0;

      const successState: TransferSessionData = {
        ...transferSession,
        stage: "done",
        spotifyConnected: true,
        transferResult: {
          playlistUrl: payload.playlistUrl ?? null,
          totalAdded: added,
          totalRequested: requested,
        },
        errorMessage: undefined,
        updatedAt: new Date().toISOString(),
      };

      setTransferSession(successState);
      sessionStorage.setItem(TRANSFER_SESSION_STORAGE_KEY, JSON.stringify(successState));

      if (payload.playlistUrl) {
        setSpotifyMessage(`Transfer selesai. ${added}/${requested} lagu ditambahkan. Klik tombol buka playlist.`);
      } else {
        setSpotifyMessage(`Transfer selesai. Lagu ditambahkan: ${added}/${requested}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export ke Spotify gagal.";
      const failedState: TransferSessionData = {
        ...transferSession,
        stage: "failed",
        errorMessage: message,
        updatedAt: new Date().toISOString(),
      };

      setTransferSession(failedState);
      sessionStorage.setItem(TRANSFER_SESSION_STORAGE_KEY, JSON.stringify(failedState));
      setSpotifyMessage(message);
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      usability,
      understanding,
      comment,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(EVALUATION_STORAGE_KEY, JSON.stringify(payload));
    router.push("/selesai");
  };

  return (
    <main className={styles.page}>
      <MusicBackground />
      <MusicCursorTrail />

      <section className={styles.layout}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.backLink}>← Kembali ke beranda</Link>
          <span className={styles.badge}>Hasil Dummy UI/UX</span>
        </header>

        <section className={styles.card}>
          <h1>Hasil rekomendasi playlist</h1>
          <p>
            Konteks: <strong>{result.context.activity}</strong> · {result.context.timeOfDay} · mood {result.context.mood}
          </p>

          <div className={styles.metrics}>
            <span>Target: {formatDuration(result.summary.targetDurationSec)}</span>
            <span>Total: {formatDuration(result.summary.totalDurationSec)}</span>
            <span>Lagu: {result.summary.selectedSongs}</span>
            <span>Kelebihan: {formatDuration(overDuration)}</span>
          </div>
        </section>

        <section className={styles.card}>
          <h2>Top playlist (simulasi ranking EDAS)</h2>
          <ul className={styles.songList}>
            {result.playlist.map((song) => (
              <li key={`${song.rank}-${song.title}`}>
                <div>
                  <strong>#{song.rank} {song.title}</strong>
                  <p>{song.artist}</p>
                </div>
                <div className={styles.songMeta}>
                  <span>{formatDuration(song.durationSec)}</span>
                  <span>AS {song.appraisalScore.toFixed(4)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.card}>
          <h2>Penjelasan rekomendasi (NLG dummy)</h2>
          <p className={styles.nlgText}>{result.nlgText}</p>
        </section>

        <section className={styles.card}>
          <h2>Transfer ke Spotify (mode sesi)</h2>
          <p className={styles.experimentText}>
            Alur: simpan hasil sesi → pilih target Spotify → mulai transfer → buka playlist hasil transfer.
          </p>

          {transferSession && (
            <div className={styles.metrics}>
              <span>Sesi: {transferSession.id.slice(0, 8)}</span>
              <span>Target: Spotify</span>
              <span>Status: {transferSession.stage}</span>
            </div>
          )}

          <div className={styles.experimentActions}>
            {!transferSession?.spotifyConnected ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleConnectSpotify}
              >
                Pilih Target Spotify & Hubungkan Akun
              </button>
            ) : (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleStartTransfer}
                disabled={spotifyLoading}
              >
                {spotifyLoading ? "Transfer berlangsung..." : "Mulai Transfer"}
              </button>
            )}

            {transferSession?.stage === "done" && transferSession.transferResult?.playlistUrl && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  window.open(transferSession.transferResult?.playlistUrl ?? "", "_blank", "noopener,noreferrer")
                }
              >
                Buka Playlist di Spotify
              </button>
            )}
          </div>

          {spotifyMessage && (
            <p className={styles.experimentMessage}>{spotifyMessage}</p>
          )}
        </section>

        <section className={styles.card}>
          <h2>Evaluasi singkat (dummy usability)</h2>
          <form className={styles.form} onSubmit={handleSubmit}>
            <label>
              Seberapa mudah UI digunakan? ({usability}/5)
              <input
                type="range"
                min={1}
                max={5}
                value={usability}
                onChange={(e) => setUsability(Number(e.target.value))}
              />
            </label>

            <label>
              Seberapa jelas penjelasan rekomendasinya? ({understanding}/5)
              <input
                type="range"
                min={1}
                max={5}
                value={understanding}
                onChange={(e) => setUnderstanding(Number(e.target.value))}
              />
            </label>

            <label>
              Komentar tambahan
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tulis masukan untuk iterasi berikutnya..."
              />
            </label>

            <button type="submit">Selesai & Simpan Evaluasi</button>
          </form>
        </section>
      </section>
    </main>
  );
}
