from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.sheets import fetch_sheet_data

SAMPLE_CSV = """Date,Item,Quantity,Price,Amount,Total
01/01/2026,Apple,2,10,20,35
01/01/2026,Banana,3,5,15,35
02/01/2026,Orange,4,3,12,12
"""

SAMPLE_CSV_MISSING_COL = """Date,Item,Quantity
01/01/2026,Apple,2
"""


def _make_mock_client(text: str):
    mock_response = MagicMock()
    mock_response.text = text
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.get = AsyncMock(return_value=mock_response)
    return mock_client


@pytest.mark.asyncio
async def test_fetch_parses_rows():
    with patch("app.sheets.httpx.AsyncClient", return_value=_make_mock_client(SAMPLE_CSV)):
        df = await fetch_sheet_data()

    assert len(df) == 3
    assert set(df.columns).issuperset({"date", "item", "quantity", "price", "amount"})


@pytest.mark.asyncio
async def test_fetch_normalises_dates():
    with patch("app.sheets.httpx.AsyncClient", return_value=_make_mock_client(SAMPLE_CSV)):
        df = await fetch_sheet_data()

    assert df["date_str"].iloc[0] == "2026-01-01"


@pytest.mark.asyncio
async def test_fetch_item_values():
    with patch("app.sheets.httpx.AsyncClient", return_value=_make_mock_client(SAMPLE_CSV)):
        df = await fetch_sheet_data()

    assert "Apple" in df["item"].values
    assert "Banana" in df["item"].values


@pytest.mark.asyncio
async def test_fetch_missing_columns_raises():
    with patch(
        "app.sheets.httpx.AsyncClient",
        return_value=_make_mock_client(SAMPLE_CSV_MISSING_COL),
    ):
        with pytest.raises(ValueError, match="Missing columns"):
            await fetch_sheet_data()
