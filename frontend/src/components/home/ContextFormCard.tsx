"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PLAYLIST_CONTEXT_STORAGE_KEY,
  clearPlaylistFlowFinishedFlag,
} from "@/lib/playlistFlow";
import styles from "./ContextFormCard.module.css";

type ContextOption = {
  value: string;
  label: string;
  description?: string;
};

type ContextCategory = {
  key: string;
  label: string;
  options: ContextOption[];
};

export function ContextFormCard() {
  const router = useRouter();
  const [categories, setCategories] = useState<ContextCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");
  const [isIncomplete, setIsIncomplete] = useState(false);

  const loadOptions = useCallback(() => {
    setIsLoading(true);
    setHasError(false);

    fetch("/api/context-options")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.categories) {
          setCategories(data.categories);
        } else {
          setHasError(true);
        }
      })
      .catch(() => {
        setHasError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const handleSubmit: React.ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();

    const allFilled = categories.every((cat) => formValues[cat.key]?.trim());
    if (!allFilled || durationMinutes === "") {
      setIsIncomplete(true);
      return;
    }

    const normalizedDuration = Math.max(5, Math.min(360, durationMinutes || 5));
    setIsIncomplete(false);

    const payload: Record<string, unknown> = {
      durationMinutes: normalizedDuration,
      profileName: "Context Explorer",
      createdAt: new Date().toISOString(),
    };
    for (const cat of categories) {
      payload[cat.key] = formValues[cat.key];
    }

    clearPlaylistFlowFinishedFlag();
    localStorage.setItem(PLAYLIST_CONTEXT_STORAGE_KEY, JSON.stringify(payload));
    router.push("/kuesioner");
  };

  if (isLoading) {
    return (
      <section className={styles.card}>
        <h2>Konteks sesi kamu</h2>
        <p>Memuat opsi konteks...</p>
      </section>
    );
  }

  if (hasError) {
    return (
      <section className={styles.card}>
        <h2>Konteks sesi kamu</h2>
        <p className={styles.errorText}>Gagal memuat opsi konteks.</p>
        <button type="button" className={styles.primaryButton} onClick={loadOptions}>
          Coba lagi
        </button>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <h2>Konteks sesi kamu</h2>

      <form className={styles.form} onSubmit={handleSubmit}>
        {categories.map((cat) => (
          <label key={cat.key} className={styles.field}>
            <span>{cat.label}</span>
            <select
              value={formValues[cat.key] ?? ""}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, [cat.key]: event.target.value }))
              }
            >
              <option value="" disabled>
                Pilih {cat.label.toLowerCase()}
              </option>
              {cat.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ))}

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
