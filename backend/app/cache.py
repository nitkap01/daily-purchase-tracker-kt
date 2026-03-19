from datetime import UTC, datetime
from typing import Optional

import pandas as pd


class DataCache:
    """Thread-safe in-memory store for the Google Sheets DataFrame."""

    def __init__(self) -> None:
        self.df: Optional[pd.DataFrame] = None
        self.last_refreshed: Optional[datetime] = None

    def update(self, df: pd.DataFrame) -> None:
        self.df = df
        self.last_refreshed = datetime.now(UTC)

    def is_loaded(self) -> bool:
        return self.df is not None

    def get_df(self) -> Optional[pd.DataFrame]:
        return self.df.copy() if self.df is not None else None


_cache = DataCache()


def get_cache() -> DataCache:
    return _cache
