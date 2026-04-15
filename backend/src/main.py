from pathlib import Path

from edas import run_edas
from load_data import load_dataset
from playlist_builder import build_playlist_by_duration
from preprocess import EDAS_CRITERIA, preprocess_for_edas
from preferences import build_preferences_from_questionnaire


def main() -> None:
    csv_path = Path(__file__).resolve().parent.parent.parent / "data" / "output.csv"
    df = load_dataset(csv_path)
    preprocess_result = preprocess_for_edas(df)
    cleaned_df = preprocess_result.cleaned_df
    decision_matrix = preprocess_result.decision_matrix

    print("=== LEVEL 1: PREPROCESS DATA EDAS ===")
    print("Path CSV:", csv_path)
    print("Jumlah baris mentah:", len(df))
    print("Jumlah baris setelah filter status=ok:", len(cleaned_df))
    print("Jumlah kolom mentah:", len(df.columns))
    print("Kriteria EDAS:", EDAS_CRITERIA)
    print("Shape decision matrix (m x n):", decision_matrix.shape)
    print("Cek NaN pada decision matrix:", int(decision_matrix.isna().sum().sum()))
    print("Durasi minimum (detik):", int(cleaned_df["duration_seconds"].min()))
    print("Durasi maksimum (detik):", int(cleaned_df["duration_seconds"].max()))
    print()
    print("Contoh data siap EDAS:")
    print(cleaned_df[["artist", "title", *EDAS_CRITERIA, "duration_seconds"]].head())

    print()
    print("=== LEVEL 2: KONVERSI PREFERENSI KUESIONER ===")
    demo_answers = {
        1: 4,
        2: 2,
        3: 4,
        4: 2,
        5: 5,
        6: 4,
        7: 4,
        8: 4,
        9: 3,
        10: 3,
        11: 4,
        12: 4,
        13: 2,
        14: 4,
    }
    preference_result = build_preferences_from_questionnaire(demo_answers)

    print("Skor parameter (1-5):")
    for parameter, score in preference_result.parameter_scores.items():
        print(f"- {parameter}: {score:.3f}")

    print("\nBobot kriteria (total harus 1):")
    for parameter, weight in preference_result.weights.items():
        print(f"- {parameter}: {weight:.6f}")

    total_weight = sum(preference_result.weights.values())
    print(f"Total bobot: {total_weight:.6f}")

    print("\nJenis kriteria:")
    for parameter, criterion_type in preference_result.criteria_types.items():
        print(f"- {parameter}: {criterion_type}")

    print()
    print("=== LEVEL 3: PERHITUNGAN EDAS ===")
    edas_result = run_edas(
        decision_matrix=decision_matrix,
        weights=preference_result.weights,
        criteria_types=preference_result.criteria_types,
    )

    print("Average solution per kriteria:")
    for criterion, value in edas_result.average_solution.items():
        print(f"- {criterion}: {value:.6f}")

    ranking_df = cleaned_df[["artist", "title", "duration_seconds"]].copy()
    ranking_df["sp"] = edas_result.sp.values
    ranking_df["sn"] = edas_result.sn.values
    ranking_df["appraisal_score"] = edas_result.appraisal_score.values
    ranking_df["rank"] = edas_result.ranking.values
    ranking_df = ranking_df.sort_values(by=["appraisal_score", "rank"], ascending=[False, True])

    print("\nTop 10 ranking lagu (Level 3):")
    top_10 = ranking_df[["artist", "title", "appraisal_score", "rank"]].head(10)
    print(top_10.to_string(index=False))

    print("\nRingkasan validasi Level 3:")
    print(f"- Jumlah alternatif terhitung: {len(ranking_df)}")
    print(f"- Min appraisal score: {ranking_df['appraisal_score'].min():.6f}")
    print(f"- Max appraisal score: {ranking_df['appraisal_score'].max():.6f}")
    print(f"- Apakah ada NaN score: {ranking_df['appraisal_score'].isna().any()}")

    print()
    print("=== LEVEL 4: PEMBENTUKAN PLAYLIST ===")
    target_duration_minutes = 60
    playlist_result = build_playlist_by_duration(
        ranked_songs=ranking_df,
        target_duration_minutes=target_duration_minutes,
    )

    playlist_preview = playlist_result.playlist_df[["playlist_order", "artist", "title", "duration_seconds", "appraisal_score"]].head(15)

    print(f"Target durasi (menit): {target_duration_minutes}")
    print(f"Target durasi (detik): {playlist_result.target_duration_seconds}")
    print(f"Total durasi playlist (detik): {playlist_result.total_duration_seconds}")
    print(f"Sisa durasi terhadap target (detik): {playlist_result.remaining_seconds}")
    print(f"Kelebihan durasi terhadap target (detik): {playlist_result.exceeded_seconds}")
    print(f"Jumlah lagu terpilih: {len(playlist_result.playlist_df)}")
    print("\nPreview playlist (15 lagu pertama):")
    print(playlist_preview.to_string(index=False))


if __name__ == "__main__":
    main()

