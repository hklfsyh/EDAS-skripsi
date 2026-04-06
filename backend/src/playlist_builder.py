from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class PlaylistBuildResult:
    playlist_df: pd.DataFrame
    total_duration_seconds: int
    target_duration_seconds: int
    remaining_seconds: int
    exceeded_seconds: int


def build_playlist_by_duration(
    ranked_songs: pd.DataFrame,
    target_duration_minutes: int,
) -> PlaylistBuildResult:
    if target_duration_minutes <= 0:
        empty_df = pd.DataFrame(columns=list(ranked_songs.columns) + ["playlist_order", "cumulative_duration_seconds"])
        return PlaylistBuildResult(
            playlist_df=empty_df,
            total_duration_seconds=0,
            target_duration_seconds=0,
            remaining_seconds=0,
            exceeded_seconds=0,
        )

    required_columns = {"duration_seconds", "appraisal_score", "rank"}
    missing_columns = sorted(required_columns - set(ranked_songs.columns))
    if missing_columns:
        raise ValueError(f"Kolom wajib untuk pembentukan playlist belum tersedia: {missing_columns}")

    target_duration_seconds = int(target_duration_minutes * 60)

    ordered_df = ranked_songs.sort_values(
        by=["appraisal_score", "rank"],
        ascending=[False, True],
    ).reset_index(drop=True)

    selected_rows: list[dict] = []
    total_duration_seconds = 0

    for _, row in ordered_df.iterrows():
        row_duration = int(row["duration_seconds"])
        row_dict = row.to_dict()

        total_duration_seconds += row_duration
        row_dict["playlist_order"] = len(selected_rows) + 1
        row_dict["cumulative_duration_seconds"] = total_duration_seconds
        selected_rows.append(row_dict)

        if total_duration_seconds >= target_duration_seconds:
            break

    playlist_df = pd.DataFrame(selected_rows)

    remaining_seconds = max(0, target_duration_seconds - total_duration_seconds)
    exceeded_seconds = max(0, total_duration_seconds - target_duration_seconds)

    return PlaylistBuildResult(
        playlist_df=playlist_df,
        total_duration_seconds=total_duration_seconds,
        target_duration_seconds=target_duration_seconds,
        remaining_seconds=remaining_seconds,
        exceeded_seconds=exceeded_seconds,
    )