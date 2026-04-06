import unittest

import pandas as pd

from src.playlist_builder import build_playlist_by_duration


class TestPlaylistBuilder(unittest.TestCase):
    def test_playlist_reaches_target_duration(self) -> None:
        ranked = pd.DataFrame(
            {
                "artist": ["A", "B", "C"],
                "title": ["S1", "S2", "S3"],
                "duration_seconds": [120, 130, 150],
                "appraisal_score": [0.9, 0.8, 0.7],
                "rank": [1, 2, 3],
            }
        )

        result = build_playlist_by_duration(ranked, target_duration_minutes=4)

        self.assertGreaterEqual(result.total_duration_seconds, 240)
        self.assertEqual(len(result.playlist_df), 2)

    def test_playlist_keeps_ranking_order(self) -> None:
        ranked = pd.DataFrame(
            {
                "artist": ["A", "B", "C"],
                "title": ["S1", "S2", "S3"],
                "duration_seconds": [100, 100, 100],
                "appraisal_score": [0.95, 0.90, 0.80],
                "rank": [1, 2, 3],
            }
        )

        result = build_playlist_by_duration(ranked, target_duration_minutes=5)

        selected_titles = list(result.playlist_df["title"])
        self.assertEqual(selected_titles, ["S1", "S2", "S3"])
        self.assertEqual(list(result.playlist_df["playlist_order"]), [1, 2, 3])

    def test_non_positive_target_returns_empty_playlist(self) -> None:
        ranked = pd.DataFrame(
            {
                "artist": ["A"],
                "title": ["S1"],
                "duration_seconds": [120],
                "appraisal_score": [0.95],
                "rank": [1],
            }
        )

        result = build_playlist_by_duration(ranked, target_duration_minutes=0)

        self.assertEqual(len(result.playlist_df), 0)
        self.assertEqual(result.total_duration_seconds, 0)


if __name__ == "__main__":
    unittest.main()