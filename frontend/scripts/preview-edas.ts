import { mapQuestionnaireToPreferences } from "../src/server/utils/preferenceMapping";
import { buildPlaylistFromRanking, runEdasRanking, type SongCandidate } from "../src/server/utils/edas";

const exampleAnswers = [
  4, 2, 5, 2, 4, 4, 3, 5, 4, 3, 4, 5, 4, 2,
];

const sampleSongs: SongCandidate[] = [
  {
    id_song: 1,
    title: "Song A",
    artist: "Artist One",
    duration_ms: 210000,
    tempo: 120,
    energy: 70,
    danceability: 65,
    happiness: 60,
    popularity: 80,
    acousticness: 20,
    instrumentalness: 10,
    speechiness: 30,
  },
  {
    id_song: 2,
    title: "Song B",
    artist: "Artist Two",
    duration_ms: 185000,
    tempo: 95,
    energy: 45,
    danceability: 55,
    happiness: 40,
    popularity: 60,
    acousticness: 70,
    instrumentalness: 40,
    speechiness: 15,
  },
  {
    id_song: 3,
    title: "Song C",
    artist: "Artist Three",
    duration_ms: 240000,
    tempo: 140,
    energy: 85,
    danceability: 75,
    happiness: 78,
    popularity: 90,
    acousticness: 10,
    instrumentalness: 5,
    speechiness: 25,
  },
];

const preferences = mapQuestionnaireToPreferences(exampleAnswers);
const ranked = runEdasRanking(sampleSongs, preferences);
const playlist = buildPlaylistFromRanking(ranked, 10);

console.log("Preferences:");
console.log(JSON.stringify(preferences, null, 2));
console.log("Ranked:");
console.log(JSON.stringify(ranked, null, 2));
console.log("Playlist:");
console.log(JSON.stringify(playlist, null, 2));
