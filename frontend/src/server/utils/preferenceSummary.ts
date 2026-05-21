import {
  mapQuestionnaireToPreferences,
  type CriterionType,
  type PreferenceParameter,
} from "@/server/utils/preferenceMapping";

type ParameterCopy = {
  title: string;
  shortLabel: string;
  description: string;
  highLabel: string;
  lowLabel: string;
};

export type PreferenceAspectSummary = {
  parameter: PreferenceParameter;
  title: string;
  shortLabel: string;
  description: string;
  weight: number;
  contributionPercent: number;
  score: number;
  meanLikert: number;
  criterion: CriterionType;
  criterionLabel: string;
  criterionExplanation: string;
  preferenceDirection: string;
  insight: string;
  priorityLabel: string;
};

export type PreferenceNarrativeSummary = {
  intro: string;
  primary: string[];
  secondary: string[];
  avoid: string[];
};

export type PreferenceInterpretation = {
  aspects: PreferenceAspectSummary[];
  narrativeSummary: PreferenceNarrativeSummary;
};

const PARAMETER_COPY: Record<PreferenceParameter, ParameterCopy> = {
  tempo: {
    title: "Ritme lagu",
    shortLabel: "cepat atau santainya lagu",
    description: "menggambarkan cepat atau santainya alur lagu yang terasa saat didengar",
    highLabel: "ritme yang terasa lebih cepat",
    lowLabel: "ritme yang terasa lebih santai",
  },
  energy: {
    title: "Intensitas lagu",
    shortLabel: "semangat atau tenaganya lagu",
    description: "menggambarkan seberapa bersemangat, padat, dan intens karakter musiknya",
    highLabel: "musik yang terasa lebih bersemangat",
    lowLabel: "musik yang terasa lebih lembut dan tidak terlalu intens",
  },
  danceability: {
    title: "Kemudahan mengikuti ritme",
    shortLabel: "enaknya ritme untuk diikuti",
    description: "menggambarkan apakah ritme lagu terasa mudah diikuti atau mengajak tubuh ikut bergerak",
    highLabel: "ritme yang lebih enak diikuti atau digerakkan",
    lowLabel: "ritme yang tidak terlalu mendorong untuk ikut bergerak",
  },
  happiness: {
    title: "Nuansa ceria",
    shortLabel: "kesan ceria atau positif",
    description: "menggambarkan kesan ceria, hangat, atau positif yang terasa dari lagu",
    highLabel: "nuansa yang lebih ceria dan positif",
    lowLabel: "nuansa yang lebih tenang dan tidak terlalu ceria",
  },
  popularity: {
    title: "Kesan familiar",
    shortLabel: "familiar atau tidaknya lagu",
    description: "menggambarkan apakah lagu cenderung terasa familiar atau tidak terlalu bergantung pada kepopuleran",
    highLabel: "lagu yang terasa lebih familiar",
    lowLabel: "lagu yang tidak terlalu bergantung pada kesan familiar",
  },
  acousticness: {
    title: "Sentuhan akustik",
    shortLabel: "kesan alami atau akustik",
    description: "menggambarkan seberapa terasa unsur alami, organik, atau akustik dalam lagu",
    highLabel: "sentuhan akustik yang lebih terasa",
    lowLabel: "nuansa yang tidak terlalu menonjolkan unsur akustik",
  },
  instrumentalness: {
    title: "Dominasi instrumen",
    shortLabel: "banyaknya instrumen dibanding vokal",
    description: "menggambarkan apakah lagu memberi ruang lebih besar pada permainan instrumen dibanding vokal",
    highLabel: "musik yang memberi ruang lebih besar pada instrumen",
    lowLabel: "musik yang lebih menonjolkan unsur vokal",
  },
  speechiness: {
    title: "Dominasi kata-kata",
    shortLabel: "banyak atau sedikitnya kata-kata",
    description: "menggambarkan seberapa dominan unsur kata-kata, ucapan, atau lirik yang terasa dalam lagu",
    highLabel: "unsur kata-kata atau lirik yang lebih dominan",
    lowLabel: "musik yang tidak terlalu padat oleh kata-kata",
  },
};

function toPercent(weight: number): number {
  return Number((weight * 100).toFixed(1));
}

