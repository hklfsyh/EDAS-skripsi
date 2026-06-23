// NextResponse buat response api, sql buat koneksi database
import { NextResponse } from "next/server";

import sql from "@/server/db";

// ngecek koneksi database (select 1)
export async function GET() {
  try {
    const result = await sql<{ ok: number }[]>`select 1 as ok`;

    return NextResponse.json(
      {
        status: "ok",
        connected: result[0]?.ok === 1,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        status: "error",
        connected: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
