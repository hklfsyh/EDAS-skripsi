import { NextResponse } from "next/server";
import sql from "@/server/db";

export type ContextOptionRow = {
  category: string;
  value: string;
  label: string;
  description: string;
  sort_order: number;
};

type CategoryGroup = {
  key: string;
  label: string;
  options: Array<{ value: string; label: string; description?: string }>;
};

const CATEGORY_LABELS: Record<string, string> = {
  activity: "Aktivitas",
  time_category: "Waktu Aktivitas",
  mood: "Suasana Hati",
};

export async function GET() {
  try {
    const rows = await sql<ContextOptionRow[]>`
      SELECT category, value, label, description, sort_order
      FROM context_option
      WHERE is_active = true
      ORDER BY category, sort_order
    `;

    const categoryMap = new Map<string, CategoryGroup>();

    for (const row of rows) {
      if (!categoryMap.has(row.category)) {
        categoryMap.set(row.category, {
          key: row.category,
          label: CATEGORY_LABELS[row.category] ?? row.category,
          options: [],
        });
      }
      categoryMap.get(row.category)!.options.push({
        value: row.value,
        label: row.label,
        description: row.description || undefined,
      });
    }

    const categories = Array.from(categoryMap.values());

    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat opsi konteks." },
      { status: 500 },
    );
  }
}
