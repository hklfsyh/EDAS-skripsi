import fs from "node:fs";
import path from "node:path";
import sql from "../frontend/src/server/db";

async function runMigration(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");

  const statements = content
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  const fileName = path.basename(filePath);
  console.log(`\nMigration: ${fileName}`);
  console.log("");

  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
      console.log(`  ✓ ${stmt.slice(0, 80)}...`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("already exists") || message.includes("duplicate key")) {
        console.log(`  - Skip (sudah ada)`);
      } else if (message.toLowerCase().includes("relation") && message.toLowerCase().includes("does not exist")) {
        console.log(`  - Skip (tabel referensi belum ada): ${message.slice(0, 80)}`);
      } else {
        console.error(`  ✗ ${message.slice(0, 120)}`);
      }
    }
  }
}

async function main() {
  const migrationsDir = path.resolve(__dirname, "../data/migrations");
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("Tidak ada file migration ditemukan.");
    process.exit(0);
  }

  for (const file of files) {
    await runMigration(path.join(migrationsDir, file));
  }

  console.log("\nSemua migration selesai!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration gagal:", err);
  process.exit(1);
});
