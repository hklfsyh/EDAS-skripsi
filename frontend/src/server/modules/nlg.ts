import { NextResponse } from "next/server";

type NlgContext = {
  activity?: string;
  timeOfDay?: string;
  mood?: string;
};

type NlgTopSong = {
  title: string;
  artist: string;
};

type NlgRequestBody = {
  context?: NlgContext;
  targetDurationSec?: number;
  totalDurationSec?: number;
  selectedSongs?: number;
  topSongs?: NlgTopSong[];
  preferenceSummary?: {
    primary?: string[];
    secondary?: string[];
    avoid?: string[];
  };
};

type GeminiPart = {
  text?: string;
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[];
  };
  finishReason?: string;
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  error?: {
    message?: string;
    code?: number;
    status?: string;
  };
};

type GeminiGenerateResult = {
  text: string | null;
  reason: string | null;
  httpStatus?: number;
  usedModel?: string;
  attempts?: GeminiAttempt[];
};

type GeminiAttempt = {
  model: string;
  status: "success" | "timeout" | "failed";
  reason?: string | null;
  httpStatus?: number;
  durationMs: number;
};

function formatMinutes(totalSec: number): number {
  return Math.max(0, Math.round(totalSec / 60));
}

function buildGeminiPrompt(body: NlgRequestBody): string {
  const activity = body.context?.activity ?? "aktivitas";
  const timeOfDay = body.context?.timeOfDay ?? "waktu ini";
  const mood = body.context?.mood ?? "suasana netral";
  const targetMin = formatMinutes(body.targetDurationSec ?? 0);
  const totalMin = formatMinutes(body.totalDurationSec ?? 0);
  const count = body.selectedSongs ?? 0;
  const topSongs = (body.topSongs ?? []).slice(0, 3);
  const songList = topSongs.map((song) => `"${song.title}" oleh ${song.artist}`).join(", ");
  const summary = body.preferenceSummary ?? {};
  const primary = (summary.primary ?? []).slice(0, 2).join(", ");
  const secondary = (summary.secondary ?? []).slice(0, 2).join(", ");
  const avoid = (summary.avoid ?? []).slice(0, 2).join(", ");

  return `Peran kamu: penjelas rekomendasi playlist di aplikasi skripsi. Tugas kamu hanya menjelaskan hasil rekomendasi, bukan menghitung ranking atau memberi saran medis/psikologis.

Data sesi:
- Aktivitas: ${activity}
- Waktu: ${timeOfDay}
- Suasana saat ini: ${mood}
- Target durasi: ${targetMin} menit
- Durasi total playlist: ${totalMin} menit
- Jumlah lagu terpilih: ${count} lagu
${songList ? `- Lagu teratas: ${songList}` : ""}
${primary ? `- Kecenderungan utama: ${primary}` : ""}
${secondary ? `- Kecenderungan tambahan: ${secondary}` : ""}
${avoid ? `- Tidak terlalu diprioritaskan: ${avoid}` : ""}

Instruksi output:
- Tulis 1 paragraf bahasa Indonesia, 4 kalimat, tanpa bullet dan tanpa markdown
- Gaya bahasa harus natural, hangat, dan enak dibaca
- Jangan terlalu formal seperti laporan
- Jangan terlalu santai, jangan sok asik, jangan norak
- Awali dengan penjelasan bahwa dari jawaban kuesioner yang diisi, sesi ini terlihat lebih cocok dengan karakter musik tertentu
- Jelaskan bahwa playlist kemudian lebih memprioritaskan lagu-lagu yang paling selaras / paling cocok dengan karakter tersebut
- Jelaskan bahwa hasilnya bukan sekadar dipilih acak, tetapi disusun dari lagu yang tingkat kecocokannya lebih tinggi dibanding kandidat lain
- Sebutkan 1-2 lagu teratas jika ada, hanya sebagai contoh pendukung
- Tutup dengan kalimat ringan yang menekankan bahwa playlist ini dibuat agar tetap nyambung untuk sesi yang dipilih
- Jangan gunakan frasa seperti "preferensi kuat", "dirancang agar", "membuat lebih nyaman", "lebih teratur", atau frasa lain yang terdengar terlalu administratif atau menjanjikan efek
- Jangan menyebut EDAS, appraisal score, bobot, ranking, decision matrix, atau istilah teknis lain
- Jangan membuat klaim medis, psikologis, atau klaim hasil yang terlalu pasti
- Wajib gunakan frasa "suasana saat ini"
- Keluaran hanya teks narasi utama`;
}

