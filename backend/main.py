import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── products.json helpers ─────────────────────────────────────────────────────

def load_products():
    with open('products.json') as f:
        return json.load(f)


@app.get("/products")
def get_products(
    competitor: str | None = None,
    available: bool | None = None,
    is_jonny: bool | None = None,
    product_type: str | None = None,
    price_changed: bool | None = None,
):
    products = load_products()
    if competitor:
        products = [p for p in products if p['competitor_name'].lower() == competitor.lower()]
    if available is not None:
        products = [p for p in products if p['available'] == available]
    if is_jonny is not None:
        products = [p for p in products if p['is_jonny'] == is_jonny]
    if product_type:
        products = [p for p in products if (p['product_type'] or '').lower() == product_type.lower()]
    if price_changed is not None:
        products = [p for p in products if p['price_changed'] == price_changed]
    return products


@app.get("/competitors")
def get_competitors():
    products = load_products()
    names = sorted(set(p['competitor_name'] for p in products))
    return names


@app.get("/product-types")
def get_product_types():
    products = load_products()
    types = sorted(set(p['product_type'] for p in products if p['product_type']))
    return types


@app.get("/price-changes")
def get_price_changes():
    products = load_products()
    changed = [p for p in products if p['price_changed']]
    changed.sort(key=lambda x: x['price_change_date'] or '', reverse=True)
    return changed


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_db():
    from db import get_conn
    return get_conn()


def ensure_tables():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS competitor_logos (
                        competitor_name TEXT PRIMARY KEY,
                        logo_url        TEXT,
                        display_name    TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS bookmarks (
                        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        competitor_name TEXT NOT NULL,
                        product_name    TEXT NOT NULL,
                        variant         TEXT NOT NULL DEFAULT '',
                        notes           TEXT NOT NULL DEFAULT '',
                        created_at      TIMESTAMPTZ DEFAULT NOW(),
                        updated_at      TIMESTAMPTZ DEFAULT NOW(),
                        UNIQUE (competitor_name, product_name, variant)
                    );
                """)
                # Seed/update competitor logos — logo_url maps to files in frontend/public/
                stores = [
                    ("Barneys Bundles",      "/BarneysBundlesLogo.webp"),
                    ("JR Pet Products",      "/jr-pet-products.avif"),
                    ("Dragonfly Products",   "/Dragonfly_Products_v2_-_Final.png.avif"),
                    ("Maltbys Stores",       "/maltbys.png"),
                    ("Natural Treats",       None),
                    ("Pure and Natural Pet", "/pureandnatural.png"),
                    ("Pets Purest",          "/pets-purest.png"),
                    ("Skippers Pet Products","/skippers.svg"),
                    ("Denzels",              "/denzels.png"),
                    ("Chow Paws",            "/chowpaws.webp"),
                    ("Nutriment",            "/Nutriment-Natural-Treats-Logo.png.avif"),
                ]
                for name, logo_url in stores:
                    cur.execute("""
                        INSERT INTO competitor_logos (competitor_name, display_name, logo_url)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (competitor_name) DO UPDATE SET logo_url = EXCLUDED.logo_url
                    """, (name, name, logo_url))
            conn.commit()
    except Exception as e:
        print(f"[startup] DB setup skipped: {e}")


@app.on_event("startup")
async def startup():
    ensure_tables()


# ── Competitor logos ──────────────────────────────────────────────────────────

@app.get("/competitors/logos")
def get_competitor_logos():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT competitor_name, logo_url, display_name FROM competitor_logos")
                rows = cur.fetchall()
        return {row[0]: {"logo_url": row[1], "display_name": row[2]} for row in rows}
    except Exception:
        return {}


# ── Bookmarks ─────────────────────────────────────────────────────────────────

class BookmarkIn(BaseModel):
    competitor_name: str
    product_name: str
    variant: Optional[str] = None
    notes: str = ''


class NotesIn(BaseModel):
    notes: str


def _row_to_dict(row: tuple) -> dict:
    return {
        "id": str(row[0]),
        "competitor_name": row[1],
        "product_name": row[2],
        "variant": row[3] or None,
        "notes": row[4],
        "created_at": row[5].isoformat() if row[5] else None,
        "updated_at": row[6].isoformat() if row[6] else None,
    }


@app.get("/bookmarks")
def get_bookmarks():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, competitor_name, product_name, variant, notes, created_at, updated_at
                    FROM bookmarks ORDER BY created_at DESC
                """)
                return [_row_to_dict(r) for r in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/bookmarks", status_code=201)
def create_bookmark(data: BookmarkIn):
    variant = data.variant or ''
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO bookmarks (competitor_name, product_name, variant, notes)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (competitor_name, product_name, variant)
                    DO UPDATE SET notes = EXCLUDED.notes, updated_at = NOW()
                    RETURNING id, competitor_name, product_name, variant, notes, created_at, updated_at
                """, (data.competitor_name, data.product_name, variant, data.notes))
                row = cur.fetchone()
            conn.commit()
        return _row_to_dict(row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/bookmarks/{bookmark_id}")
def update_bookmark(bookmark_id: str, data: NotesIn):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE bookmarks SET notes = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, competitor_name, product_name, variant, notes, created_at, updated_at
                """, (data.notes, bookmark_id))
                row = cur.fetchone()
            conn.commit()
        if not row:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        return _row_to_dict(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/bookmarks/{bookmark_id}", status_code=204)
def delete_bookmark(bookmark_id: str):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM bookmarks WHERE id = %s", (bookmark_id,))
            conn.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Scrape ────────────────────────────────────────────────────────────────────

import asyncio
import os
import time
from datetime import datetime, timezone

SNAPSHOTS_DIR = 'snapshots'
_scrape_running = False


def _ensure_scrape_tables():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS scrape_history (
                        id          SERIAL PRIMARY KEY,
                        scraped_at  TIMESTAMPTZ DEFAULT NOW(),
                        rows        INT NOT NULL DEFAULT 0,
                        changes     INT NOT NULL DEFAULT 0,
                        duration_s  FLOAT,
                        snapshot    TEXT
                    );
                """)
            conn.commit()
    except Exception as e:
        print(f"[startup] scrape_history table skipped: {e}")


def _save_snapshot(rows: list) -> str | None:
    try:
        os.makedirs(SNAPSHOTS_DIR, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        path = os.path.join(SNAPSHOTS_DIR, f"{ts}.json")
        with open(path, 'w') as f:
            json.dump(rows, f)
        return path
    except Exception as e:
        print(f"[scrape] snapshot save failed: {e}")
        return None


def _record_history(scraped_at: str, rows: int, changes: int, duration_s: float, snapshot: str | None):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO scrape_history (scraped_at, rows, changes, duration_s, snapshot)
                    VALUES (%s, %s, %s, %s, %s)
                """, (scraped_at, rows, changes, duration_s, snapshot))
            conn.commit()
    except Exception as e:
        print(f"[scrape] history record failed: {e}")


