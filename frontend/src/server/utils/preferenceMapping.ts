export type PreferenceParameter =
  | "tempo"
  | "energy"
  | "danceability"
  | "happiness"
  | "popularity"
  | "acousticness"
  | "instrumentalness"
  | "speechiness";

export type CriterionType = "benefit" | "cost" | "neutral";

export type ParameterPreference = {
  score: number;
  weight: number;
  meanLikert: number;
  criterion: CriterionType;
};

export type PreferenceResult = {
  parameters: Record<PreferenceParameter, ParameterPreference>;
  weights: Record<PreferenceParameter, number>;
  scores: Record<PreferenceParameter, number>;
  criteria: Record<PreferenceParameter, CriterionType>;
};

type QuestionMapping = {
  parameter: PreferenceParameter;
  questions: Array<{ index: number; reverse: boolean }>;
};

// Mapping butir kuesioner ke parameter audio
const QUESTION_MAPPINGS: QuestionMapping[] = [
  {
    parameter: "tempo",
    questions: [
      { index: 1, reverse: false },
      { index: 2, reverse: true },
    ],
  },
  {
    parameter: "energy",
    questions: [
      { index: 3, reverse: false },
      { index: 4, reverse: true },
      { index: 5, reverse: false },
    ],
  },
  {
    parameter: "danceability",
    questions: [
      { index: 6, reverse: false },
      { index: 7, reverse: false },
    ],
  },
  {
    parameter: "happiness",
    questions: [{ index: 8, reverse: false }],
  },
  {
    parameter: "popularity",
    questions: [{ index: 9, reverse: false }],
  },
  {
    parameter: "acousticness",
    questions: [{ index: 10, reverse: false }],
  },
  {
    parameter: "instrumentalness",
    questions: [
      { index: 11, reverse: false },
      { index: 12, reverse: false },
    ],
  },
  {
    parameter: "speechiness",
    questions: [
      { index: 13, reverse: false },
      { index: 14, reverse: true },
    ],
  },
];

export function normalizeQuestionnaireAnswers(
  answers?: Record<number, number> | number[] | null,
): number[] {
  if (!answers) {
    return [];
  }

  if (Array.isArray(answers)) {
    return answers.map(Number);
  }

  const numericKeys = Object.keys(answers)
    .map(Number)
    .filter((key) => Number.isFinite(key))
    .sort((a, b) => a - b);

  const usesOneBasedIndex =
    numericKeys.length > 0 &&
    !numericKeys.includes(0) &&
    numericKeys.every((key) => key >= 1 && key <= 14);

  const values = new Array<number>(14).fill(Number.NaN);

  for (const key of numericKeys) {
    const targetIndex = usesOneBasedIndex ? key - 1 : key;
    if (targetIndex >= 0 && targetIndex < 14) {
      values[targetIndex] = Number(answers[key]);
    }
  }

  return values;
}

// Validasi jawaban kuesioner 1-5
function validateAnswers(values: number[]): void {
  if (values.length < 14) {
    throw new Error("Jawaban kuesioner harus berisi 14 butir.");
  }

  values.slice(0, 14).forEach((value, index) => {
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      throw new Error(`Jawaban butir ${index + 1} harus bernilai 1-5.`);
    }
  });
}

// Reverse scoring untuk butir terbalik
function adjustLikert(value: number, reverse: boolean): number {
  return reverse ? 6 - value : value;
}

function likertToScore(value: number): number {
  const normalized = (value - 1) / 4;
  return Number((normalized * 100).toFixed(2));
}

// Klasifikasi benefit / cost / neutral
function classifyCriterion(meanLikert: number): CriterionType {
  if (meanLikert > 3) return "benefit";
  if (meanLikert < 3) return "cost";
  return "neutral";
}

export function mapQuestionnaireToPreferences(
  answers: Record<number, number> | number[],
): PreferenceResult {
  // Konversi jawaban kuesioner ke preferensi parameter
  const values = normalizeQuestionnaireAnswers(answers);
  validateAnswers(values);

  const parameters = {} as Record<PreferenceParameter, ParameterPreference>;
  let scoreSum = 0;

  for (const mapping of QUESTION_MAPPINGS) {
    // Agregasi nilai Likert per parameter
    const adjustedValues = mapping.questions.map(({ index, reverse }) => {
      const raw = values[index - 1];
      return adjustLikert(raw, reverse);
    });

    const meanLikert =
      adjustedValues.reduce((sum, value) => sum + value, 0) / adjustedValues.length;
    const score = likertToScore(meanLikert);
    const criterion = classifyCriterion(meanLikert);

    parameters[mapping.parameter] = {
      score,
      weight: 0,
      meanLikert: Number(meanLikert.toFixed(2)),
      criterion,
    };

    scoreSum += score;
  }

  const weights = {} as Record<PreferenceParameter, number>;
  const scores = {} as Record<PreferenceParameter, number>;
  const criteria = {} as Record<PreferenceParameter, CriterionType>;

  const fallbackWeight = Number((1 / QUESTION_MAPPINGS.length).toFixed(6));

  // Normalisasi bobot parameter
  for (const mapping of QUESTION_MAPPINGS) {
    const parameter = mapping.parameter;
    const score = parameters[parameter].score;
    const weight = scoreSum > 0 ? Number((score / scoreSum).toFixed(6)) : fallbackWeight;

    parameters[parameter].weight = weight;
    weights[parameter] = weight;
    scores[parameter] = score;
    criteria[parameter] = parameters[parameter].criterion;
  }

  return {
    parameters,
    weights,
    scores,
    criteria,
  };
}
