import unittest

from src.preferences import build_preferences_from_questionnaire


class TestPreferences(unittest.TestCase):
    def test_weight_sum_is_one(self) -> None:
        answers = {
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
        result = build_preferences_from_questionnaire(answers)

        self.assertAlmostEqual(sum(result.weights.values()), 1.0, places=9)

    def test_criterion_type_follows_score_threshold(self) -> None:
        answers = {
            1: 3,
            2: 3,
            3: 5,
            4: 1,
            5: 5,
            6: 3,
            7: 3,
            8: 3,
            9: 3,
            10: 3,
            11: 3,
            12: 3,
            13: 1,
            14: 5,
        }
        result = build_preferences_from_questionnaire(answers)

        self.assertEqual(result.criteria_types["energy"], "benefit")
        self.assertEqual(result.criteria_types["danceability"], "neutral")
        self.assertEqual(result.criteria_types["speechiness"], "cost")

    def test_reverse_item_is_handled(self) -> None:
        high_q2_answers = {
            1: 3,
            2: 5,
            3: 3,
            4: 3,
            5: 3,
            6: 3,
            7: 3,
            8: 3,
            9: 3,
            10: 3,
            11: 3,
            12: 3,
            13: 3,
            14: 3,
        }
        low_q2_answers = {
            1: 3,
            2: 1,
            3: 3,
            4: 3,
            5: 3,
            6: 3,
            7: 3,
            8: 3,
            9: 3,
            10: 3,
            11: 3,
            12: 3,
            13: 3,
            14: 3,
        }

        result_high_q2 = build_preferences_from_questionnaire(high_q2_answers)
        result_low_q2 = build_preferences_from_questionnaire(low_q2_answers)

        self.assertLess(result_high_q2.parameter_scores["bpm"], result_low_q2.parameter_scores["bpm"])


if __name__ == "__main__":
    unittest.main()

