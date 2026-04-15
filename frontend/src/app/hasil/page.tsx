"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MusicBackground } from "@/components/common/MusicBackground";
import { MusicCursorTrail } from "@/components/common/MusicCursorTrail";
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
  const [spotifyMessage, setSpotifyMessage] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyStatus = params.get("spotify");
    const reason = params.get("reason");

    if (spotifyStatus === "success") {
      setSpotifyMessage("Spotify berhasil terhubung.");
    } else if (spotifyStatus === "error") {
      setSpotifyMessage(`Gagal menghubungkan Spotify${reason ? ` (${reason})` : ""}.`);
    }

    void fetch("/api/spotify/status")
      .then((response) => response.json() as Promise<{ connected: boolean }>)
      .then((payload) => {
        setSpotifyConnected(Boolean(payload.connected));
      })
      .catch(() => {
        setSpotifyConnected(false);
      });
  }, []);

  const result = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(RESULT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ResultData;
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

  const overDuration = Math.max(0, result.summary.totalDurationSec - result.summary.targetDurationSec);

  const handleConnectSpotify = () => {
    window.location.href = "/api/spotify/login";
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
        window.open(payload.playlistUrl, "_blank", "noopener,noreferrer");
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
          <h2>Eksperimen export playlist (opsional)</h2>
          <p className={styles.experimentText}>
            Mode ini hanya untuk uji coba lokal dan tidak mengubah alur utama skripsi.
          </p>

          <div className={styles.experimentActions}>
            {!spotifyConnected ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleConnectSpotify}
              >
                Hubungkan Spotify
              </button>
            ) : (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleExportSpotify}
                disabled={spotifyLoading}
              >
                {spotifyLoading ? "Memproses..." : "Kirim playlist ke Spotify"}
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
