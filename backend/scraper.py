import requests
import uuid
import re
import json
import os
from datetime import datetime, timezone
from db import store_rows

JONNY_STORE = "https://www.barneysbundles.co.uk"

shopify_stores = [
    ("Barneys Bundles", "https://www.barneysbundles.co.uk"),
    ("JR Pet Products", "https://www.jrpetproducts.com"),
    ("Dragonfly Products", "https://dragonflyproducts.co.uk"),
    ("Maltbys Stores", "https://maltbysstores.co.uk"),
    ("Natural Treats", "https://www.natural-treats.co.uk"),
    ("Pure and Natural Pet", "https://www.pureandnaturalpet.co.uk"),
    ("Pets Purest", "https://www.petspurest.com"),
    ("Skippers Pet Products", "https://www.skipperspetproducts.com"),
    ("Denzels", "https://www.denzels.co.uk"),
    ("Chow Paws", "https://chowpawsdogtreats.co.uk"),
    ("Nutriment", "https://www.nutriment.co.uk"),
]


def fetch_products(shop_url):
    response = requests.get(f"{shop_url}/products.json?limit=250")
    return response.json()


def parse_weight_grams(variant_title):
    if not variant_title:
        return None

    v = variant_title.lower().strip()

    match = re.search(r'(\d+(?:\.\d+)?)\s*g\b', v)
    if match:
        return float(match.group(1))

    match = re.search(r'(\d+(?:\.\d+)?)\s*kilo(?:gram)?s?', v)
    if match:
        return float(match.group(1)) * 1000

    match = re.search(r'(\d+(?:\.\d+)?)\s*kg\b', v)
    if match:
        return float(match.group(1)) * 1000

    match = re.search(r'(\d+(?:\.\d+)?)\s*lbs?', v)
    if match:
        return float(match.group(1)) * 453.592

    return None


def calculate_price_per_100g(price, weight_grams):
    if not weight_grams or weight_grams == 0:
        return None
    return round((price / weight_grams) * 100, 2)


def parse_products(data, competitor_name, base_url, scrape_run_id, previous_rows):
    rows = []
    scraped_at = datetime.now(timezone.utc).isoformat()
    is_jonny = base_url == JONNY_STORE

    for product in data['products']:
        for variant in product['variants']:
            current_price = float(variant['price'])
            product_name = product['title'].strip()
            variant_title = None if variant['title'] == 'Default Title' else variant['title'].strip()

            lookup_key = (competitor_name, product_name, variant_title)
            previous_price = previous_rows.get(lookup_key)
            price_changed = previous_price is not None and previous_price != current_price
            price_change_amount = round(current_price - previous_price, 2) if price_changed else None
            price_change_date = scraped_at[:10] if price_changed else None

            weight_grams = parse_weight_grams(variant_title)
            price_per_100g = calculate_price_per_100g(current_price, weight_grams)
            image_url = product['images'][0]['src'] if product.get('images') else None

            rows.append({
                "id": str(uuid.uuid4()),
                "scrape_run_id": scrape_run_id,
                "scraped_at": scraped_at,
                "competitor_name": competitor_name,
                "product_name": product_name,
                "variant": variant_title,
                "price": current_price,
                "previous_price": previous_price,
                "price_changed": price_changed,
                "price_change_amount": price_change_amount,
                "price_change_date": price_change_date,
                "currency": "GBP",
                "weight_grams": weight_grams,
                "price_per_100g": price_per_100g,
                "image_url": image_url,
                "available": variant['available'],
                "product_type": product['product_type'].strip() or None,
                "tags": product['tags'],
                "product_url": f"{base_url}/products/{product['handle']}",
                "is_jonny": is_jonny,
            })
    return rows


def load_previous_rows():
    if not os.path.exists('products.json'):
        return {}
    with open('products.json') as f:
        previous = json.load(f)
    return {
        (r['competitor_name'], r['product_name'], r['variant']): r['price']
        for r in previous
    }


def save_rows(rows):
    with open('products.json', 'w') as f:
        json.dump(rows, f, indent=2)
    print(f"Saved {len(rows)} rows to products.json")


def run_scrape():
    scrape_run_id = str(uuid.uuid4())
    print(f"Scrape run: {scrape_run_id}\n")

    previous_rows = load_previous_rows()
    all_rows = []

    for name, url in shopify_stores:
        print(f"Fetching {name}...")
        data = fetch_products(url)
        rows = parse_products(data, name, url, scrape_run_id, previous_rows)
        all_rows.extend(rows)
        print(f"  Got {len(rows)} variants")

    print(f"\nTotal rows: {len(all_rows)}")

    changed = [r for r in all_rows if r['price_changed']]
    print(f"Price changes detected: {len(changed)}")

    jonny_with_weight = [r for r in all_rows if r['is_jonny'] and r['price_per_100g'] is not None]
    print(f"Jonny's products with price per 100g: {len(jonny_with_weight)}")

    save_rows(all_rows)
    return all_rows


if __name__ == "__main__":
    run_scrape()