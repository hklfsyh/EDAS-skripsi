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
};

function formatMinutes(totalSec: number): number {
  return Math.max(0, Math.round(totalSec / 60));
}

function buildGeminiPrompt(body: NlgRequestBody): string {
  const styleModes = [
    "hangat dan suportif seperti teman yang excited ngomongin musik",
    "ringan dan asik, kayak teman chat yang antusias",
    "playful dengan humor tipis tapi tetap nyambung",
    "santai dan relatable, kayak teman yang ngerti vibe kamu",
  ];
  const pickedStyle = styleModes[Math.floor(Math.random() * styleModes.length)];

  const activity = body.context?.activity ?? "aktivitas";
  const timeOfDay = body.context?.timeOfDay ?? "waktu ini";
  const mood = body.context?.mood ?? "suasana netral";
  const targetMin = formatMinutes(body.targetDurationSec ?? 0);
  const totalMin = formatMinutes(body.totalDurationSec ?? 0);
  const count = body.selectedSongs ?? 0;
  const topSongs = (body.topSongs ?? []).slice(0, 3);
  const songList = topSongs.map((song) => `"${song.title}" oleh ${song.artist}`).join(", ");

  return `Kamu adalah teman ngobrol pengguna di aplikasi rekomendasi playlist musik. Gaya kamu: ${pickedStyle}.\n\nData playlist yang sudah digenerate:\n- Aktivitas: ${activity}\n- Waktu: ${timeOfDay}\n- Suasana yang diinginkan: ${mood}\n- Jumlah lagu terpilih: ${count} lagu\n- Durasi total: sekitar ${totalMin} menit (target ${targetMin} menit)\n${songList ? `- Beberapa lagu teratas: ${songList}` : ""}\n\nTugasmu: Komentari hasil playlist ini dengan gaya ngobrol casual bahasa Indonesia. Bayangkan kamu lagi chat sama teman yang baru selesai bikin playlist dan kamu mau kasih reaksi/komentar.\n\nAturan WAJIB:\n- Output hanya 1 paragraf, 3-5 kalimat, TANPA baris baru, TANPA bullet, TANPA markdown\n- Jangan klaim musik bikin lebih produktif/fokus/sembuh — cukup komentar ringan soal pilihan lagu dan durasi\n- Gunakan hanya fakta dari data di atas, jangan tambah angka lain\n- Boleh pakai kata seru seperti "wah", "oke sip", "mantap", "asik", dll\n- Sebutkan 1-2 lagu dari daftar teratas jika ada\n- Variasikan cara membuka kalimat agar tidak monoton\n- Keluarkan HANYA teks narasinya saja, tidak ada penjelasan lain`;
}

function sanitizeNarration(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksUnsafeNarration(text: string): boolean {
  const unsafePatterns = [
    /menyembuhkan/i,
    /terapi/i,
    /depresi/i,
    /cemas( berlebihan)?/i,
    /gangguan mental/i,
    /pasti membuat/i,
    /dijamin/i,
  ];

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

async function generateWithModel(apiKey: string, model: string, prompt: string): Promise<GeminiGenerateResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 1.1,
        topP: 0.95,
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

  if (!narration || narration.length < 10) {
    return {
      text: null,
      reason: "empty_output",
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
}

async function generateWithGemini(body: NlgRequestBody): Promise<GeminiGenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      text: null,
      reason: "missing_api_key",
    };
  }

  const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  const prompt = buildGeminiPrompt(body);

  let lastFailure: GeminiGenerateResult = {
    text: null,
    reason: "gemini_call_failed",
    usedModel: candidateModels[candidateModels.length - 1],
  };

  for (const model of candidateModels) {
    const result = await generateWithModel(apiKey, model, prompt);
    if (result.text) {
      return result;
    }

    lastFailure = result;

    const shouldTryNextModel =
      result.httpStatus === 404 ||
      result.httpStatus === 429 ||
      result.httpStatus === 500 ||
      result.httpStatus === 502 ||
      result.httpStatus === 503 ||
      result.httpStatus === 504;

    if (!shouldTryNextModel) {
      return result;
    }
  }

  return lastFailure;
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
          error: "gemini_generation_failed",
          reason: generated.reason ?? "unknown_error",
          model: generated.usedModel ?? "gemini-1.5-flash",
        },
        { status: generated.httpStatus ?? 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      text: generated.text,
      source: "gemini",
      reason: null,
      model: generated.usedModel ?? "gemini-2.0-flash",
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
