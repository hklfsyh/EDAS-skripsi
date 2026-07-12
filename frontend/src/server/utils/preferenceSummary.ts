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
  isActive: boolean;
  criterion: CriterionType | null;
  criterionLabel: string;
  criterionExplanation: string;
  preferenceDirection: string;
  userFriendlyDirection: string;
  insight: string;
  priorityLabel: string;
};

export type PreferenceNarrativeSummary = {
  intro: string;
  primary: string[];
  secondary: string[];
  inactive: string[];
};

export type PreferenceInterpretation = {
  aspects: PreferenceAspectSummary[];
  narrativeSummary: PreferenceNarrativeSummary;
};

export type PreferenceAspectNarratives = Record<PreferenceParameter, string>;

const PARAMETER_COPY: Record<PreferenceParameter, ParameterCopy> = {
  tempo: {
    title: "Ritme lagu",
    shortLabel: "cepat atau santainya lagu",
    description: "menggambarkan cepat atau santainya alur lagu yang terasa saat didengar",
    highLabel: "lagu yang ritmenya lebih cepat",
    lowLabel: "lagu yang ritmenya lebih santai",
  },
  energy: {
    title: "Intensitas lagu",
    shortLabel: "semangat atau tenaganya lagu",
    description: "menggambarkan seberapa bersemangat, padat, dan intens karakter musiknya",
    highLabel: "lagu yang terasa lebih bersemangat",
    lowLabel: "lagu yang lebih lembut dan tidak terlalu ramai",
  },
  danceability: {
    title: "Kemudahan mengikuti ritme",
    shortLabel: "enaknya ritme untuk diikuti",
    description: "menggambarkan apakah ritme lagu terasa mudah diikuti atau mengajak tubuh ikut bergerak",
    highLabel: "lagu yang ritmenya enak diikuti",
    lowLabel: "lagu yang tidak terlalu mengajak bergerak",
  },
  happiness: {
    title: "Nuansa ceria",
    shortLabel: "kesan ceria atau positif",
    description: "menggambarkan kesan ceria, hangat, atau positif yang terasa dari lagu",
    highLabel: "lagu yang terasa ceria dan positif",
    lowLabel: "lagu yang lebih tenang dan tidak terlalu ceria",
  },
  popularity: {
    title: "Kesan familiar",
    shortLabel: "familiar atau tidaknya lagu",
    description: "menggambarkan apakah lagu cenderung terasa familiar atau tidak terlalu bergantung pada kepopuleran",
    highLabel: "lagu yang terasa familiar",
    lowLabel: "lagu yang tidak terlalu bergantung pada kesan familiar",
  },
  acousticness: {
    title: "Sentuhan akustik",
    shortLabel: "kesan alami atau akustik",
    description: "menggambarkan seberapa terasa unsur alami, organik, atau akustik dalam lagu",
    highLabel: "lagu yang terdengar alami atau akustik",
    lowLabel: "lagu yang tidak terlalu akustik",
  },
  instrumentalness: {
    title: "Dominasi instrumen",
    shortLabel: "banyaknya instrumen dibanding vokal",
    description: "menggambarkan apakah lagu memberi ruang lebih besar pada permainan instrumen dibanding vokal",
    highLabel: "lagu yang lebih banyak menonjolkan instrumen",
    lowLabel: "lagu yang vokalnya masih terasa",
  },
  speechiness: {
    title: "Dominasi kata-kata",
    shortLabel: "banyak atau sedikitnya kata-kata",
    description: "menggambarkan seberapa dominan unsur kata-kata, ucapan, atau lirik yang terasa dalam lagu",
    highLabel: "lagu yang kata-kata atau liriknya lebih menonjol",
    lowLabel: "lagu yang tidak terlalu banyak kata-kata",
  },
};

function toPercent(weight: number): number {
  return Number((weight * 100).toFixed(1));
}

const USER_FRIENDLY_DIRECTIONS: Record<PreferenceParameter, Record<string, string>> = {
  tempo: { benefit: "lebih suka ritme cepat", cost: "lebih suka ritme santai" },
  energy: { benefit: "lebih suka lagu bersemangat", cost: "lebih suka lagu lembut" },
  danceability: { benefit: "ritme enak diikuti", cost: "tidak terlalu ingin bergerak" },
  happiness: { benefit: "lebih suka nuansa ceria", cost: "lebih suka nuansa tenang" },
  popularity: { benefit: "lebih suka lagu familiar", cost: "tidak harus lagu familiar" },
  acousticness: { benefit: "lebih suka kesan akustik", cost: "tidak terlalu akustik" },
  instrumentalness: { benefit: "lebih suka banyak instrumen", cost: "lebih suka vokal terasa" },
  speechiness: { benefit: "lebih suka lirik terasa", cost: "tidak terlalu banyak kata" },
};

function buildUserFriendlyDirectionLabel(parameter: PreferenceParameter, criterion: CriterionType | null): string {
  if (!criterion) return "tidak dihitung dalam EDAS";
  return USER_FRIENDLY_DIRECTIONS[parameter]?.[criterion] ?? "";
}

function buildCriterionCopy(criterion: CriterionType | null): {
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
    criterionLabel: "tidak aktif",
    criterionExplanation: "Dari jawaban kamu, aspek ini berada tepat di titik tengah skala. Karena itu, parameter ini tidak digunakan sebagai kriteria aktif dalam perhitungan EDAS.",
  };
}

