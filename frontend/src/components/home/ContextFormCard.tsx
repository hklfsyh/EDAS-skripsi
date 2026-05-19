"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PLAYLIST_CONTEXT_STORAGE_KEY,
  clearPlaylistFlowFinishedFlag,
} from "@/lib/playlistFlow";
import styles from "./ContextFormCard.module.css";

// ContextFormCard — form pengisian konteks aktivitas (activity, time, mood, duration)
export function ContextFormCard() {
  const router = useRouter();

  // State untuk tiap field form
  const [activity, setActivity] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [mood, setMood] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");
  const [isIncomplete, setIsIncomplete] = useState(false);

  // handleSubmit — validasi, simpan ke localStorage, redirect ke /kuesioner
  const handleSubmit: React.ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();

    if (!activity || !timeOfDay || !mood || durationMinutes === "") {
      setIsIncomplete(true);
      return;
    }

    const normalizedDuration = Math.max(5, Math.min(360, durationMinutes || 5));
    setIsIncomplete(false);

    const payload = {
      activity,
      timeOfDay,
      mood,
      durationMinutes: normalizedDuration,
      profileName: "Context Explorer",
      createdAt: new Date().toISOString(),
    };

    clearPlaylistFlowFinishedFlag();
    localStorage.setItem(PLAYLIST_CONTEXT_STORAGE_KEY, JSON.stringify(payload));
    router.push("/kuesioner");
  };

  return (
    <section className={styles.card}>
      <h2>Konteks sesi kamu</h2>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>Mau ngapain?</span>
          <select value={activity} onChange={(event) => setActivity(event.target.value)}>
            <option value="" disabled>
              Pilih aktivitas
            </option>
            <option value="belajar">Belajar</option>
            <option value="olahraga">Olahraga</option>
            <option value="relaksasi">Relaksasi</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Waktu aktivitasnya?</span>
          <select value={timeOfDay} onChange={(event) => setTimeOfDay(event.target.value)}>
            <option value="" disabled>
              Pilih waktu
            </option>
            <option value="pagi">Pagi</option>
            <option value="siang">Siang</option>
            <option value="malam">Malam</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Suasana saat ini?</span>
          <select value={mood} onChange={(event) => setMood(event.target.value)}>
            <option value="" disabled>
              Pilih suasana
            </option>
            <option value="fokus">Fokus</option>
            <option value="netral">Netral</option>
            <option value="santai">Santai</option>
            <option value="bersemangat">Bersemangat</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Durasi (menit)</span>
          <input
            type="number"
            min={5}
            max={360}
            step={5}
            value={durationMinutes}
            onChange={(event) => {
              const value = event.target.value;
              setDurationMinutes(value === "" ? "" : Number(value));
            }}
            placeholder="5–360 menit"
          />
        </label>

        <button type="submit" className={styles.primaryButton}>
          Simpan & lanjut
        </button>

        {isIncomplete && (
          <p className={styles.errorText}>Semua pilihan perlu diisi dulu sebelum lanjut.</p>
        )}
      </form>
    </section>
  );
}
