"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ContextFormCard.module.css";

const CONTEXT_STORAGE_KEY = "playlist-context-v1";

export function ContextFormCard() {
  const router = useRouter();

  const [activity, setActivity] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [mood, setMood] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isIncomplete, setIsIncomplete] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activity || !timeOfDay || !mood || durationMinutes === "") {
      setIsIncomplete(true);
      return;
    }

    const normalizedDuration = Math.max(15, Math.min(360, durationMinutes || 15));
    setDurationMinutes(normalizedDuration);
    setIsIncomplete(false);

    const payload = {
      activity,
      timeOfDay,
      mood,
      durationMinutes: normalizedDuration,
      profileName: "Context Explorer",
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(payload));
    setHasSubmitted(true);
  };

  return (
    <section className={styles.card}>
      <h2>Mulai dari konteks kamu dulu</h2>
      <p className={styles.formDescription}>Pilih konteks sesi kamu dulu supaya rekomendasinya lebih pas.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>Lagi ngapain?</span>
          <select value={activity} onChange={(event) => setActivity(event.target.value)}>
            <option value="" disabled>
              Pilih aktivitas
            </option>
            <option value="belajar">Belajar</option>
            <option value="bekerja">Bekerja</option>
            <option value="olahraga">Olahraga</option>
            <option value="relaksasi">Relaksasi</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Jam berapa vibe-nya?</span>
          <select value={timeOfDay} onChange={(event) => setTimeOfDay(event.target.value)}>
            <option value="" disabled>
              Pilih waktu
            </option>
            <option value="pagi">Pagi</option>
            <option value="siang">Siang</option>
            <option value="sore">Sore</option>
            <option value="malam">Malam</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Suasana yang kamu inginkan?</span>
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
          <span>Mau denger berapa menit?</span>
          <input
            type="number"
            min={15}
            max={360}
            step={5}
            value={durationMinutes}
            onChange={(event) => {
              const value = event.target.value;
              setDurationMinutes(value === "" ? "" : Number(value));
            }}
          />
        </label>

        <button type="submit" className={styles.primaryButton}>
          Simpan pilihan
        </button>

        {isIncomplete && (
          <p className={styles.errorText}>Semua pilihan perlu diisi dulu sebelum lanjut.</p>
        )}
      </form>

      {hasSubmitted && (
        <div className={styles.summaryBox}>
          <h3>Pilihanmu sudah tersimpan ✅</h3>
          <ul>
            <li>
              <strong>Aktivitas:</strong> {activity}
            </li>
            <li>
              <strong>Waktu:</strong> {timeOfDay}
            </li>
            <li>
              <strong>Mood:</strong> {mood}
            </li>
            <li>
              <strong>Durasi:</strong> {durationMinutes} menit
            </li>
          </ul>

          <p>Kalau sudah sesuai, lanjut ke halaman kuesioner ya.</p>

          <button className={styles.secondaryButton} onClick={() => router.push("/kuesioner")}>
            Lanjut ke pertanyaan musik
          </button>
        </div>
      )}
    </section>
  );
}