function buildCriterionCopy(criterion: CriterionType): {
  criterionLabel: string;
  criterionExplanation: string;
} {
  if (criterion === "benefit") {
    return {
      criterionLabel: "lebih tinggi diprioritaskan",
      criterionExplanation: "Sistem membaca bahwa nilai yang lebih tinggi pada aspek ini lebih diprioritaskan.",
    };
  }

  if (criterion === "cost") {
    return {
      criterionLabel: "lebih rendah diprioritaskan",
      criterionExplanation: "Sistem membaca bahwa nilai yang lebih rendah pada aspek ini lebih diprioritaskan.",
    };
  }

  return {
    criterionLabel: "dibaca netral atau sedang",
    criterionExplanation: "Sistem membaca aspek ini dalam posisi sedang atau netral, jadi tidak terlalu condong ke sisi tertentu.",
  };
}

function buildPriorityLabel(weightPercent: number): string {
  if (weightPercent >= 14) return "cukup dominan";
  if (weightPercent >= 11) return "cukup diperhatikan";
  if (weightPercent >= 9) return "pendukung";
  return "tidak terlalu diprioritaskan";
}

function buildPreferenceDirection(parameter: PreferenceParameter, criterion: CriterionType): string {
  const copy = PARAMETER_COPY[parameter];
  if (criterion === "benefit") return copy.highLabel;
  if (criterion === "cost") return copy.lowLabel;
  return "posisi yang cenderung sedang atau seimbang";
}

function buildInsight(
  parameter: PreferenceParameter,
  criterion: CriterionType,
  contributionPercent: number,
): string {
  const copy = PARAMETER_COPY[parameter];
  const contributionText = `${contributionPercent.toFixed(1)}%`;

  if (criterion === "benefit") {
    return `Sistem melihat bahwa ${copy.highLabel} cukup berpengaruh, dengan kontribusi sekitar ${contributionText}.`;
  }

  if (criterion === "cost") {
    return `Sistem melihat bahwa ${copy.lowLabel} lebih diprioritaskan, dengan kontribusi sekitar ${contributionText}.`;
  }

  return `Sistem membaca aspek ${copy.shortLabel} dalam posisi sedang, dengan kontribusi sekitar ${contributionText}.`;
}

export function buildPreferenceInterpretation(
  answers: Record<number, number> | number[],
): PreferenceInterpretation {
  const preferences = mapQuestionnaireToPreferences(answers);
  const aspects = (Object.entries(preferences.parameters) as Array<
    [PreferenceParameter, (typeof preferences.parameters)[PreferenceParameter]]
  >)
    .map(([parameter, info]) => {
      const copy = PARAMETER_COPY[parameter];
      const contributionPercent = toPercent(info.weight);
      const criterionCopy = buildCriterionCopy(info.criterion);

      return {
        parameter,
        title: copy.title,
        shortLabel: copy.shortLabel,
        description: copy.description,
        weight: info.weight,
        contributionPercent,
        score: info.score,
        meanLikert: info.meanLikert,
        criterion: info.criterion,
        criterionLabel: criterionCopy.criterionLabel,
        criterionExplanation: criterionCopy.criterionExplanation,
        preferenceDirection: buildPreferenceDirection(parameter, info.criterion),
        insight: buildInsight(parameter, info.criterion, contributionPercent),
        priorityLabel: buildPriorityLabel(contributionPercent),
      } satisfies PreferenceAspectSummary;
    })
    .sort((a, b) => b.weight - a.weight);

  const primary = aspects
    .filter((aspect) => aspect.criterion === "benefit")
    .slice(0, 2)
    .map((aspect) => aspect.preferenceDirection);
  const secondary = aspects
    .filter((aspect) => aspect.criterion === "neutral")
    .slice(0, 2)
    .map((aspect) => `${aspect.title.toLowerCase()} yang cenderung sedang`);
  const avoid = aspects
    .filter((aspect) => aspect.criterion === "cost")
    .slice(0, 2)
    .map((aspect) => aspect.preferenceDirection);

  return {
    aspects,
    narrativeSummary: {
      intro:
        "Ringkasan ini menjelaskan bagaimana jawaban kuesioner Anda dibaca oleh sistem sebelum playlist dihitung menggunakan EDAS. Gunakan ringkasan ini sebagai acuan saat mengisi bagian evaluasi UAT pada Google Form.",
      primary,
      secondary,
      avoid,
    },
  };
}
