"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import { getOrCreateClientId } from "@/lib/clientId";
import {
  PLAYLIST_EXCLUDED_IDS_STORAGE_KEY,
  PLAYLIST_QUESTIONNAIRE_STORAGE_KEY,
  PLAYLIST_RESULT_STORAGE_KEY,
  isPlaylistFlowFinished,
  markPlaylistFlowFinished,
} from "@/lib/playlistFlow";
import styles from "./page.module.css";

// Kunci localStorage untuk tema dan cache URL export
const THEME_STORAGE_KEY = "playlist-theme-v1";
const EXT_PREFIX = "ext-url-v2";

// ContextData — tipe data konteks aktivitas dari localStorage
type ContextData = {
  activity: string;
  timeOfDay: string;
  mood: string;
  durationMinutes: number;
};

// PlaylistItem — tipe data satu lagu dalam playlist rekomendasi
type PlaylistItem = {
  rank: number;
  id_song?: number;
  title: string;
  artist: string;
  durationSec: number;
  appraisalScore: number;
};

// ResultData — tipe data hasil rekomendasi lengkap (konteks, playlist, NLG)
type ResultData = {
  id_session?: number;
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

// HistorySong — tipe data lagu dalam riwayat sesi (dari database)
type HistorySong = {
  id_song: number;
  title: string;
  artist: string;
  rank_order: number;
  appraisal_score: number;
};

// HistorySession — tipe data sesi riwayat lengkap (dari database)
type HistorySession = {
  id_session: number;
  activity: string;
  time_category: string;
  mood: string;
  duration_target: number;
  created_at: string;
  songs: HistorySong[];
  spotify_playlist_url: string | null;
  spotify_playlist_title: string | null;
  spotify_exported_at: string | null;
  youtube_playlist_url: string | null;
  youtube_playlist_title: string | null;
  youtube_exported_at: string | null;
};

// formatDuration — konversi detik ke format menit:detik
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// generatePlaylistName — buat nama playlist dari konteks aktivitas
function generatePlaylistName(ctx: ContextData): string {
  return `${ctx.activity} \u2022 ${ctx.mood} \u2022 ${ctx.timeOfDay}`;
}

// playlistFingerprint — hash sederhana dari daftar lagu untuk cache URL export
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

// HasilPage — halaman hasil rekomendasi dengan 3 step (ringkasan, playlist, export)
export default function HasilPage() {
  const router = useRouter();
  // State loading export Spotify/YouTube
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  // State riwayat sesi dari database
  const [historyItems, setHistoryItems] = useState<HistorySession[]>([]);
  const [, setHistoryLoading] = useState(true);
  const [, setHistoryError] = useState<string | null>(null);
  // State modal detail riwayat
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  // State playlist dan seleksi lagu untuk ganti
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<number>>(new Set());
  const [excludedSongIds, setExcludedSongIds] = useState<Set<number>>(new Set());
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceMessage, setReplaceMessage] = useState<string | null>(null);
  // State navigasi section step (1=ringkasan, 2=playlist, 3=export)
  const [sectionStep, setSectionStep] = useState(1);
  // State hasil rekomendasi dari localStorage
  const [result, setResult] = useState<ResultData | null>(null);
  const [isRouteReady, setIsRouteReady] = useState(false);

  // useEffect: guard redirect + baca result dari localStorage
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";

    if (isPlaylistFlowFinished()) {
      router.replace("/");
      return;
    }

    const raw = localStorage.getItem(PLAYLIST_RESULT_STORAGE_KEY);
    if (!raw) {
      router.replace("/");
      return;
    }

    try {
      setResult(JSON.parse(raw) as ResultData);
      setIsRouteReady(true);
    } catch {
      router.replace("/");
    }
  }, [router]);

  // loadHistory — fetch riwayat sesi dari API
  const loadHistory = useCallback(() => {
    const clientId = getOrCreateClientId();
    setHistoryLoading(true);
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

  // useEffect: load history setelah route siap
  useEffect(() => {
    if (isRouteReady) {
      loadHistory();
    }
  }, [isRouteReady, loadHistory]);

  // selectedSession — sesi yang sedang dilihat detailnya
  const selectedSession = useMemo(
    () => historyItems.find((session) => session.id_session === selectedSessionId) ?? null,
    [historyItems, selectedSessionId],
  );

  // showNlgDebug — tampilkan debug info NLG di development
  const showNlgDebug =
    process.env.NEXT_PUBLIC_NLG_DEBUG === "true" || process.env.NODE_ENV !== "production";

  // useEffect: sync playlist dari result
  useEffect(() => {
    if (result) {
      setPlaylist(result.playlist);
    }
  }, [result]);

  // useEffect: baca excluded song IDs dari localStorage
  useEffect(() => {
    const saved = localStorage.getItem(PLAYLIST_EXCLUDED_IDS_STORAGE_KEY);
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

  // currentTotalSec — total durasi playlist saat ini
  const currentTotalSec = useMemo(() => playlist.reduce((sum, s) => sum + s.durationSec, 0), [playlist]);

  // Fingerprint playlist + key localStorage untuk cache URL export
  const fp = useMemo(() => playlistFingerprint(playlist), [playlist]);
  const extKeySpotify = `${EXT_PREFIX}-spotify-${fp}`;
  const extKeyYoutube = `${EXT_PREFIX}-youtube-${fp}`;

  if (!isRouteReady || !result) {
    return null;
  }

  const overDuration = Math.max(0, currentTotalSec - result.summary.targetDurationSec);

  // redirectToUrl — redirect browser ke URL eksternal
  const redirectToUrl = (url: string) => {
    window.location.href = url;
  };

  // checkExternalUrlDb — cek URL playlist yang sudah pernah di-export dari database
  const checkExternalUrlDb = async (platform: string): Promise<{ url: string | null; title: string | null }> => {
    if (!result?.id_session) return { url: null, title: null };
    try {
      const res = await fetch(
        `/api/recommendations/external-url?id_session=${result.id_session}&platform=${platform}`,
      );
      const data = await res.json();
      return { url: data?.url ?? null, title: data?.title ?? null };
    } catch {
      return { url: null, title: null };
    }
  };

  // saveExternalUrlDb — simpan URL hasil export ke database
  const saveExternalUrlDb = (platform: string, url: string, title: string) => {
    if (!result?.id_session) return;
    fetch("/api/recommendations/external-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_session: result.id_session,
        platform,
        url,
        title,
      }),
    }).catch(() => console.warn(`Gagal simpan URL ${platform} ke database.`));
  };

  // openOrCreate — buka playlist yang sudah ada atau buat baru di Spotify/YouTube
  const openOrCreate = async (platform: "spotify" | "youtube") => {
    const extKey = platform === "spotify" ? extKeySpotify : extKeyYoutube;
    const setLoading = platform === "spotify" ? setSpotifyLoading : setYoutubeLoading;
    const endpoint = platform === "spotify" ? "/api/spotify/project-export" : "/api/youtube/project-export";
    const label = platform === "spotify" ? "Spotify" : "YouTube";

    setLoading(true);
    try {
      // Cek database dulu
      const { url: dbUrl } = await checkExternalUrlDb(platform);
      if (dbUrl) {
        localStorage.setItem(extKey, dbUrl);
        console.log(`[${label} Export] Reuse database ${label} playlist \u2014 ${dbUrl}`);
        redirectToUrl(dbUrl);
        return;
      }

      // Cek localStorage cache
      const cached = localStorage.getItem(extKey);
      if (cached) {
        if (result?.id_session) {
          saveExternalUrlDb(platform, cached, generatePlaylistName(result.context));
        }
        console.log(`[${label} Export] Reuse cached ${label} playlist \u2014 ${cached}`);
        redirectToUrl(cached);
        return;
      }

      // Buat playlist baru via API export
      console.log(`[${label} Export] No existing URL \u2014 creating new playlist`);
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
        saveExternalUrlDb(platform, data.publicUrl, playlistName);
        console.log(`[${label} Export] Created new playlist \u2014 ${data.publicUrl}`);
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

  // finishFlowAndGoHome — simpan playlist final, tandai flow selesai, redirect ke /
  const finishFlowAndGoHome = async () => {
    if (result?.id_session) {
      const safePlaylist = playlist
        .filter((item) => item.id_song != null)
        .map((item) => ({
          id_song: Number(item.id_song),
          rank: Number(item.rank),
          appraisalScore: Number(item.appraisalScore),
        }));
      if (safePlaylist.length > 0) {
        try {
          const res = await fetch("/api/recommendations/update-playlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id_session: result.id_session,
              playlist: safePlaylist,
            }),
          });
          if (!res.ok) {
            console.warn("Safety save playlist gagal:", res.status);
          }
        } catch {
          // Safety net
        }
      }
    }
    markPlaylistFlowFinished();
    router.replace("/");
  };

  // handleCloseHistory — tutup modal detail riwayat
  const handleCloseHistory = () => {
    setSelectedSessionId(null);
  };

  // toggleSelectSong — centang/batal centang lagu untuk di-replace
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

  // handleBatchReplace — ganti lagu terpilih dengan lagu baru dari API replace
  const handleBatchReplace = async () => {
    const songsToRemove = playlist.filter((s) => s.id_song !== undefined && selectedSongIds.has(s.id_song!));
    if (songsToRemove.length === 0) return;

    setIsReplacing(true);
    setReplaceMessage(null);

    const gapDurationSec = songsToRemove.reduce((sum, s) => sum + s.durationSec, 0);
    const removedIds = songsToRemove.map((s) => s.id_song!).filter(Boolean);
    const currentIds = playlist.map((s) => s.id_song!).filter(Boolean);
    const allExcluded = [...new Set([...excludedSongIds, ...removedIds])];

    const answersRaw = localStorage.getItem(PLAYLIST_QUESTIONNAIRE_STORAGE_KEY);

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
        (r: PlaylistItem) => ({
          ...r,
          rank: 0,
        }),
      );

      if (replacements.length === 0) {
        setReplaceMessage("Tidak ada lagu pengganti yang cocok ditemukan.");
        setIsReplacing(false);
        return;
      }

      // Gabung lagu yang tidak dipilih + lagu pengganti, urutkan ulang
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

      localStorage.setItem(PLAYLIST_RESULT_STORAGE_KEY, JSON.stringify(updatedResult));
      localStorage.setItem(
        PLAYLIST_EXCLUDED_IDS_STORAGE_KEY,
        JSON.stringify(allExcluded),
      );

      setPlaylist(reRanked);
      setExcludedSongIds(new Set(allExcluded));
      setSelectedSongIds(new Set());

      // Simpan perubahan ke database
      let dbSaveFailed = false;
      if (result?.id_session) {
        try {
          const dbRes = await fetch("/api/recommendations/update-playlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id_session: result.id_session,
              playlist: reRanked.map((item) => ({
                id_song: item.id_song,
                rank: item.rank,
                appraisalScore: item.appraisalScore,
              })),
            }),
          });
          if (!dbRes.ok) {
            const dbErr = await dbRes.json().catch(() => null);
            console.warn("Playlist final gagal disimpan ke server:", dbErr?.error ?? dbRes.status);
            dbSaveFailed = true;
          } else {
            loadHistory();
          }
        } catch {
          console.warn("Playlist final gagal disimpan ke server.");
          dbSaveFailed = true;
        }
      }

      setReplaceMessage(
        `${songsToRemove.length} lagu diganti dengan ${replacements.length} lagu baru (${(data.replacedDurationSec / 60).toFixed(0)} menit).` +
          (dbSaveFailed ? " Lagu berhasil diganti di tampilan, tetapi gagal disimpan ke riwayat." : ""),
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
          <button type="button" className={styles.backLinkButton} onClick={finishFlowAndGoHome}>← Kembali ke beranda</button>
          <span className={styles.badge}>Hasil Rekomendasi</span>
        </header>

        {/* Section 1: Ringkasan + NLG */}
        {sectionStep === 1 && (
          <section className={styles.card}>
            <h1>Hasil rekomendasi playlist</h1>
            <p className={styles.contextLine}>
              {result.context.activity} &middot; {result.context.timeOfDay} &middot; suasana saat ini {result.context.mood}
            </p>

            <div className={styles.metrics}>
              <span>Target {formatDuration(result.summary.targetDurationSec)}</span>
              <span>Total {formatDuration(currentTotalSec)}</span>
              <span>{playlist.length} lagu</span>
              <span>Kelebihan {formatDuration(overDuration)}</span>
            </div>

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

            {/* Indikator step dots */}
            <div className={styles.stepsDots}>
              <span className={`${styles.dot} ${styles.dotActive}`} />
              <span className={`${styles.dot} ${styles.dotInactive}`} />
              <span className={`${styles.dot} ${styles.dotInactive}`} />
            </div>
            <div className={styles.stepNav}>
              <span />
              <button
                type="button"
                className={styles.navButton}
                onClick={() => setSectionStep(2)}
              >
                Lihat playlist →
              </button>
            </div>
          </section>
        )}

        {/* Section 2: Playlist + Ganti Lagu */}
        {sectionStep === 2 && (
          <section className={styles.card}>
            <h2>Top playlist</h2>

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

            {/* Indikator step dots */}
            <div className={styles.stepsDots}>
              <span className={`${styles.dot} ${styles.dotInactive}`} onClick={() => setSectionStep(1)} />
              <span className={`${styles.dot} ${styles.dotActive}`} />
              <span className={`${styles.dot} ${styles.dotInactive}`} onClick={() => setSectionStep(3)} />
            </div>
            <div className={styles.stepNav}>
              <button
                type="button"
                className={styles.secondaryNavButton}
                onClick={() => setSectionStep(1)}
              >
                ← Ringkasan
              </button>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => setSectionStep(3)}
              >
                Lanjut ke export →
              </button>
            </div>
          </section>
        )}

        {/* Section 3: Export + Riwayat */}
        {sectionStep === 3 && (
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

            <div className={styles.historyRow}>
              <button
                type="button"
                className={styles.historyLink}
                onClick={() => {
                  if (historyItems.length > 0) {
                    setSelectedSessionId(historyItems[0].id_session);
                  }
                }}
              >
                Riwayat rekomendasi
              </button>
            </div>

            {/* Indikator step dots */}
            <div className={styles.stepsDots}>
              <span className={`${styles.dot} ${styles.dotInactive}`} onClick={() => setSectionStep(2)} />
              <span className={`${styles.dot} ${styles.dotInactive}`} onClick={() => setSectionStep(2)} />
              <span className={`${styles.dot} ${styles.dotActive}`} />
            </div>
            <div className={styles.stepNav}>
              <button
                type="button"
                className={styles.secondaryNavButton}
                onClick={() => setSectionStep(2)}
              >
                ← Playlist
              </button>
              <button
                type="button"
                className={styles.navButton}
                onClick={finishFlowAndGoHome}
              >
                Kembali ke beranda
              </button>
            </div>
          </section>
        )}

        {/* Modal detail riwayat sesi */}
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
                  <strong>{selectedSession.activity}</strong> &middot; {selectedSession.time_category} &middot; suasana saat ini {selectedSession.mood}
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

                <div className={styles.historyExtLinks}>
                  {selectedSession.spotify_playlist_url ? (
                    <a
                      href={selectedSession.spotify_playlist_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.historyExtLink}
                    >
                      Buka Spotify
                    </a>
                  ) : (
                    <span className={styles.extMuted}>Belum dibuka di Spotify</span>
                  )}
                  {selectedSession.youtube_playlist_url ? (
                    <a
                      href={selectedSession.youtube_playlist_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.historyExtLink}
                    >
                      Buka YouTube
                    </a>
                  ) : (
                    <span className={styles.extMuted}>Belum dibuka di YouTube</span>
                  )}
                </div>
              </div>
            </dialog>
          </div>
        )}
      </section>
    </main>
  );
}