@app.get("/scrape/status")
def get_scrape_status():
    global _scrape_running
    last = None
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT scraped_at, rows, changes FROM scrape_history ORDER BY scraped_at DESC LIMIT 1")
                last = cur.fetchone()
    except Exception:
        pass
    return {
        "last_scraped_at": last[0].isoformat() if last else None,
        "last_rows": last[1] if last else 0,
        "last_changes": last[2] if last else 0,
        "can_scrape_now": not _scrape_running,
        "is_running": _scrape_running,
    }


@app.get("/scrape/history")
def get_scrape_history():
    _ensure_scrape_tables()
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, scraped_at, rows, changes, duration_s FROM scrape_history ORDER BY scraped_at DESC LIMIT 50")
                rows = cur.fetchall()
        return [
            {"id": r[0], "scraped_at": r[1].isoformat(), "rows": r[2], "changes": r[3], "duration_s": r[4]}
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/scrape/snapshot/{history_id}")
def get_snapshot(history_id: int):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT snapshot, scraped_at FROM scrape_history WHERE id = %s", (history_id,))
                row = cur.fetchone()
        if not row or not row[0]:
            raise HTTPException(status_code=404, detail="No snapshot for this scrape")
        with open(row[0]) as f:
            data = json.load(f)
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/scrape")
async def trigger_scrape():
    global _scrape_running
    if _scrape_running:
        raise HTTPException(status_code=429, detail="Scrape already running")
    _ensure_scrape_tables()
    _scrape_running = True
    start = time.monotonic()
    try:
        from scraper import run_scrape
        rows = await asyncio.to_thread(run_scrape)
        changes = len([r for r in rows if r['price_changed']])
        duration = round(time.monotonic() - start, 1)
        scraped_at = datetime.now(timezone.utc).isoformat()
        snapshot = _save_snapshot(rows)
        _record_history(scraped_at, len(rows), changes, duration, snapshot)
        return {"rows": len(rows), "changes": changes, "scraped_at": scraped_at, "duration_s": duration}
    finally:
        _scrape_running = False


# ── Competitor notes ──────────────────────────────────────────────────────────

def _ensure_notes_table():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS competitor_notes (
                        competitor_name TEXT PRIMARY KEY,
                        notes           TEXT NOT NULL DEFAULT '',
                        updated_at      TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
            conn.commit()
    except Exception as e:
        print(f"[startup] competitor_notes table skipped: {e}")


class CompetitorNotesIn(BaseModel):
    notes: str


@app.get("/competitor-notes")
def get_all_competitor_notes():
    try:
        _ensure_notes_table()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT competitor_name, notes, updated_at FROM competitor_notes")
                rows = cur.fetchall()
        return {r[0]: {"notes": r[1], "updated_at": r[2].isoformat() if r[2] else None} for r in rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/competitor-notes/{competitor_name}")
def save_competitor_notes(competitor_name: str, data: CompetitorNotesIn):
    try:
        _ensure_notes_table()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO competitor_notes (competitor_name, notes)
                    VALUES (%s, %s)
                    ON CONFLICT (competitor_name) DO UPDATE SET notes = EXCLUDED.notes, updated_at = NOW()
                    RETURNING competitor_name, notes, updated_at
                """, (competitor_name, data.notes))
                row = cur.fetchone()
            conn.commit()
        return {"competitor_name": row[0], "notes": row[1], "updated_at": row[2].isoformat() if row[2] else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
