import pytest
from fastapi.testclient import TestClient


def test_health(client: "TestClient"):
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["data_loaded"] is True
    assert data["last_refreshed"] is not None


def test_get_dates(client: "TestClient"):
    r = client.get("/api/dates")
    assert r.status_code == 200
    dates = r.json()["dates"]
    assert "2026-01-01" in dates
    assert "2026-01-02" in dates
    # sorted descending
    assert dates == sorted(dates, reverse=True)


def test_get_items_by_date_found(client: "TestClient"):
    r = client.get("/api/date/2026-01-01")
    assert r.status_code == 200
    data = r.json()
    assert data["date"] == "2026-01-01"
    assert len(data["items"]) == 2
    items_names = [i["item"] for i in data["items"]]
    assert "Apple" in items_names
    assert "Banana" in items_names
    assert data["total"] == 35.0


def test_get_items_by_date_empty(client: "TestClient"):
    r = client.get("/api/date/2025-06-01")
    assert r.status_code == 200
    data = r.json()
    assert data["items"] == []
    assert data["total"] == 0.0


def test_get_items_by_date_invalid_format(client: "TestClient"):
    r = client.get("/api/date/not-a-date")
    assert r.status_code == 400


def test_search_suggestions_partial(client: "TestClient"):
    r = client.get("/api/search/suggestions?q=app")
    assert r.status_code == 200
    suggestions = r.json()["suggestions"]
    assert "Apple" in suggestions


def test_search_suggestions_case_insensitive(client: "TestClient"):
    r = client.get("/api/search/suggestions?q=APPLE")
    assert r.status_code == 200
    assert "Apple" in r.json()["suggestions"]


def test_search_suggestions_empty_q_rejected(client: "TestClient"):
    r = client.get("/api/search/suggestions?q=")
    assert r.status_code == 422  # FastAPI min_length=1


def test_search_history_found(client: "TestClient"):
    r = client.get("/api/search/history?item=Apple")
    assert r.status_code == 200
    data = r.json()
    assert data["item"] == "Apple"
    assert data["total_purchases"] == 2
    assert data["total_spent"] == 30.0
    assert data["avg_price"] == 10.0
    assert len(data["history"]) == 2


def test_search_history_case_insensitive(client: "TestClient"):
    r = client.get("/api/search/history?item=apple")
    assert r.status_code == 200
    assert r.json()["total_purchases"] == 2


def test_search_history_not_found(client: "TestClient"):
    r = client.get("/api/search/history?item=Mango")
    assert r.status_code == 404


def test_manual_refresh(client: "TestClient"):
    r = client.post("/api/refresh")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "refreshed"
    assert data["rows"] == 4
