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
const EXT_PREFIX = "ext-url-v2";
const EXCLUDED_STORAGE_KEY = "playlist-excluded-ids-v1";

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

function generatePlaylistName(ctx: ContextData): string {
  return `${ctx.activity} • ${ctx.mood} • ${ctx.timeOfDay}`;
}

function playlistFingerprint(tracks: PlaylistItem[]): string {
  const data = tracks.map((t) => `${t.title}|${t.artist}`).sort().join("||");
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export default function HasilPage() {
  const router = useRouter();
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<number>>(new Set());
  const [excludedSongIds, setExcludedSongIds] = useState<Set<number>>(new Set());
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceMessage, setReplaceMessage] = useState<string | null>(null);

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

  // Inisialisasi playlist dari hasil
  useEffect(() => {
    if (result) {
      setPlaylist(result.playlist);
    }
  }, [result]);

  // Muat daftar lagu yang sudah pernah dibuang dari localStorage
  useEffect(() => {
    const saved = localStorage.getItem(EXCLUDED_STORAGE_KEY);
    if (saved) {
      try {
        const ids = JSON.parse(saved) as number[];
        if (Array.isArray(ids)) {
          setExcludedSongIds(new Set(ids));
        }
      } catch {
        // abaikan
      }
    }
  }, []);

  if (!result) {
    return (
      <main className={styles.fallback}>
        <h1>Data hasil belum tersedia</h1>
        <p>Mulai dari halaman awal dulu ya.</p>
        <Link href="/">Ke Beranda</Link>
      </main>
    );
  }

  const currentTotalSec = useMemo(() => playlist.reduce((sum, s) => sum + s.durationSec, 0), [playlist]);
  const overDuration = Math.max(0, currentTotalSec - result.summary.targetDurationSec);

  const fp = useMemo(() => playlistFingerprint(playlist), [playlist]);
  const extKeySpotify = `${EXT_PREFIX}-spotify-${fp}`;
  const extKeyYoutube = `${EXT_PREFIX}-youtube-${fp}`;

  const redirectToUrl = (url: string) => {
    window.location.href = url;
  };

  const openOrCreate = async (platform: "spotify" | "youtube") => {
    const extKey = platform === "spotify" ? extKeySpotify : extKeyYoutube;
    const setLoading = platform === "spotify" ? setSpotifyLoading : setYoutubeLoading;
    const endpoint = platform === "spotify" ? "/api/spotify/project-export" : "/api/youtube/project-export";
    const label = platform === "spotify" ? "Spotify" : "YouTube";

    setLoading(true);
    try {
      const cached = localStorage.getItem(extKey);
      if (cached) {
        console.log(`[${label} Export] Reuse existing ${label} playlist — ${cached}`);
        redirectToUrl(cached);
        return;
      }

      console.log(`[${label} Export] No cached URL — creating new playlist`);
      const playlistName = generatePlaylistName(result.context);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistName,
          tracks: playlist.map((s) => ({ title: s.title, artist: s.artist })),
        }),
      });
      const data = await res.json();
      if (data.status === "success" && data.publicUrl) {
        localStorage.setItem(extKey, data.publicUrl);
        console.log(`[${label} Export] Created new playlist — ${data.publicUrl}`);
        redirectToUrl(data.publicUrl);
      } else {
        alert(data.error || `Gagal export ke ${label}.`);
      }
    } catch {
      alert(`Gagal export ke ${label}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSpotify = () => openOrCreate("spotify");
  const handleExportYoutube = () => openOrCreate("youtube");

  const handleSelesai = () => {
    router.push("/");
  };

  const handleOpenHistory = (sessionId: number) => {
    setSelectedSessionId(sessionId);
  };

  const handleCloseHistory = () => {
    setSelectedSessionId(null);
  };

  const toggleSelectSong = (id: number | undefined) => {
    if (id === undefined) return;
    setSelectedSongIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBatchReplace = async () => {
    const songsToRemove = playlist.filter((s) => s.id_song !== undefined && selectedSongIds.has(s.id_song!));
    if (songsToRemove.length === 0) return;

    setIsReplacing(true);
    setReplaceMessage(null);

    const gapDurationSec = songsToRemove.reduce((sum, s) => sum + s.durationSec, 0);
    const removedIds = songsToRemove.map((s) => s.id_song!).filter(Boolean);
    const currentIds = playlist.map((s) => s.id_song!).filter(Boolean);
    const allExcluded = [...new Set([...excludedSongIds, ...removedIds])];

    const answersRaw = localStorage.getItem("playlist-questionnaire-v1");

    try {
      const res = await fetch("/api/recommendations/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excludedIds: allExcluded,
          answers: answersRaw ? JSON.parse(answersRaw) : [],
          currentPlaylistSongIds: currentIds,
          gapDurationSec,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setReplaceMessage(data.error || "Gagal mencari pengganti.");
        setIsReplacing(false);
        return;
      }

      const replacements: PlaylistItem[] = (data.replacements ?? []).map(
        (r: PlaylistItem, idx: number) => ({
          ...r,
          rank: 0,
        }),
      );

      if (replacements.length === 0) {
        setReplaceMessage("Tidak ada lagu pengganti yang cocok ditemukan.");
        setIsReplacing(false);
        return;
      }

      const keptPlaylist = playlist.filter(
        (s) => !(s.id_song !== undefined && selectedSongIds.has(s.id_song)),
      );

      const merged = [...keptPlaylist, ...replacements].sort(
        (a, b) => b.appraisalScore - a.appraisalScore,
      );

      const reRanked = merged.map((item, idx) => ({ ...item, rank: idx + 1 }));

      const newTotalSec = reRanked.reduce((sum, s) => sum + s.durationSec, 0);
      const updatedResult: ResultData = {
        ...result!,
        playlist: reRanked,
        summary: {
          ...result!.summary,
          totalDurationSec: newTotalSec,
          selectedSongs: reRanked.length,
        },
      };

      localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(updatedResult));
      localStorage.setItem(
        EXCLUDED_STORAGE_KEY,
        JSON.stringify(allExcluded),
      );

      setPlaylist(reRanked);
      setExcludedSongIds(new Set(allExcluded));
      setSelectedSongIds(new Set());
      setReplaceMessage(
        `${songsToRemove.length} lagu diganti dengan ${replacements.length} lagu baru (${(data.replacedDurationSec / 60).toFixed(0)} menit).`,
      );
    } catch {
      setReplaceMessage("Gagal memproses penggantian lagu.");
    } finally {
      setIsReplacing(false);
    }
  };

  return (
    <main className={`app-shell ${styles.page}`}>
      <MusicBackground />
      <MusicCursorTrail />

      <section className={`app-container ${styles.layout}`}>
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
            <span>Total: {formatDuration(currentTotalSec)}</span>
            <span>Lagu: {playlist.length}</span>
            <span>Kelebihan: {formatDuration(overDuration)}</span>
          </div>
        </section>

        <section className={styles.card}>
          <h2>Top playlist (ranking EDAS)</h2>
          {selectedSongIds.size > 0 && (
            <div className={styles.batchBar}>
              <span className={styles.batchInfo}>
                {selectedSongIds.size} lagu dipilih
              </span>
              <button
                type="button"
                className={styles.batchButton}
                onClick={handleBatchReplace}
                disabled={isReplacing}
              >
                {isReplacing && <span className={styles.spinner} />}
                {isReplacing ? "Memproses..." : "Ganti lagu terpilih"}
              </button>
            </div>
          )}
          {replaceMessage && (
            <p className={styles.replaceMessage}>{replaceMessage}</p>
          )}
          <ul className={styles.songList}>
            {playlist.map((song) => {
              const songId = song.id_song;
              const isSelected = songId !== undefined && selectedSongIds.has(songId);
              return (
                <li
                  key={`${song.rank}-${song.title}-${songId ?? song.durationSec}`}
                  className={isSelected ? styles.songSelected : undefined}
                  onClick={() => {
                    if (!isReplacing && songId !== undefined) {
                      toggleSelectSong(songId);
                    }
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className={styles.songCheck}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={isSelected}
                      onChange={() => {
                        if (!isReplacing) toggleSelectSong(songId);
                      }}
                      disabled={isReplacing}
                      id={`chk-${song.rank}-${songId}`}
                    />
                  </div>
                  <div>
                    <strong>#{song.rank} {song.title}</strong>
                    <p>{song.artist}</p>
                  </div>
                  <div className={styles.songMeta}>
                    <span>{formatDuration(song.durationSec)}</span>
                    <span>AS {song.appraisalScore.toFixed(4)}</span>
                  </div>
                </li>
              );
            })}
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
          <h2>Simpan ke platform musik</h2>
          <p style={{ marginBottom: 12 }}>Buka playlist hasil rekomendasi langsung di platform favoritmu.</p>

          <div className={styles.platformGrid}>
            <div className={styles.platformCard}>
              <div className={styles.platformHeader}>
                <span className={styles.platformIcon}>🎧</span>
                <span className={styles.platformName}>Spotify</span>
              </div>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleExportSpotify}
                disabled={spotifyLoading}
              >
                {spotifyLoading && <span className={styles.spinner} />}
                {spotifyLoading ? "Membuka playlist..." : "Buka di Spotify"}
              </button>
            </div>

            <div className={styles.platformCard}>
              <div className={styles.platformHeader}>
                <span className={styles.platformIcon}>▶️</span>
                <span className={styles.platformName}>YouTube</span>
              </div>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleExportYoutube}
                disabled={youtubeLoading}
              >
                {youtubeLoading && <span className={styles.spinner} />}
                {youtubeLoading ? "Membuka playlist..." : "Buka di YouTube"}
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
