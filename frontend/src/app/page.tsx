"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
import { ContextFormCard } from "@/components/home/ContextFormCard";
import { HeroCard } from "@/components/home/HeroCard";
import { getOrCreateClientId } from "@/lib/clientId";
import {
  clearActivePlaylistFlow,
  clearPlaylistFlowFinishedFlag,
  consumeFinishedPlaylistFlow,
} from "@/lib/playlistFlow";
import styles from "./page.module.css";

// Kunci localStorage untuk menyimpan tema (dark/light)
const THEME_STORAGE_KEY = "playlist-theme-v1";

// HistorySong — tipe data lagu dalam riwayat sesi rekomendasi
type HistorySong = {
  id_song: number;
  title: string;
  artist: string;
  rank_order: number;
  appraisal_score: number;
};

// HistorySession — tipe data sesi rekomendasi lengkap dengan lagu dan URL export
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

// Home — halaman utama beranda dengan flow 2-step (welcome → form konteks)
export default function Home() {
  // applyTheme — terapkan tema ke HTML dan simpan ke localStorage
  const applyTheme = (nextTheme: "dark" | "light") => {
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  // State tema, inisialisasi dari localStorage
  const [theme, setThemeState] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme = saved === "light" ? "light" : "dark";
    applyTheme(nextTheme);
    return nextTheme;
  });

  // setTheme — wrapper untuk update state tema + trigger applyTheme
  const setTheme = (updater: "dark" | "light" | ((prev: "dark" | "light") => "dark" | "light")) => {
    const nextTheme = typeof updater === "function" ? updater(theme) : updater;
    applyTheme(nextTheme);
    setThemeState(nextTheme);
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // clearOldFlow — hapus data flow lama saat memulai sesi baru
  const clearOldFlow = useCallback(() => {
    clearActivePlaylistFlow();
    clearPlaylistFlowFinishedFlag();
  }, []);

  // State flow: step 1 = welcome, step 2 = form konteks
  const [step, setStep] = useState(1);
  // State riwayat sesi rekomendasi dari database
  const [historyItems, setHistoryItems] = useState<HistorySession[]>([]);
  // State kontrol modal riwayat (list vs detail)
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // recentItems — maksimal 3 riwayat terbaru untuk ditampilkan di modal list
  const recentItems = useMemo(() => historyItems.slice(0, 3), [historyItems]);

  // selectedSession — sesi yang sedang dilihat detailnya (dari ID terpilih)
  const selectedSession = selectedSessionId
    ? historyItems.find((s) => s.id_session === selectedSessionId) ?? null
    : null;

  // closeHistory — tutup modal riwayat dan reset pilihan
  const closeHistory = useCallback(() => {
    setShowHistoryModal(false);
    setSelectedSessionId(null);
  }, []);

  // loadHistory — fetch riwayat sesi dari API berdasarkan clientId
  const loadHistory = useCallback(() => {
    const clientId = getOrCreateClientId();
    void fetch(`/api/recommendations/history?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json() as Promise<{ history: HistorySession[] }>)
      .then((payload) => {
        setHistoryItems(payload.history ?? []);
      })
      .catch(() => {});
  }, []);

  // useEffect: cek flag flow selesai, redirect ke step 1; lalu load riwayat
  useEffect(() => {
    if (consumeFinishedPlaylistFlow()) {
      window.history.replaceState({ flowFinished: true }, "", window.location.pathname);
      setStep(1);
    }
    loadHistory();
  }, [loadHistory]);

  return (
    <div className={`app-shell ${styles.page}`} data-theme={theme}>
      <MusicBackground />
      <MusicCursorTrail />

      <main className={`app-container ${styles.main}`}>
        <header className={styles.topBar}>
          <span className={styles.logo}>
            <span className={styles.logoIcon}>🎧</span>
            namu.
          </span>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={() => setTheme((p) => (p === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </header>

        {step === 1 && (
          <>
            <HeroCard />
            <div className={styles.stepActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => {
                  clearOldFlow();
                  window.history.replaceState(null, "", window.location.pathname);
                  setStep(2);
                }}
              >
                Mulai
              </button>
              {historyItems.length > 0 && (
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => {
                    setShowHistoryModal(true);
                    setSelectedSessionId(null);
                  }}
                >
                  Lihat riwayat rekomendasi
                </button>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <div className={styles.formStep}>
            <button
              type="button"
              className={styles.backLinkButton}
              onClick={() => setStep(1)}
            >
              ← Kembali ke beranda
            </button>
            <ContextFormCard />
          </div>
        )}

        {showHistoryModal && (
          <div className={styles.overlay}>
            <button
              type="button"
              className={styles.backdrop}
              onClick={closeHistory}
              aria-label="Tutup riwayat"
            />
            <dialog open className={styles.modal}>
              {selectedSession ? (
                <>
                  <header className={styles.modalHeader}>
                    <div className={styles.modalHeaderLeft}>
                      <button
                        type="button"
                        className={styles.backButton}
                        onClick={() => setSelectedSessionId(null)}
                        aria-label="Kembali ke daftar"
                      >
                        ← Kembali
                      </button>
                      <h3>Detail riwayat</h3>
                    </div>
                    <button
                      type="button"
                      className={styles.modalClose}
                      onClick={closeHistory}
                    >
                      Tutup
                    </button>
                  </header>
                  <div className={styles.modalBody}>
                    <p className={styles.modalContext}>
                      <strong>{selectedSession.activity}</strong> &middot;{" "}
                      {selectedSession.time_category} &middot; suasana saat ini{" "}
                      {selectedSession.mood}
                    </p>
                    <div className={styles.modalMeta}>
                      <span>
                        Target {formatDuration(selectedSession.duration_target * 60)}
                      </span>
                      <span>
                        {new Date(selectedSession.created_at).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <ul className={styles.modalList}>
                      {selectedSession.songs.map((song) => (
                        <li
                          key={`${selectedSession.id_session}-${song.id_song}-${song.rank_order}`}
                        >
                          <span>#{song.rank_order}</span>
                          <span>{song.title}</span>
                          <span>{song.artist}</span>
                        </li>
                      ))}
                    </ul>
                    <div className={styles.extLinks}>
                      {selectedSession.spotify_playlist_url ? (
                        <a
                          href={selectedSession.spotify_playlist_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.extLink}
                        >
                          Buka Spotify
                        </a>
                      ) : (
                        <span className={styles.extMuted}>
                          Belum dibuka di Spotify
                        </span>
                      )}
                      {selectedSession.youtube_playlist_url ? (
                        <a
                          href={selectedSession.youtube_playlist_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.extLink}
                        >
                          Buka YouTube
                        </a>
                      ) : (
                        <span className={styles.extMuted}>
                          Belum dibuka di YouTube
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <header className={styles.modalHeader}>
                    <h3>Riwayat rekomendasi</h3>
                    <button
                      type="button"
                      className={styles.modalClose}
                      onClick={closeHistory}
                    >
                      Tutup
                    </button>
                  </header>
                  <div className={styles.modalBody}>
                    {recentItems.length === 0 ? (
                      <p className={styles.historyEmpty}>
                        Belum ada riwayat rekomendasi.
                      </p>
                    ) : (
                      <ul className={styles.historyList}>
                        {recentItems.map((item) => (
                          <li key={item.id_session}>
                            <button
                              type="button"
                              className={styles.historyItemButton}
                              onClick={() => setSelectedSessionId(item.id_session)}
                            >
                              <span className={styles.historyItemTitle}>
                                {item.activity}
                              </span>
                              <span className={styles.historyItemMeta}>
                                {item.time_category} &middot; suasana saat ini {item.mood} &middot;{" "}
                                {new Date(item.created_at).toLocaleDateString("id-ID")}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </dialog>
          </div>
        )}
      </main>
    </div>
  );
}
