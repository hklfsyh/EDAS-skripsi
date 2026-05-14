const CLIENT_ID_KEY = "playlist-client-id-v1";

function generateClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2);
  return `client-${Date.now()}-${random}`;
}

export function getOrCreateClientId() {
  if (typeof window === "undefined") {
    return "unknown-client";
  }

  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) {
    return existing;
  }

  const created = generateClientId();
  localStorage.setItem(CLIENT_ID_KEY, created);
  return created;
}
