# Import Songs from output.csv

This guide imports `data/output.csv` into the `songs` table.

## What the script does
- Filters rows with `status != ok`.
- Converts `duration` from `MM:SS` to `duration_ms`.
- Maps CSV `bpm` to database `tempo`.
- Skips rows with missing title/artist, invalid duration, or out-of-range audio values.

## Run (dry-run only)
```powershell
python backend/src/import_songs.py --csv data/output.csv --dry-run
```

## Export invalid rows to CSV
```powershell
python backend/src/import_songs.py --csv data/output.csv --dry-run --invalid-output data/invalid_songs.csv
```

## Run (insert into database)
```powershell
python -m pip install -r backend/requirements.txt
python backend/src/import_songs.py --csv data/output.csv
```

## Verify
```sql
SELECT COUNT(*) FROM songs;
SELECT id_song, title, artist, tempo, duration_ms FROM songs ORDER BY id_song DESC LIMIT 5;
```
