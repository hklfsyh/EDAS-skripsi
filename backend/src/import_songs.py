import argparse
import csv
import os
import re
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple


def load_database_url() -> Optional[str]:
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    env_path = os.path.join(repo_root, ".env.local")
    if not os.path.exists(env_path):
        return None

    with open(env_path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if stripped.startswith("DATABASE_URL="):
                value = stripped.split("=", 1)[1].strip().strip("\"").strip("'")
                if value:
                    return value
    return None


def parse_duration_to_ms(value: str) -> Optional[int]:
    if not value:
        return None
    match = re.match(r"^(\d{1,2}):(\d{2})$", value.strip())
    if not match:
        return None
    minutes = int(match.group(1))
    seconds = int(match.group(2))
    if seconds >= 60:
        return None
    return (minutes * 60 + seconds) * 1000


def parse_float(value: str) -> Optional[float]:
    if value is None:
        return None
    stripped = value.strip()
    if stripped == "":
        return None
    try:
        return float(stripped)
    except ValueError:
        return None


def parse_int(value: str) -> Optional[int]:
    parsed = parse_float(value)
    if parsed is None:
        return None
    return int(round(parsed))


@dataclass
class ParsedRow:
    title: str
    artist: str
    duration_ms: int
    tempo: Optional[float]
    energy: Optional[float]
    danceability: Optional[float]
    happiness: Optional[float]
    acousticness: Optional[float]
    instrumentalness: Optional[float]
    speechiness: Optional[float]
    popularity: Optional[int]


@dataclass
class ParseStats:
    total_rows: int = 0
    imported_rows: int = 0
    skipped_rows: int = 0
    skipped_existing: int = 0
    skipped_reasons: Optional[Dict[str, int]] = None

    def __post_init__(self) -> None:
        if self.skipped_reasons is None:
            self.skipped_reasons = {}

    def add_skip(self, reason: str) -> None:
        self.skipped_rows += 1
        self.skipped_reasons[reason] = self.skipped_reasons.get(reason, 0) + 1


@dataclass
class InvalidRow:
    reason: str
    artist: str
    title: str
    duration: str
    bpm: str
    status: str


def validate_range(value: Optional[float], min_value: float, max_value: float) -> bool:
    if value is None:
        return True
    return min_value <= value <= max_value


def record_invalid(
    stats: ParseStats,
    invalid_rows: Optional[List[InvalidRow]],
    reason: str,
    row: Dict[str, str],
    artist: str = "",
    title: str = "",
) -> None:
    stats.add_skip(reason)
    if invalid_rows is None:
        return
    invalid_rows.append(
        InvalidRow(
            reason=reason,
            artist=artist,
            title=title,
            duration=row.get("duration") or "",
            bpm=row.get("bpm") or "",
            status=row.get("status") or "",
        )
    )


def validate_feature_ranges(features: Dict[str, Optional[float]]) -> Optional[str]:
    for field_name, value in features.items():
        if not validate_range(value, 0, 100):
            return f"{field_name}_out_of_range"
    return None


def get_status_reason(status: str) -> Optional[str]:
    if status != "ok":
        return "status_not_ok"
    return None


def get_required_reason(title: str, artist: str) -> Optional[str]:
    if not title or not artist:
        return "missing_title_or_artist"
    return None


def get_duration_reason(duration_ms: Optional[int]) -> Optional[str]:
    if duration_ms is None or duration_ms <= 0:
        return "invalid_duration"
    return None


def get_tempo_reason(tempo: Optional[float]) -> Optional[str]:
    if tempo is not None and tempo < 0:
        return "invalid_tempo"
    return None


def get_popularity_reason(popularity: Optional[int]) -> Optional[str]:
    if popularity is not None and not validate_range(popularity, 0, 100):
        return "popularity_out_of_range"
    return None


def get_invalid_reason(
    status: str,
    title: str,
    artist: str,
    duration_ms: Optional[int],
    tempo: Optional[float],
    features: Dict[str, Optional[float]],
    popularity: Optional[int],
) -> Optional[str]:
    checks = [
        ("status_not_ok", status != "ok"),
        ("missing_title_or_artist", not title or not artist),
        ("invalid_duration", duration_ms is None or duration_ms <= 0),
        ("invalid_tempo", tempo is not None and tempo < 0),
    ]
    for reason, condition in checks:
        if condition:
            return reason

    feature_error = validate_feature_ranges(features)
    if feature_error:
        return feature_error

    return get_popularity_reason(popularity)


def parse_row(
    row: Dict[str, str],
    stats: ParseStats,
    invalid_rows: Optional[List[InvalidRow]] = None,
) -> Optional[ParsedRow]:
    stats.total_rows += 1

    status = (row.get("status") or "").strip().lower()
    title = (row.get("title") or "").strip()
    artist = (row.get("artist") or "").strip()
    duration_ms = parse_duration_to_ms(row.get("duration") or "")
    tempo = parse_float(row.get("bpm") or "")

    features = {
        "energy": parse_float(row.get("energy") or ""),
        "danceability": parse_float(row.get("danceability") or ""),
        "happiness": parse_float(row.get("happiness") or ""),
        "acousticness": parse_float(row.get("acousticness") or ""),
        "instrumentalness": parse_float(row.get("instrumentalness") or ""),
        "speechiness": parse_float(row.get("speechiness") or ""),
    }
    popularity = parse_int(row.get("popularity") or "")

    invalid_reason = get_invalid_reason(
        status,
        title,
        artist,
        duration_ms,
        tempo,
        features,
        popularity,
    )
    if invalid_reason:
        record_invalid(
            stats,
            invalid_rows,
            invalid_reason,
            row,
            artist=artist,
            title=title,
        )
        return None

    return ParsedRow(
        title=title,
        artist=artist,
        duration_ms=duration_ms,
        tempo=tempo,
        energy=features["energy"],
        danceability=features["danceability"],
        happiness=features["happiness"],
        acousticness=features["acousticness"],
        instrumentalness=features["instrumentalness"],
        speechiness=features["speechiness"],
        popularity=popularity,
    )


def chunked(rows: List[ParsedRow], batch_size: int) -> Iterable[List[ParsedRow]]:
    for index in range(0, len(rows), batch_size):
        yield rows[index : index + batch_size]


def load_rows(
    csv_path: str,
    limit: Optional[int] = None,
    invalid_output: Optional[str] = None,
) -> Tuple[List[ParsedRow], ParseStats]:
    stats = ParseStats()
    parsed_rows: List[ParsedRow] = []
    invalid_rows: List[InvalidRow] = []

    with open(csv_path, "r", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            parsed = parse_row(row, stats, invalid_rows)
            if parsed:
                parsed_rows.append(parsed)
                stats.imported_rows += 1
            if limit is not None and stats.total_rows >= limit:
                break

    if invalid_output:
        with open(invalid_output, "w", encoding="utf-8", newline="") as output_file:
            writer = csv.writer(output_file)
            writer.writerow(["reason", "artist", "title", "duration", "bpm", "status"])
            for invalid in invalid_rows:
                writer.writerow(
                    [
                        invalid.reason,
                        invalid.artist,
                        invalid.title,
                        invalid.duration,
                        invalid.bpm,
                        invalid.status,
                    ]
                )

    return parsed_rows, stats


def insert_rows(rows: List[ParsedRow], database_url: str, batch_size: int) -> None:
    try:
        import psycopg
    except ImportError as exc:
        raise SystemExit(
            "psycopg is required for import. Install with: pip install psycopg[binary]"
        ) from exc

    insert_sql = """
        INSERT INTO songs (
          title,
          artist,
          duration_ms,
          tempo,
          energy,
          danceability,
          happiness,
          acousticness,
          instrumentalness,
          speechiness,
          popularity
        ) VALUES (
          %(title)s,
          %(artist)s,
          %(duration_ms)s,
          %(tempo)s,
          %(energy)s,
          %(danceability)s,
          %(happiness)s,
          %(acousticness)s,
          %(instrumentalness)s,
          %(speechiness)s,
          %(popularity)s
        )
    """

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cursor:
            for batch in chunked(rows, batch_size):
                cursor.executemany(
                    insert_sql,
                    [row.__dict__ for row in batch],
                )
        conn.commit()


def load_existing_keys(database_url: str) -> set[tuple[str, str, int]]:
    try:
        import psycopg
    except ImportError as exc:
        raise SystemExit(
            "psycopg is required for import. Install with: pip install psycopg[binary]"
        ) from exc

    query = "SELECT artist, title, duration_ms FROM songs"
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()
    return {(artist, title, duration_ms) for artist, title, duration_ms in rows}


def filter_existing(rows: List[ParsedRow], existing: set[tuple[str, str, int]]) -> List[ParsedRow]:
    filtered: List[ParsedRow] = []
    for row in rows:
        key = (row.artist, row.title, row.duration_ms)
        if key not in existing:
            filtered.append(row)
    return filtered


def format_stats(stats: ParseStats) -> str:
    lines = [
        f"Total rows read: {stats.total_rows}",
        f"Rows accepted : {stats.imported_rows}",
        f"Rows skipped  : {stats.skipped_rows}",
    ]

    if stats.skipped_existing:
        lines.append(f"Rows already in DB: {stats.skipped_existing}")

    if stats.skipped_reasons:
        lines.append("Skip reasons:")
        for reason, count in sorted(stats.skipped_reasons.items()):
            lines.append(f"  - {reason}: {count}")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Import songs from output.csv into PostgreSQL.")
    parser.add_argument(
        "--csv",
        dest="csv_path",
        required=True,
        help="Path to output.csv",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and validate CSV without inserting into database.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional limit for how many CSV rows to read.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=200,
        help="Batch size for database inserts.",
    )
    parser.add_argument(
        "--invalid-output",
        dest="invalid_output",
        default=None,
        help="Optional CSV output path for invalid rows.",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip rows already in the songs table (by artist/title/duration_ms).",
    )

    args = parser.parse_args()
    rows, stats = load_rows(
        args.csv_path,
        limit=args.limit,
        invalid_output=args.invalid_output,
    )

    if args.dry_run:
        print(format_stats(stats))
        return

    database_url = load_database_url()
    if not database_url:
        raise SystemExit("DATABASE_URL not found in environment or .env.local")

    if args.skip_existing:
        existing = load_existing_keys(database_url)
        before = len(rows)
        rows = filter_existing(rows, existing)
        stats.skipped_existing = before - len(rows)

    insert_rows(rows, database_url, args.batch_size)
    print(format_stats(stats))
    print("Import completed.")


if __name__ == "__main__":
    main()
