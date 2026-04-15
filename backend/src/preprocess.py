from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import pandas as pd


EDAS_CRITERIA = [
    "bpm",
    "energy",
    "danceability",
    "happiness",
    "popularity",
    "acousticness",
    "instrumentalness",
    "speechiness",
]


@dataclass(frozen=True)
class PreprocessResult:
    cleaned_df: pd.DataFrame
    decision_matrix: pd.DataFrame


def parse_duration_to_seconds(duration_text: str) -> int:
    value = str(duration_text).strip()
    parts = value.split(":")

    if len(parts) != 2:
        raise ValueError(f"Format durasi tidak valid: {duration_text}")

    minutes_text, seconds_text = parts
    minutes = int(minutes_text)
    seconds = int(seconds_text)

    if minutes < 0 or seconds < 0:
        raise ValueError(f"Nilai durasi tidak valid: {duration_text}")

    normalized_minutes = minutes + (seconds // 60)
    normalized_seconds = seconds % 60

    return normalized_minutes * 60 + normalized_seconds


def _safe_parse_duration_to_seconds(duration_text: str) -> int | None:
    try:
        return parse_duration_to_seconds(duration_text)
    except (TypeError, ValueError):
        return None


def _ensure_columns(df: pd.DataFrame, required_columns: Iterable[str]) -> None:
    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        raise KeyError(f"Kolom wajib tidak ditemukan: {missing}")


def preprocess_for_edas(df: pd.DataFrame) -> PreprocessResult:
    required_columns = ["artist", "title", "duration", "status", *EDAS_CRITERIA]
    _ensure_columns(df, required_columns)

    working_df = df.copy()

    if "status" in working_df.columns:
        working_df["status"] = working_df["status"].astype(str).str.strip().str.lower()
        working_df = working_df[working_df["status"] == "ok"].copy()

    working_df["duration_seconds"] = working_df["duration"].apply(_safe_parse_duration_to_seconds)

    for column in EDAS_CRITERIA:
        working_df[column] = pd.to_numeric(working_df[column], errors="coerce")

    working_df = working_df.dropna(subset=[*EDAS_CRITERIA, "duration_seconds"]).copy()
    working_df["duration_seconds"] = working_df["duration_seconds"].astype(int)

    decision_matrix = working_df[EDAS_CRITERIA].copy()

    if decision_matrix.empty:
        raise ValueError("Decision matrix kosong setelah preprocessing.")

    return PreprocessResult(cleaned_df=working_df, decision_matrix=decision_matrix)