function sanitizeNarration(text: string): string {
  return text
    .replaceAll("**", "")
    .replaceAll("*", "")
    .replaceAll(/#{1,6}\s/g, "")
    .replaceAll(/\n+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function looksUnsafeNarration(text: string): boolean {
  const unsafePatterns = [/menyembuhkan/i, /diagnosis/i, /gangguan mental/i, /pasti membuat/i, /dijamin/i];

  return unsafePatterns.some((pattern) => pattern.test(text));
}

function extractTextFromCandidates(candidates: GeminiCandidate[]): string {
  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? [];
    const texts = parts
      .map((part) => part.text ?? "")
      .filter((text) => text.trim().length > 0)
      .join(" ")
      .trim();

    if (texts.length > 20) {
      return texts;
    }
  }

  return "";
}

async function generateWithModel(
  apiKey: string,
  model: string,
  prompt: string,
  timeoutMs: number,
): Promise<GeminiGenerateResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          topP: 0.9,
          maxOutputTokens: 300,
          ...(model.includes("2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });

    if (!response.ok) {
      let reason = `gemini_http_${response.status}`;
      try {
        const failedPayload = (await response.json()) as GeminiResponse;
        const message = failedPayload.error?.message?.trim() ?? "";
        if (message) reason = `${reason}:${message.slice(0, 200)}`;
      } catch {
        const raw = await response.text().catch(() => "");
        if (raw) reason = `${reason}:${raw.slice(0, 200)}`;
      }

      return {
        text: null,
        reason,
        httpStatus: response.status,
        usedModel: model,
      };
    }

    const payload = (await response.json()) as GeminiResponse;
    const rawText = extractTextFromCandidates(payload.candidates ?? []);
    const narration = sanitizeNarration(rawText);
    const blockedBySafety = (payload.candidates ?? []).some(
      (candidate) => (candidate.finishReason ?? "").toUpperCase() === "SAFETY",
    );

    if (!narration || narration.length < 10) {
      return {
        text: null,
        reason: blockedBySafety ? "unsafe_output_filtered" : "empty_output",
        usedModel: model,
      };
    }

    if (looksUnsafeNarration(narration)) {
      return {
        text: null,
        reason: "unsafe_output_filtered",
        usedModel: model,
      };
    }

    return {
      text: narration,
      reason: null,
      usedModel: model,
    };
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    return {
      text: null,
      reason: isAbort ? "timeout" : "network_or_unexpected",
      httpStatus: isAbort ? 408 : undefined,
      usedModel: model,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateWithGemini(body: NlgRequestBody): Promise<GeminiGenerateResult> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim().replaceAll(/^['"]|['"]$/g, "");
  if (!apiKey) {
    return {
      text: null,
      reason: "missing_api_key",
    };
  }

  if (/^(your_|isi_)/i.test(apiKey)) {
    return {
      text: null,
      reason: "invalid_api_key_config",
    };
  }

  const candidateModels: Array<{ model: string; timeoutMs: number }> = [
    { model: "gemini-3.1-flash-lite", timeoutMs: 12000 },
    { model: "gemini-2.5-flash-lite", timeoutMs: 10000 },
    { model: "gemini-2.5-flash", timeoutMs: 10000 },
    { model: "gemini-3-flash-preview", timeoutMs: 10000 },
  ];
  const prompt = buildGeminiPrompt(body);
  const attempts: GeminiAttempt[] = [];

  let lastFailure: GeminiGenerateResult = {
    text: null,
    reason: "gemini_call_failed",
    usedModel: candidateModels.at(-1)?.model,
  };

  for (const entry of candidateModels) {
    const startedAt = Date.now();
    const result = await generateWithModel(apiKey, entry.model, prompt, entry.timeoutMs);
    const durationMs = Math.max(0, Date.now() - startedAt);
    const attemptStatus: GeminiAttempt["status"] = result.text
      ? "success"
      : result.reason === "timeout"
        ? "timeout"
        : "failed";
    attempts.push({
      model: entry.model,
      status: attemptStatus,
      reason: result.reason,
      httpStatus: result.httpStatus,
      durationMs,
    });
    if (result.text) {
      return { ...result, attempts };
    }

    lastFailure = result;

    const isLocationUnsupported =
      result.httpStatus === 400 && (result.reason ?? "").toLowerCase().includes("location is not supported");

    const shouldTryNextModel =
      result.httpStatus === 404 ||
      result.httpStatus === 429 ||
      result.httpStatus === 500 ||
      result.httpStatus === 502 ||
      result.httpStatus === 503 ||
      result.httpStatus === 504 ||
      isLocationUnsupported ||
      result.reason === "empty_output" ||
      result.reason === "unsafe_output_filtered" ||
      result.reason === "timeout" ||
      result.reason === "network_or_unexpected";

    if (!shouldTryNextModel) {
      return { ...result, attempts };
    }
  }

  return { ...lastFailure, attempts };
}

export async function handleNlgGeneratePost(request: Request) {
  try {
    const body = (await request.json()) as NlgRequestBody;

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload NLG tidak valid." }, { status: 400 });
    }

    const generated = await generateWithGemini(body);
    if (!generated.text) {
      return NextResponse.json(
        {
          ok: false,
          text: null,
          meta: {
            source: "gemini",
            model: generated.usedModel ?? "unknown_model",
            reason: generated.reason ?? "unknown_error",
            attempts: generated.attempts ?? [],
          },
        },
        { status: generated.httpStatus ?? 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      text: generated.text,
      meta: {
        source: "gemini",
        model: generated.usedModel ?? "gemini-3.1-flash-lite",
        reason: null,
        attempts: generated.attempts ?? [],
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "nlg_route_exception",
        reason: "unexpected_route_exception",
      },
      { status: 500 },
    );
  }
}