function buildPriorityLabel(weightPercent: number, isActive: boolean): string {
  if (!isActive) return "tidak aktif";
  if (weightPercent >= 14) return "cukup dominan";
  if (weightPercent >= 11) return "cukup diperhatikan";
  if (weightPercent >= 9) return "pendukung";
  return "tidak terlalu diprioritaskan";
}

function buildPreferenceDirection(parameter: PreferenceParameter, criterion: CriterionType | null): string {
  const copy = PARAMETER_COPY[parameter];
  if (criterion === "benefit") return copy.highLabel;
  if (criterion === "cost") return copy.lowLabel;
  return "titik tengah skala — tidak dihitung dalam EDAS";
}

function buildInsight(
  parameter: PreferenceParameter,
  criterion: CriterionType | null,
  contributionPercent: number,
  isActive: boolean,
): string {
  const copy = PARAMETER_COPY[parameter];

  if (!isActive) {
    return `Dari jawaban kamu, aspek ${copy.shortLabel} berada tepat di titik tengah skala. Karena itu, parameter ini tidak digunakan sebagai kriteria aktif dalam perhitungan EDAS.`;
  }

  const contributionText = `${contributionPercent.toFixed(1)}%`;

  if (criterion === "benefit") {
    return `Sistem melihat bahwa ${copy.highLabel} cukup berpengaruh, dengan kontribusi sekitar ${contributionText}.`;
  }

  return `Sistem melihat bahwa ${copy.lowLabel} lebih diprioritaskan, dengan kontribusi sekitar ${contributionText}.`;
}

function buildAspectNarrative(
  parameter: PreferenceParameter,
  criterion: CriterionType | null,
  isActive: boolean,
): string {
  const copy = PARAMETER_COPY[parameter];

  if (!isActive) {
    return `Dari jawaban kamu, preferensi untuk ${copy.shortLabel} berada tepat di titik tengah skala. Karena itu, parameter ini tidak digunakan sebagai kriteria aktif dalam perhitungan EDAS.`;
  }

  if (criterion === "benefit") {
    return `Dari jawaban Anda, sistem membaca bahwa ${copy.highLabel} cukup berpengaruh dalam preferensi Anda.`;
  }

  return `Sistem membaca bahwa ${copy.lowLabel} lebih diprioritaskan dalam sesi ini.`;
}

function buildContributionSentence(percent: number): string {
  if (percent >= 14) return "Pengaruhnya cukup besar, jadi bagian ini ikut menentukan playlist.";
  if (percent >= 11) return "Pengaruhnya cukup terasa dalam pembentukan playlist.";
  if (percent >= 9) return "Pengaruhnya ada, tapi bukan yang paling utama.";
  return "Pengaruhnya kecil, jadi bagian ini tidak terlalu menentukan playlist.";
}

export function buildPreferenceAspectMeaning(aspect: PreferenceAspectSummary): string {
  if (!aspect.isActive) {
    return `Dari jawaban kamu, aspek ini berada tepat di titik tengah skala. Karena itu, parameter ini tidak digunakan sebagai kriteria aktif dalam perhitungan EDAS.`;
  }

  const sentence = buildContributionSentence(aspect.contributionPercent);

  if (aspect.criterion === "benefit") {
    return `Dari jawaban kamu, sistem melihat kamu cukup menyukai ${aspect.preferenceDirection}. ${sentence}`;
  }

  return `Dari jawaban kamu, sistem melihat kamu lebih cocok dengan ${aspect.preferenceDirection}. ${sentence}`;
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
        isActive: info.isActive,
        criterion: info.criterion,
        criterionLabel: criterionCopy.criterionLabel,
        criterionExplanation: criterionCopy.criterionExplanation,
        preferenceDirection: buildPreferenceDirection(parameter, info.criterion),
        userFriendlyDirection: buildUserFriendlyDirectionLabel(parameter, info.criterion),
        insight: buildInsight(parameter, info.criterion, contributionPercent, info.isActive),
        priorityLabel: buildPriorityLabel(contributionPercent, info.isActive),
      } satisfies PreferenceAspectSummary;
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.weight - a.weight;
    });

  const primary = aspects
    .filter((aspect) => aspect.isActive && aspect.criterion === "benefit")
    .slice(0, 2)
    .map((aspect) => aspect.preferenceDirection);
  const secondary = aspects
    .filter((aspect) => aspect.isActive && aspect.criterion === "cost")
    .slice(0, 2)
    .map((aspect) => aspect.preferenceDirection);
  const inactive = aspects
    .filter((aspect) => !aspect.isActive)
    .slice(0, 2)
    .map((aspect) => `${aspect.title.toLowerCase()} (tidak dihitung dalam EDAS)`);

  return {
    aspects,
    narrativeSummary: {
      intro:
        "Ringkasan ini menjelaskan bagaimana jawaban kuesioner Anda dibaca oleh sistem sebelum playlist dihitung menggunakan EDAS. Gunakan ringkasan ini sebagai acuan saat mengisi bagian evaluasi UAT pada Google Form.",
      primary,
      secondary,
      inactive,
    },
  };
}

export function buildPreferenceAspectNarratives(
  interpretation: PreferenceInterpretation,
): PreferenceAspectNarratives {
  return interpretation.aspects.reduce((acc, aspect) => {
    acc[aspect.parameter] = buildAspectNarrative(aspect.parameter, aspect.criterion, aspect.isActive);
    return acc;
  }, {} as PreferenceAspectNarratives);
}
