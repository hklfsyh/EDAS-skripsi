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
    # Validasi input dan bobot kriteria
    if decision_matrix.empty:
        raise ValueError("Decision matrix kosong.")

    criteria = list(decision_matrix.columns)

    missing_weights = [column for column in criteria if column not in weights]
    if missing_weights:
        raise ValueError(f"Bobot untuk kriteria berikut belum tersedia: {missing_weights}")

    missing_types = [column for column in criteria if column not in criteria_types]
    if missing_types:
        raise ValueError(f"Jenis kriteria untuk kolom berikut belum tersedia: {missing_types}")

    # Filter hanya kriteria aktif (benefit/cost), skip inactive
    active_criteria = [
        column for column in criteria
        if str(criteria_types.get(column, "inactive")).lower().strip() != "inactive"
    ]

    if not active_criteria:
        raise ValueError("Tidak ada kriteria aktif untuk perhitungan EDAS.")

    active_weights = {column: float(weights[column]) for column in active_criteria}
    weights_series = pd.Series(active_weights)
    total_weight = float(weights_series.sum())
    if total_weight <= 0:
        raise ValueError("Total bobot harus lebih dari 0.")

    # Normalisasi bobot kriteria
    weights_series = weights_series / total_weight

    matrix = decision_matrix[active_criteria].astype(float)
    # Average solution untuk tiap kriteria
    average_solution = matrix.mean(axis=0)

    pda = pd.DataFrame(0.0, index=matrix.index, columns=active_criteria)
    nda = pd.DataFrame(0.0, index=matrix.index, columns=active_criteria)

    for criterion in active_criteria:
        # Perhitungan PDA dan NDA per kriteria
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

    # Agregasi berbobot PDA dan NDA
    weighted_pda = pda.mul(weights_series, axis=1)
    weighted_nda = nda.mul(weights_series, axis=1)

    sp = weighted_pda.sum(axis=1)
    sn = weighted_nda.sum(axis=1)

    max_sp = float(sp.max())
    max_sn = float(sn.max())

    # Normalisasi SP dan SN
    if max_sp == 0:
        nsp = pd.Series(0.0, index=sp.index)
    else:
        nsp = sp / max_sp

    if max_sn == 0:
        nsn = pd.Series(1.0, index=sn.index)
    else:
        nsn = 1 - (sn / max_sn)

    # Appraisal score dan ranking akhir
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

