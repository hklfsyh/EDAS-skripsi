from pathlib import Path
import pandas as pd


def load_dataset(csv_path: str | Path) -> pd.DataFrame:
    path = Path(csv_path)

    if not path.exists():
        raise FileNotFoundError(f"File tidak ditemukan: {path}")

    df = pd.read_csv(path)
    return df

