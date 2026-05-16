import argparse
import csv
from dataclasses import dataclass
from typing import List, Tuple


def normalize_duration(value: str) -> Tuple[str, bool]:
    # Normalisasi durasi yang tidak valid
    if not value or ":" not in value:
        return value, False

    parts = value.strip().split(":")
    if len(parts) != 2:
        return value, False

    minutes_text, seconds_text = parts
    if not minutes_text.isdigit() or not seconds_text.isdigit():
        return value, False

    minutes = int(minutes_text)
    seconds = int(seconds_text)

    if seconds < 60:
        return value, False

    minutes += seconds // 60
    seconds = seconds % 60
    return f"{minutes}:{seconds:02d}", True


@dataclass
class FixResult:
    artist: str
    title: str
    before: str
    after: str


def fix_csv(input_path: str, output_path: str, report_path: str) -> int:
    # Perbaiki durasi dan tulis laporan
    fixes: List[FixResult] = []

    with open(input_path, "r", encoding="utf-8") as input_file:
        reader = csv.DictReader(input_file)
        rows = list(reader)
        fieldnames = reader.fieldnames

    if not fieldnames:
        raise SystemExit("CSV has no header.")

    for row in rows:
        before = row.get("duration", "") or ""
        after, changed = normalize_duration(before)
        if changed:
            row["duration"] = after
            fixes.append(
                FixResult(
                    artist=row.get("artist", ""),
                    title=row.get("title", ""),
                    before=before,
                    after=after,
                )
            )

    with open(output_path, "w", encoding="utf-8", newline="") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    with open(report_path, "w", encoding="utf-8", newline="") as report_file:
        writer = csv.writer(report_file)
        writer.writerow(["artist", "title", "duration_before", "duration_after"])
        for item in fixes:
            writer.writerow([item.artist, item.title, item.before, item.after])

    return len(fixes)


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize invalid duration values in output.csv")
    parser.add_argument("--input", required=True, help="Path to original output.csv")
    parser.add_argument("--output", required=True, help="Path to write the fixed CSV")
    parser.add_argument("--report", required=True, help="Path to write the fix report CSV")
    args = parser.parse_args()

    total = fix_csv(args.input, args.output, args.report)
    print(f"Fixed durations: {total}")
    print(f"Wrote fixed CSV to: {args.output}")
    print(f"Wrote report CSV to: {args.report}")


if __name__ == "__main__":
    main()
