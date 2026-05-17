"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import { getOrCreateClientId } from "@/lib/clientId";
import styles from "./page.module.css";

const RESULT_STORAGE_KEY = "playlist-result-v1";

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

// Format durasi ke mm:ss
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function HasilPage() {
  const router = useRouter();
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // Ambil hasil rekomendasi dari localStorage
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
  }, []);

  // Ambil status koneksi Spotify/YouTube dan riwayat rekomendasi
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

  // Status koneksi Spotify/YouTube tidak perlu dicek —
  // server menggunakan token project akun tetap (kalskripdas@gmail.com).

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

  // Export playlist ke Spotify via project account server-side
  const handleExportSpotify = async () => {
    setSpotifyLoading(true);
    try {
      const res = await fetch("/api/spotify/project-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: result.playlist.map((s) => ({ title: s.title, artist: s.artist })),
        }),
      });
      const data = await res.json();
      if (data.status === "success" && data.publicUrl) {
        globalThis.open(data.publicUrl, "_blank", "noopener,noreferrer");
      } else {
        alert(data.error || "Gagal export ke Spotify.");
      }
    } catch {
      alert("Gagal export ke Spotify.");
    } finally {
      setSpotifyLoading(false);
    }
  };

  // Export playlist ke YouTube via project account server-side
  const handleExportYoutube = async () => {
    setYoutubeLoading(true);
    try {
      const res = await fetch("/api/youtube/project-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: result.playlist.map((s) => ({ title: s.title, artist: s.artist })),
        }),
      });
      const data = await res.json();
      if (data.status === "success" && data.publicUrl) {
        globalThis.open(data.publicUrl, "_blank", "noopener,noreferrer");
      } else {
        alert(data.error || "Gagal export ke YouTube.");
      }
    } catch {
      alert("Gagal export ke YouTube.");
    } finally {
      setYoutubeLoading(false);
    }
  };

  const handleSelesai = () => {
    router.push("/");
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
          <h2>Buka playlist di platform eksternal</h2>

          <div className={styles.platformBlock}>
            <h3>Spotify</h3>
            <div className={styles.experimentActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleExportSpotify}
                disabled={spotifyLoading}
              >
                {spotifyLoading ? "Membuka playlist..." : "Buka playlist di Spotify"}
              </button>
            </div>
          </div>

          <div className={styles.platformBlock}>
            <h3>YouTube</h3>
            <div className={styles.experimentActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleExportYoutube}
                disabled={youtubeLoading}
              >
                {youtubeLoading ? "Membuka playlist..." : "Buka playlist di YouTube"}
              </button>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h2>Selesai</h2>
          <p>Kembali ke beranda untuk memulai rekomendasi baru.</p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSelesai}
            style={{ marginTop: 8 }}
          >
            Kembali ke beranda
          </button>
        </section>
      </section>
    </main>
  );
}
