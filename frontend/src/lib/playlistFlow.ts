export const PLAYLIST_CONTEXT_STORAGE_KEY = "playlist-context-v1";
export const PLAYLIST_QUESTIONNAIRE_STORAGE_KEY = "playlist-questionnaire-v1";
export const PLAYLIST_RESULT_STORAGE_KEY = "playlist-result-v1";
export const PLAYLIST_EXCLUDED_IDS_STORAGE_KEY = "playlist-excluded-ids-v1";
export const PLAYLIST_FLOW_FINISHED_STORAGE_KEY = "playlist-flow-finished-v1";

const ACTIVE_FLOW_KEYS = [
  PLAYLIST_CONTEXT_STORAGE_KEY,
  PLAYLIST_QUESTIONNAIRE_STORAGE_KEY,
  PLAYLIST_RESULT_STORAGE_KEY,
  PLAYLIST_EXCLUDED_IDS_STORAGE_KEY,
] as const;

export function clearActivePlaylistFlow() {
  for (const key of ACTIVE_FLOW_KEYS) {
    localStorage.removeItem(key);
  }
}

export function markPlaylistFlowFinished() {
  localStorage.setItem(PLAYLIST_FLOW_FINISHED_STORAGE_KEY, "true");
}

export function clearPlaylistFlowFinishedFlag() {
  localStorage.removeItem(PLAYLIST_FLOW_FINISHED_STORAGE_KEY);
}

export function isPlaylistFlowFinished() {
  return localStorage.getItem(PLAYLIST_FLOW_FINISHED_STORAGE_KEY) === "true";
}

export function consumeFinishedPlaylistFlow() {
  const finished = isPlaylistFlowFinished();
  if (finished) {
    clearActivePlaylistFlow();
    clearPlaylistFlowFinishedFlag();
  }
  return finished;
}
