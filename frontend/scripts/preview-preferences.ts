import { mapQuestionnaireToPreferences } from "../src/server/utils/preferenceMapping";

const exampleAnswers = [
  5, // q1 tempo cepat
  2, // q2 tempo santai (reverse)
  4, // q3 energy
  2, // q4 energy tenang (reverse)
  5, // q5 energy aktif
  4, // q6 danceability
  4, // q7 danceability
  5, // q8 happiness
  4, // q9 popularity
  3, // q10 acousticness
  4, // q11 instrumentalness
  5, // q12 instrumentalness
  4, // q13 speechiness
  2, // q14 sedikit kata-kata (reverse)
];

const result = mapQuestionnaireToPreferences(exampleAnswers);
console.log(JSON.stringify(result, null, 2));
