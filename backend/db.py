import psycopg
import os
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL", "postgresql://joshuaforster@localhost/barneys_bundles")


def get_conn():
    return psycopg.connect(DB_URL)


def create_tables():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    competitor_name TEXT NOT NULL,
                    product_name TEXT NOT NULL,
                    variant TEXT,
                    current_price NUMERIC(10,2) NOT NULL,
                    currency TEXT DEFAULT 'GBP',
                    weight_grams NUMERIC(10,2),
                    price_per_100g NUMERIC(10,2),
                    image_url TEXT,
                    available BOOLEAN,
                    product_type TEXT,
                    tags TEXT[],
                    product_url TEXT,
                    is_jonny BOOLEAN DEFAULT FALSE,
                    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
                    last_scraped_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(competitor_name, product_name, variant)
                );

                CREATE TABLE IF NOT EXISTS price_history (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    scrape_run_id UUID NOT NULL,
                    competitor_name TEXT NOT NULL,
                    product_name TEXT NOT NULL,
                    variant TEXT,
                    old_price NUMERIC(10,2),
                    new_price NUMERIC(10,2) NOT NULL,
                    price_change_amount NUMERIC(10,2),
                    price_change_date DATE,
                    scraped_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_products_lookup
                    ON products(competitor_name, product_name, variant);

                CREATE INDEX IF NOT EXISTS idx_price_history_date
                    ON price_history(scraped_at DESC);

                CREATE INDEX IF NOT EXISTS idx_price_history_competitor
                    ON price_history(competitor_name);
            """)
        conn.commit()
        print("Tables created.")


if __name__ == "__main__":
    create_tables()


def upsert_product(cur, row):
    cur.execute("""
        INSERT INTO products (
            competitor_name, product_name, variant, current_price,
            currency, weight_grams, price_per_100g, image_url,
            available, product_type, tags, product_url, is_jonny,
            last_scraped_at
        ) VALUES (
            %(competitor_name)s, %(product_name)s, %(variant)s, %(price)s,
            %(currency)s, %(weight_grams)s, %(price_per_100g)s, %(image_url)s,
            %(available)s, %(product_type)s, %(tags)s, %(product_url)s, %(is_jonny)s,
            NOW()
        )
        ON CONFLICT (competitor_name, product_name, variant)
        DO UPDATE SET
            current_price = EXCLUDED.current_price,
            available = EXCLUDED.available,
            price_per_100g = EXCLUDED.price_per_100g,
            weight_grams = EXCLUDED.weight_grams,
            image_url = EXCLUDED.image_url,
            last_scraped_at = NOW()
        RETURNING id, (xmax = 0) AS is_new,
            (products.current_price != EXCLUDED.current_price) AS price_changed,
            products.current_price AS old_price
    """, row)
    return cur.fetchone()


def insert_price_history(cur, row, old_price, scrape_run_id):
    cur.execute("""
        INSERT INTO price_history (
            scrape_run_id, competitor_name, product_name, variant,
            old_price, new_price, price_change_amount, price_change_date, scraped_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, NOW()::DATE, NOW()
        )
    """, (
        scrape_run_id,
        row['competitor_name'],
        row['product_name'],
        row['variant'],
        old_price,
        row['price'],
        round(row['price'] - old_price, 2),
    ))


def store_rows(rows, scrape_run_id):
    changes = 0
    new_products = 0

    with get_conn() as conn:
        with conn.cursor() as cur:
            for row in rows:
                result = upsert_product(cur, row)
                if result:
                    _, is_new, price_changed, old_price = result
                    if is_new:
                        new_products += 1
                    elif price_changed:
                        insert_price_history(cur, row, old_price, scrape_run_id)
                        changes += 1
        conn.commit()

    print(f"New products: {new_products}")
    print(f"Price changes: {changes}")