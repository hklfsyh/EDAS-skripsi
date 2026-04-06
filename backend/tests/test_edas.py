import unittest

import pandas as pd

from src.edas import run_edas


class TestEdas(unittest.TestCase):
    def test_edas_expected_ranking_on_small_matrix(self) -> None:
        decision_matrix = pd.DataFrame(
            {
                "c1": [10.0, 20.0, 15.0],
                "c2": [20.0, 10.0, 15.0],
            }
        )

        weights = {"c1": 0.5, "c2": 0.5}
        criteria_types = {"c1": "benefit", "c2": "cost"}

        result = run_edas(decision_matrix, weights, criteria_types)

        self.assertEqual(int(result.ranking.iloc[1]), 1)
        self.assertEqual(int(result.ranking.iloc[2]), 2)
        self.assertEqual(int(result.ranking.iloc[0]), 3)

        self.assertAlmostEqual(float(result.appraisal_score.iloc[1]), 1.0, places=9)
        self.assertAlmostEqual(float(result.appraisal_score.iloc[2]), 0.5, places=9)
        self.assertAlmostEqual(float(result.appraisal_score.iloc[0]), 0.0, places=9)

    def test_neutral_treated_without_reversing_direction(self) -> None:
        decision_matrix = pd.DataFrame({"c1": [10.0, 20.0]})
        weights = {"c1": 1.0}
        criteria_types = {"c1": "neutral"}

        result = run_edas(decision_matrix, weights, criteria_types)

        self.assertGreater(float(result.appraisal_score.iloc[1]), float(result.appraisal_score.iloc[0]))

    def test_output_has_no_nan(self) -> None:
        decision_matrix = pd.DataFrame(
            {
                "c1": [10.0, 20.0, 30.0],
                "c2": [30.0, 20.0, 10.0],
                "c3": [5.0, 5.0, 5.0],
            }
        )
        weights = {"c1": 0.4, "c2": 0.4, "c3": 0.2}
        criteria_types = {"c1": "benefit", "c2": "cost", "c3": "neutral"}

        result = run_edas(decision_matrix, weights, criteria_types)

        self.assertFalse(result.appraisal_score.isna().any())
        self.assertFalse(result.sp.isna().any())
        self.assertFalse(result.sn.isna().any())


if __name__ == "__main__":
    unittest.main()