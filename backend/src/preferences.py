from __future__ import annotations

from dataclasses import dataclass


PARAMETERS = [
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
class QuestionnaireItem:
    question_id: int
    parameter: str
    positive_toward_higher_value: bool


@dataclass(frozen=True)
class PreferenceResult:
    parameter_scores: dict[str, float]
    weights: dict[str, float]
    criteria_types: dict[str, str]


QUESTIONNAIRE_MAPPING = [
    QuestionnaireItem(question_id=1, parameter="bpm", positive_toward_higher_value=True),
    QuestionnaireItem(question_id=2, parameter="bpm", positive_toward_higher_value=False),
    QuestionnaireItem(question_id=3, parameter="energy", positive_toward_higher_value=True),
    QuestionnaireItem(question_id=4, parameter="energy", positive_toward_higher_value=False),
    QuestionnaireItem(question_id=5, parameter="energy", positive_toward_higher_value=True),
    QuestionnaireItem(question_id=6, parameter="danceability", positive_toward_higher_value=True),
    QuestionnaireItem(question_id=7, parameter="danceability", positive_toward_higher_value=True),
    QuestionnaireItem(question_id=8, parameter="happiness", positive_toward_higher_value=True),
    QuestionnaireItem(question_id=9, parameter="popularity", positive_toward_higher_value=True),
    QuestionnaireItem(question_id=10, parameter="acousticness", positive_toward_higher_value=True),
    QuestionnaireItem(question_id=11, parameter="instrumentalness", positive_toward_higher_value=True),
    QuestionnaireItem(question_id=12, parameter="instrumentalness", positive_toward_higher_value=True),
    QuestionnaireItem(question_id=13, parameter="speechiness", positive_toward_higher_value=True),
    QuestionnaireItem(question_id=14, parameter="speechiness", positive_toward_higher_value=False),
]


def _validate_answers(answers: dict[int, int]) -> None:
    expected_ids = {item.question_id for item in QUESTIONNAIRE_MAPPING}
    given_ids = set(answers.keys())

    missing = sorted(expected_ids - given_ids)
    extra = sorted(given_ids - expected_ids)

    if missing:
        raise ValueError(f"Jawaban belum lengkap. Nomor yang belum diisi: {missing}")

    if extra:
        raise ValueError(f"Terdapat nomor pertanyaan tidak valid: {extra}")

    for question_id, answer in answers.items():
        if answer < 1 or answer > 5:
            raise ValueError(f"Skala Likert harus 1-5. Nilai invalid pada nomor {question_id}: {answer}")


def _normalize_answer(answer: int, positive_toward_higher_value: bool) -> float:
    if positive_toward_higher_value:
        return float(answer)

    return float(6 - answer)


def _classify_criterion(parameter_score: float) -> str:
    if parameter_score > 3.0:
        return "benefit"
    if parameter_score < 3.0:
        return "cost"
    return "neutral"


def build_preferences_from_questionnaire(answers: dict[int, int]) -> PreferenceResult:
    _validate_answers(answers)

    score_bucket: dict[str, list[float]] = {parameter: [] for parameter in PARAMETERS}

    for item in QUESTIONNAIRE_MAPPING:
        raw_answer = answers[item.question_id]
        normalized_answer = _normalize_answer(raw_answer, item.positive_toward_higher_value)
        score_bucket[item.parameter].append(normalized_answer)

    parameter_scores: dict[str, float] = {}
    for parameter in PARAMETERS:
        parameter_values = score_bucket[parameter]
        parameter_scores[parameter] = sum(parameter_values) / len(parameter_values)

    total_score = sum(parameter_scores.values())
    if total_score <= 0:
        raise ValueError("Total skor preferensi tidak valid untuk normalisasi bobot.")

    weights = {
        parameter: score / total_score
        for parameter, score in parameter_scores.items()
    }

    criteria_types = {
        parameter: _classify_criterion(score)
        for parameter, score in parameter_scores.items()
    }

    return PreferenceResult(
        parameter_scores=parameter_scores,
        weights=weights,
        criteria_types=criteria_types,
    )