from datetime import datetime
from unittest.mock import AsyncMock, patch

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.cache import get_cache
from app.main import app


@pytest.fixture
def sample_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "date": pd.to_datetime(
                ["2026-01-01", "2026-01-01", "2026-01-02", "2026-01-03"]
            ),
            "date_str": ["2026-01-01", "2026-01-01", "2026-01-02", "2026-01-03"],
            "item": ["Apple", "Banana", "Apple", "Orange"],
            "quantity": [2.0, 3.0, 1.0, 4.0],
            "price": [10.0, 5.0, 10.0, 3.0],
            "amount": [20.0, 15.0, 10.0, 12.0],
            "total": [35.0, 35.0, 10.0, 12.0],
        }
    )


@pytest.fixture
def client(sample_df: pd.DataFrame):
    fetch_mock = AsyncMock(return_value=sample_df.copy())
    with (
        patch("app.main.fetch_sheet_data", new=fetch_mock),
        patch("app.routers.data.fetch_sheet_data", new=fetch_mock),
        patch("app.main.start_scheduler"),
        patch("app.main.stop_scheduler"),
    ):
        with TestClient(app) as c:
            yield c

    # reset cache between test runs
    cache = get_cache()
    cache.df = None
    cache.last_refreshed = None
