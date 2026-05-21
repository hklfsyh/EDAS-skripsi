import { NextResponse } from "next/server";

import type { PreferenceAspectSummary } from "@/server/utils/preferenceSummary";

type PreferenceSummaryRequestBody = {
  aspects?: PreferenceAspectSummary[];
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

type GeminiAttempt = {
  model: string;
  status: "success" | "timeout" | "failed";
  reason?: string | null;
  httpStatus?: number;
  durationMs: number;
};

type GeminiGenerateResult = {
  text: string | null;
  reason: string | null;
  httpStatus?: number;
  usedModel?: string;
  attempts?: GeminiAttempt[];
};

function sanitizeNarration(text: string): string {
  return text
    .replaceAll("**", "")
    .replaceAll("*", "")
    .replaceAll(/#{1,6}\s/g, "")
    .replaceAll(/\n+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
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

function buildFallbackPreferenceNarrative(aspects: PreferenceAspectSummary[]): string {
  const topAspects = aspects.slice(0, 3);
  if (topAspects.length === 0) {
    return "Dari jawaban kuesioner Anda, sistem membaca preferensi musik secara seimbang tanpa ada satu aspek yang terlalu dominan. Ringkasan ini tetap bisa digunakan sebagai acuan evaluasi UAT.";
  }

  const [first, second, third] = topAspects;
  const firstSentence = `${first.title} menjadi salah satu aspek yang ${first.priorityLabel}, dengan kontribusi sekitar ${first.contributionPercent.toFixed(1)}%.`;
  const secondSentence = second
    ? `${second.title} juga ikut diperhatikan, dan sistem membacanya sebagai ${second.preferenceDirection}.`
    : "Sistem kemudian memakai pembacaan ini untuk menentukan karakter lagu yang lebih sesuai.";
  const thirdSentence = third
    ? `${third.title} dibaca sebagai ${third.preferenceDirection}, sehingga hasil rekomendasi tidak disusun secara acak.`
    : "Pembacaan ini membantu sistem memilih lagu yang paling mendekati karakter sesi Anda.";

  return `${firstSentence} ${secondSentence} ${thirdSentence} Ringkasan ini dapat digunakan sebagai acuan saat mengisi evaluasi UAT.`
    .replace(/\s+/g, " ")
    .trim();
}

function buildGeminiPrompt(aspects: PreferenceAspectSummary[]): string {
  const aspectLines = aspects.slice(0, 6).map((aspect, index) => (
    `${index + 1}. ${aspect.title} | ${aspect.shortLabel} | kontribusi ${aspect.contributionPercent.toFixed(1)}% | arah ${aspect.preferenceDirection} | status ${aspect.criterionLabel}`
  ));

  return `Peran kamu: penjelas ringkasan preferensi pengguna di aplikasi skripsi bernama namu. Tugas kamu hanya mengubah data preferensi yang sudah dihitung sistem menjadi narasi yang ramah untuk pengguna awam.

Data preferensi terhitung:
${aspectLines.join("\n")}

Instruksi output:
- Tulis 1 paragraf bahasa Indonesia, 4 kalimat, tanpa bullet dan tanpa markdown
- Jelaskan bahwa ringkasan ini berasal dari jawaban kuesioner pengguna
- Gunakan bahasa awam, natural, dan hangat
- Jangan tampilkan istilah teknis mentah seperti EDAS, appraisal score, PDA, NDA, SP, SN, decision matrix
- Boleh menyebut persentase kontribusi secara halus jika membantu
- Jangan menyebut JSON, API, model, Gemini, atau sistem internal
- Jangan membuat klaim medis, psikologis, atau janji hasil yang terlalu pasti
- Gunakan nama aplikasi "namu." jika perlu, dengan huruf kecil dan titik
- Tutup dengan kalimat bahwa ringkasan ini bisa dipakai sebagai acuan saat mengisi evaluasi UAT
- Keluaran hanya teks narasi utama`;
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
          temperature: 0.6,
          topP: 0.9,
          maxOutputTokens: 280,
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

    if (!narration || narration.length < 20) {
      return {
        text: null,
        reason: blockedBySafety ? "unsafe_output_filtered" : "empty_output",
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

async function generateWithGemini(aspects: PreferenceAspectSummary[]): Promise<GeminiGenerateResult> {
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
  ];

  const prompt = buildGeminiPrompt(aspects);
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
    const shouldTryNextModel =
      result.httpStatus === 404 ||
      result.httpStatus === 429 ||
      result.httpStatus === 500 ||
      result.httpStatus === 502 ||
      result.httpStatus === 503 ||
      result.httpStatus === 504 ||
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

export async function handlePreferenceSummaryGeneratePost(request: Request) {
  try {
    const body = (await request.json()) as PreferenceSummaryRequestBody;
    const aspects = Array.isArray(body.aspects) ? body.aspects : [];

    if (aspects.length === 0) {
      return NextResponse.json({ error: "Aspek preferensi tidak tersedia." }, { status: 400 });
    }

    const fallback = buildFallbackPreferenceNarrative(aspects);
    const generated = await generateWithGemini(aspects);

    if (!generated.text) {
      return NextResponse.json({
        ok: true,
        text: fallback,
        meta: {
          source: "fallback-local",
          model: generated.usedModel ?? "unknown_model",
          fallbackUsed: true,
          reason: generated.reason ?? "unknown_error",
          attempts: generated.attempts ?? [],
        },
      });
    }

    return NextResponse.json({
      ok: true,
      text: generated.text,
      meta: {
        source: "gemini",
        model: generated.usedModel ?? "gemini-3.1-flash-lite",
        fallbackUsed: false,
        reason: null,
        attempts: generated.attempts ?? [],
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: true,
        text: null,
        meta: {
          source: "fallback-local",
          fallbackUsed: true,
          reason: "unexpected_route_exception",
          attempts: [],
        },
      },
    );
  }
}
