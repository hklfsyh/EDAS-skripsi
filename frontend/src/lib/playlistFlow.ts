// Kunci localStorage untuk menyimpan state alur pembuatan playlist
export const PLAYLIST_CONTEXT_STORAGE_KEY = "playlist-context-v1";
export const PLAYLIST_QUESTIONNAIRE_STORAGE_KEY = "playlist-questionnaire-v1";
export const PLAYLIST_RESULT_STORAGE_KEY = "playlist-result-v1";
export const PLAYLIST_EXCLUDED_IDS_STORAGE_KEY = "playlist-excluded-ids-v1";
export const PLAYLIST_FLOW_FINISHED_STORAGE_KEY = "playlist-flow-finished-v1";

// Daftar kunci flow aktif untuk dibersihkan
const ACTIVE_FLOW_KEYS = [
  PLAYLIST_CONTEXT_STORAGE_KEY,
  PLAYLIST_QUESTIONNAIRE_STORAGE_KEY,
  PLAYLIST_RESULT_STORAGE_KEY,
  PLAYLIST_EXCLUDED_IDS_STORAGE_KEY,
] as const;

// clearActivePlaylistFlow — hapus semua state localStorage dari alur aktif
export function clearActivePlaylistFlow() {
  for (const key of ACTIVE_FLOW_KEYS) {
    localStorage.removeItem(key);
  }
}

// markPlaylistFlowFinished — tandai bahwa alur playlist telah selesai
export function markPlaylistFlowFinished() {
  localStorage.setItem(PLAYLIST_FLOW_FINISHED_STORAGE_KEY, "true");
}

// clearPlaylistFlowFinishedFlag — hapus flag selesai dari localStorage
export function clearPlaylistFlowFinishedFlag() {
  localStorage.removeItem(PLAYLIST_FLOW_FINISHED_STORAGE_KEY);
}

// isPlaylistFlowFinished — cek apakah alur playlist sudah selesai
export function isPlaylistFlowFinished() {
  return localStorage.getItem(PLAYLIST_FLOW_FINISHED_STORAGE_KEY) === "true";
}

// consumeFinishedPlaylistFlow — jika flow selesai, bersihkan state dan kembalikan true
export function consumeFinishedPlaylistFlow() {
  const finished = isPlaylistFlowFinished();
  if (finished) {
    clearActivePlaylistFlow();
    clearPlaylistFlowFinishedFlag();
  }
  return finished;
}
