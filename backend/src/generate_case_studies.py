from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from edas import run_edas
from load_data import load_dataset
from playlist_builder import build_playlist_by_duration
from preferences import build_preferences_from_questionnaire
from preprocess import preprocess_for_edas


@dataclass(frozen=True)
class CaseConfig:
    name: str
    description: str
    target_minutes: int
    answers: dict[int, int]


def _build_case_configs() -> list[CaseConfig]:
    return [
        CaseConfig(
            name="Kasus 1 - Strict Popularity",
            description="Popularity diprioritaskan tinggi, kriteria lain netral.",
            target_minutes=180,
            answers={
                1: 3,
                2: 3,
                3: 3,
                4: 3,
                5: 3,
                6: 3,
                7: 3,
                8: 3,
                9: 5,
                10: 3,
                11: 3,
                12: 3,
                13: 3,
                14: 3,
            },
        ),
        CaseConfig(
            name="Kasus 2 - Study Instrumental Focus",
            description="Fokus instrumental dan minim lirik; BPM/energy cenderung rendah.",
            target_minutes=90,
            answers={
                1: 1,
                2: 5,
                3: 1,
                4: 5,
                5: 1,
                6: 1,
                7: 1,
                8: 2,
                9: 3,
                10: 5,
                11: 5,
                12: 5,
                13: 1,
                14: 5,
            },
        ),
        CaseConfig(
            name="Kasus 3 - Energetic Vocal Focus",
            description="Fokus tempo/energi tinggi dan speechiness tinggi, instrumental rendah.",
            target_minutes=120,
            answers={
                1: 5,
                2: 1,
                3: 5,
                4: 1,
                5: 5,
                6: 5,
                7: 5,
                8: 5,
                9: 2,
                10: 2,
                11: 1,
                12: 1,
                13: 5,
                14: 1,
            },
        ),
    ]


def _format_series(series: pd.Series, decimals: int = 6) -> str:
    if series.empty:
        return "(kosong)"
    return series.round(decimals).to_string()


def _build_case_report(case: CaseConfig, cleaned_df: pd.DataFrame, decision_matrix: pd.DataFrame) -> str:
    preference = build_preferences_from_questionnaire(case.answers)
    edas_result = run_edas(
        decision_matrix=decision_matrix,
        weights=preference.weights,
        criteria_types=preference.criteria_types,
    )

    ranked_df = cleaned_df.copy()
    ranked_df["appraisal_score"] = edas_result.appraisal_score.values
    ranked_df["rank"] = edas_result.ranking.values
    ranked_df = ranked_df.sort_values(by=["appraisal_score", "rank"], ascending=[False, True]).reset_index(drop=True)

    playlist_result = build_playlist_by_duration(
        ranked_songs=ranked_df,
        target_duration_minutes=case.target_minutes,
    )

    playlist_columns = [
        "playlist_order",
        "rank",
        "appraisal_score",
        "artist",
        "title",
        "bpm",
        "energy",
        "danceability",
        "happiness",
        "popularity",
        "acousticness",
        "instrumentalness",
        "speechiness",
        "duration",
        "duration_seconds",
        "status",
    ]
    available_columns = [column for column in playlist_columns if column in playlist_result.playlist_df.columns]
    playlist_preview = playlist_result.playlist_df[available_columns].copy()
    if "appraisal_score" in playlist_preview.columns:
        playlist_preview["appraisal_score"] = playlist_preview["appraisal_score"].round(6)

    lines = [
        "=" * 80,
        case.name,
        "=" * 80,
        f"Deskripsi: {case.description}",
        f"Target durasi: {case.target_minutes} menit ({playlist_result.target_duration_seconds} detik)",
        "",
        "Jawaban kuesioner (1-14):",
        str(case.answers),
        "",
        "Bobot kriteria (descending):",
        _format_series(pd.Series(preference.weights).sort_values(ascending=False)),
        "",
        "Jenis kriteria:",
        pd.Series(preference.criteria_types).to_string(),
        "",
        "Ringkasan playlist:",
        f"- Jumlah lagu terpilih: {len(playlist_result.playlist_df)}",
        f"- Total durasi (detik): {playlist_result.total_duration_seconds}",
        f"- Kelebihan durasi (detik): {playlist_result.exceeded_seconds}",
        f"- Sisa durasi (detik): {playlist_result.remaining_seconds}",
        "",
        "Data lagu asli terpilih (hasil playlist):",
        playlist_preview.to_string(index=False) if not playlist_preview.empty else "(playlist kosong)",
        "",
    ]

    return "\n".join(lines)


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent.parent
    csv_path = project_root / "data" / "output.csv"
    output_path = project_root / "backend" / "docs" / "studi_kasus_perbandingan_edas.txt"

    raw_df = load_dataset(csv_path)
    prep_result = preprocess_for_edas(raw_df)

    case_reports = []
    for case in _build_case_configs():
        report = _build_case_report(
            case=case,
            cleaned_df=prep_result.cleaned_df,
            decision_matrix=prep_result.decision_matrix,
        )
        case_reports.append(report)

    header = [
        "STUDI KASUS PERBANDINGAN EDAS",
        "Sistem Rekomendasi Playlist Musik Berbasis Konteks Aktivitas Pengguna",
        "",
        f"Sumber data: {csv_path}",
        f"Jumlah data setelah preprocessing: {len(prep_result.cleaned_df)} lagu",
        "",
    ]

    output_path.write_text("\n".join(header + case_reports), encoding="utf-8")
    print(f"File studi kasus berhasil dibuat: {output_path}")


if __name__ == "__main__":
    main()

