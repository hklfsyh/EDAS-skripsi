"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import { getOrCreateClientId } from "@/lib/clientId";
import styles from "./page.module.css";

const RESULT_STORAGE_KEY = "playlist-result-v1";
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
  id_song?: number;
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
  nlgMeta?: {
    source?: string;
    model?: string;
    fallbackUsed?: boolean;
    reason?: string | null;
  };
};

type HistorySong = {
  id_song: number;
  title: string;
  artist: string;
  rank_order: number;
  appraisal_score: number;
};

type HistorySession = {
  id_session: number;
  activity: string;
  time_category: string;
  mood: string;
  duration_target: number;
  created_at: string;
  songs: HistorySong[];
};

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
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyMessage, setSpotifyMessage] = useState<string | null>(() => {
    const params = new URLSearchParams(globalThis.location?.search ?? "");
    const spotifyStatus = params.get("spotify");
    const reason = params.get("reason");

    if (spotifyStatus === "success") {
      return "Spotify berhasil terhubung.";
    }

    if (spotifyStatus === "error") {
      const reasonText = reason ? ` (${reason})` : "";
      return `Gagal menghubungkan Spotify${reasonText}.`;
    }

    return null;
  });
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeMessage, setYoutubeMessage] = useState<string | null>(() => {
    const params = new URLSearchParams(globalThis.location?.search ?? "");
    const youtubeStatus = params.get("youtube");
    const youtubeReason = params.get("yt_reason");

    if (youtubeStatus === "success") {
      return "YouTube berhasil terhubung.";
    }

    if (youtubeStatus === "error") {
      const reasonText = youtubeReason ? ` (${youtubeReason})` : "";
      return `Gagal menghubungkan YouTube${reasonText}.`;
    }

    return null;
  });
  const [historyItems, setHistoryItems] = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
  }, []);

  useEffect(() => {
    const clientId = getOrCreateClientId();
    void fetch(`/api/recommendations/history?clientId=${encodeURIComponent(clientId)}`)
      .then((response) => response.json() as Promise<{ history: HistorySession[]; error?: string }>)
      .then((payload) => {
        setHistoryItems(payload.history ?? []);
        if (payload.error) {
          setHistoryError(payload.error);
        }
      })
      .catch(() => {
        setHistoryError("Gagal memuat riwayat rekomendasi.");
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  }, []);

  useEffect(() => {
    void fetch("/api/spotify/status")
      .then((response) => response.json() as Promise<{ connected: boolean }>)
      .then((payload) => {
        setSpotifyConnected(Boolean(payload.connected));
      })
      .catch(() => {
        setSpotifyConnected(false);
      });

    void fetch("/api/youtube/status")
      .then((response) => response.json() as Promise<{ connected: boolean }>)
      .then((payload) => {
        setYoutubeConnected(Boolean(payload.connected));
      })
      .catch(() => {
        setYoutubeConnected(false);
      });
  }, []);

  const result = useMemo(() => {
    if (globalThis.window === undefined) return null;
    const raw = localStorage.getItem(RESULT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ResultData;
  }, []);

  const selectedSession = useMemo(
    () => historyItems.find((session) => session.id_session === selectedSessionId) ?? null,
    [historyItems, selectedSessionId],
  );

  const showNlgDebug =
    process.env.NEXT_PUBLIC_NLG_DEBUG === "true" || process.env.NODE_ENV !== "production";

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
    globalThis.location.href = "/api/spotify/login";
  };

  const handleExportSpotify = async () => {
    setSpotifyLoading(true);
    setSpotifyMessage("Sedang membuat playlist di Spotify...");

    try {
      const exportResponse = await fetch("/api/spotify/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playlistName: `EDAS Dummy ${new Date().toLocaleDateString("id-ID")}`,
          tracks: result.playlist.map((song) => ({
            title: song.title,
            artist: song.artist,
          })),
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

      if (payload.playlistUrl) {
        setSpotifyMessage(`Berhasil! ${added}/${requested} lagu ditambahkan. Membuka playlist Spotify...`);
        globalThis.open(payload.playlistUrl, "_blank", "noopener,noreferrer");
      } else {
        setSpotifyMessage(`Berhasil membuat playlist. Lagu ditambahkan: ${added}/${requested}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export ke Spotify gagal.";
      setSpotifyMessage(message);
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleConnectYoutube = () => {
    globalThis.location.href = "/api/youtube/login";
  };

  const handleExportYoutube = async () => {
    setYoutubeLoading(true);
    setYoutubeMessage("Sedang membuat playlist di YouTube...");

    try {
      const exportResponse = await fetch("/api/youtube/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playlistName: `EDAS Dummy ${new Date().toLocaleDateString("id-ID")}`,
          tracks: result.playlist.map((song) => ({
            title: song.title,
            artist: song.artist,
          })),
        }),
      });

      const payload = (await exportResponse.json()) as {
        playlistUrl?: string | null;
        totalAdded?: number;
        totalRequested?: number;
        error?: string;
      };

      if (!exportResponse.ok) {
        throw new Error(payload.error ?? "Export ke YouTube gagal.");
      }

      const added = payload.totalAdded ?? 0;
      const requested = payload.totalRequested ?? 0;

      if (payload.playlistUrl) {
        setYoutubeMessage(`Berhasil! ${added}/${requested} video ditambahkan. Membuka playlist YouTube...`);
        globalThis.open(payload.playlistUrl, "_blank", "noopener,noreferrer");
      } else {
        setYoutubeMessage(`Berhasil membuat playlist YouTube. Video ditambahkan: ${added}/${requested}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export ke YouTube gagal.";
      setYoutubeMessage(message);
    } finally {
      setYoutubeLoading(false);
    }
  };

  const handleSubmit: React.ComponentProps<"form">["onSubmit"] = (event) => {
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

  const handleOpenHistory = (sessionId: number) => {
    setSelectedSessionId(sessionId);
  };

  const handleCloseHistory = () => {
    setSelectedSessionId(null);
  };

  return (
    <main className={styles.page}>
      <MusicBackground />
      <MusicCursorTrail />

      <section className={styles.layout}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.backLink}>← Kembali ke beranda</Link>
          <span className={styles.badge}>Hasil Rekomendasi</span>
        </header>

        <section className={styles.card}>
          <h1>Hasil rekomendasi playlist</h1>
          <p>
            Konteks: <strong>{result.context.activity}</strong> · {result.context.timeOfDay} · suasana saat ini {result.context.mood}
          </p>

          <div className={styles.metrics}>
            <span>Target: {formatDuration(result.summary.targetDurationSec)}</span>
            <span>Total: {formatDuration(result.summary.totalDurationSec)}</span>
            <span>Lagu: {result.summary.selectedSongs}</span>
            <span>Kelebihan: {formatDuration(overDuration)}</span>
          </div>
        </section>

        <section className={styles.card}>
          <h2>Top playlist (ranking EDAS)</h2>
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
          <h2>Penjelasan rekomendasi</h2>
          <p className={styles.nlgText}>{result.nlgText}</p>
          {showNlgDebug && result.nlgMeta && (
            <div className={styles.nlgMeta}>
              <span className={styles.nlgBadge}>Source: {result.nlgMeta.source ?? "unknown"}</span>
              {result.nlgMeta.model && (
                <span className={styles.nlgBadge}>Model: {result.nlgMeta.model}</span>
              )}
              {typeof result.nlgMeta.fallbackUsed === "boolean" && (
                <span className={styles.nlgBadge}>
                  Fallback: {result.nlgMeta.fallbackUsed ? "yes" : "no"}
                </span>
              )}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <h2>Riwayat rekomendasi terbaru</h2>
          {historyLoading && <p>Memuat riwayat...</p>}
          {!historyLoading && historyError && <p>{historyError}</p>}
          {!historyLoading && !historyError && historyItems.length === 0 && (
            <p>Belum ada riwayat rekomendasi untuk perangkat ini.</p>
          )}
          {!historyLoading && !historyError && historyItems.length > 0 && (
            <ul className={styles.historyList}>
              {historyItems.map((session) => (
                <li key={session.id_session} className={styles.historyItem}>
                  <button
                    type="button"
                    className={styles.historyButton}
                    onClick={() => handleOpenHistory(session.id_session)}
                  >
                    <div className={styles.historyTitle}>
                      <span>
                        <strong>{session.activity}</strong> · {session.time_category} · suasana saat ini {session.mood}
                      </span>
                      <span className={styles.historyAction}>Lihat detail</span>
                    </div>
                    <div className={styles.historyMeta}>
                      <span>Target {formatDuration(session.duration_target * 60)}</span>
                      <span>{new Date(session.created_at).toLocaleString("id-ID")}</span>
                    </div>
                    {session.songs.length > 0 && (
                      <div className={styles.historyPreview}>
                        {session.songs.slice(0, 3).map((song) => (
                          <span key={`${session.id_session}-${song.id_song}-${song.rank_order}`}>
                            #{song.rank_order} {song.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selectedSession && (
          <div className={styles.historyOverlay}>
            <button
              type="button"
              className={styles.historyBackdrop}
              onClick={handleCloseHistory}
              aria-label="Tutup detail riwayat"
            />
            <dialog open className={styles.historyModal} onCancel={handleCloseHistory}>
              <header className={styles.historyModalHeader}>
                <h3>Detail riwayat rekomendasi</h3>
                <button type="button" className={styles.historyCloseButton} onClick={handleCloseHistory}>
                  Tutup
                </button>
              </header>
              <div className={styles.historyModalBody}>
                <p className={styles.historyContext}>
                  <strong>{selectedSession.activity}</strong> · {selectedSession.time_category} · suasana saat ini {selectedSession.mood}
                </p>
                <div className={styles.historyModalMeta}>
                  <span>Target {formatDuration(selectedSession.duration_target * 60)}</span>
                  <span>{new Date(selectedSession.created_at).toLocaleString("id-ID")}</span>
                </div>
                <ul className={styles.historyModalList}>
                  {selectedSession.songs.map((song) => (
                    <li key={`${selectedSession.id_session}-${song.id_song}-${song.rank_order}`}>
                      <span>#{song.rank_order}</span>
                      <span>{song.title}</span>
                      <span>{song.artist}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </dialog>
          </div>
        )}

        <section className={styles.card}>
          <h2>Putar di platform eksternal (opsional)</h2>
          <p className={styles.experimentText}>
            Fitur ini membantu membuka playlist di platform eksternal tanpa mengubah alur utama skripsi.
          </p>

          <div className={styles.platformBlock}>
            <h3>Spotify</h3>
            <div className={styles.experimentActions}>
              {spotifyConnected ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleExportSpotify}
                  disabled={spotifyLoading}
                >
                  {spotifyLoading ? "Memproses..." : "Buka playlist di Spotify"}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleConnectSpotify}
                >
                  Aktifkan akses Spotify
                </button>
              )}
            </div>
            {spotifyMessage && (
              <p className={styles.experimentMessage}>{spotifyMessage}</p>
            )}
          </div>

          <div className={styles.platformBlock}>
            <h3>YouTube</h3>
            <div className={styles.experimentActions}>
              {youtubeConnected ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleExportYoutube}
                  disabled={youtubeLoading}
                >
                  {youtubeLoading ? "Memproses..." : "Buka playlist di YouTube"}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleConnectYoutube}
                >
                  Aktifkan akses YouTube
                </button>
              )}
            </div>
            {youtubeMessage && (
              <p className={styles.experimentMessage}>{youtubeMessage}</p>
            )}
          </div>
        </section>

        <section className={styles.card}>
          <h2>Evaluasi singkat</h2>
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

            <label htmlFor="evaluation-comment">
              Komentar tambahan
            </label>
            <textarea
              id="evaluation-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tulis masukan untuk iterasi berikutnya..."
            />

            <button type="submit">Selesai & Simpan Evaluasi</button>
          </form>
        </section>
      </section>
    </main>
  );
}
