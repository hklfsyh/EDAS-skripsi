from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class EdasResult:
    average_solution: pd.Series
    pda: pd.DataFrame
    nda: pd.DataFrame
    sp: pd.Series
    sn: pd.Series
    nsp: pd.Series
    nsn: pd.Series
    appraisal_score: pd.Series
    ranking: pd.Series


def _safe_divide(numerator: pd.DataFrame | pd.Series, denominator: pd.Series | float) -> pd.DataFrame | pd.Series:
    if isinstance(denominator, (int, float)):
        if denominator == 0:
            return numerator * 0
        return numerator / denominator

    safe_denominator = denominator.replace(0, np.nan)
    result = numerator.div(safe_denominator, axis=1 if isinstance(numerator, pd.DataFrame) else 0)
    return result.fillna(0.0)


def run_edas(
    decision_matrix: pd.DataFrame,
    weights: dict[str, float],
    criteria_types: dict[str, str],
) -> EdasResult:
    if decision_matrix.empty:
        raise ValueError("Decision matrix kosong.")

    criteria = list(decision_matrix.columns)

    missing_weights = [column for column in criteria if column not in weights]
    if missing_weights:
        raise ValueError(f"Bobot untuk kriteria berikut belum tersedia: {missing_weights}")

    missing_types = [column for column in criteria if column not in criteria_types]
    if missing_types:
        raise ValueError(f"Jenis kriteria untuk kolom berikut belum tersedia: {missing_types}")

    weights_series = pd.Series({column: float(weights[column]) for column in criteria})
    total_weight = float(weights_series.sum())
    if total_weight <= 0:
        raise ValueError("Total bobot harus lebih dari 0.")

    weights_series = weights_series / total_weight

    matrix = decision_matrix[criteria].astype(float)
    average_solution = matrix.mean(axis=0)

    pda = pd.DataFrame(0.0, index=matrix.index, columns=criteria)
    nda = pd.DataFrame(0.0, index=matrix.index, columns=criteria)

    for criterion in criteria:
        av = average_solution[criterion]
        values = matrix[criterion]
        criterion_type = str(criteria_types[criterion]).lower().strip()

        if criterion_type == "cost":
            pda_column = (av - values).clip(lower=0)
            nda_column = (values - av).clip(lower=0)
        else:
            pda_column = (values - av).clip(lower=0)
            nda_column = (av - values).clip(lower=0)

        if av == 0:
            pda[criterion] = 0.0
            nda[criterion] = 0.0
        else:
            pda[criterion] = pda_column / av
            nda[criterion] = nda_column / av

    weighted_pda = pda.mul(weights_series, axis=1)
    weighted_nda = nda.mul(weights_series, axis=1)

    sp = weighted_pda.sum(axis=1)
    sn = weighted_nda.sum(axis=1)

    max_sp = float(sp.max())
    max_sn = float(sn.max())

    if max_sp == 0:
        nsp = pd.Series(0.0, index=sp.index)
    else:
        nsp = sp / max_sp

    if max_sn == 0:
        nsn = pd.Series(1.0, index=sn.index)
    else:
        nsn = 1 - (sn / max_sn)

    appraisal_score = 0.5 * (nsp + nsn)
    ranking = appraisal_score.rank(ascending=False, method="min").astype(int)

    return EdasResult(
        average_solution=average_solution,
        pda=pda,
        nda=nda,
        sp=sp,
        sn=sn,
        nsp=nsp,
        nsn=nsn,
        appraisal_score=appraisal_score,
        ranking=ranking,
    )