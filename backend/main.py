import requests



def fetch_products(shop_url):
    response = requests.get(f"{shop_url}/products.json?limit=500")
    return response.json()


def parse_products(data, competitor_name):
    rows = []
    for product in data['products']:
        for variant in product['variants']:
            rows.append({
                'competitor_name': competitor_name,
                'product_name': product['title'],
                'variant': variant['title'],
                'price': float(variant['price']),
                'available': variant['available'],
                'product_type': product['product_type'],
                'tags': product['tags'],
                'url': f"https://www.barneysbundles.co.uk/products/{product['handle']}",
                'scraped_at': product['updated_at'],
            })
    return rows

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

all_rows = []

for name, url in shopify_stores:
    print(f"Fetching {name}...")
    data = fetch_products(url)
    rows = parse_products(data, name)
    all_rows.extend(rows)
    print(f"  Got {len(rows)} variants")

print(f"\nTotal rows: {len(all_rows)}")

def clean_rows(rows):
    cleaned = []
    for row in rows:
        row['product_name'] = row['product_name'].strip()
        row['variant'] = None if row['variant'] == 'Default Title' else row['variant'].strip()
        cleaned.append(row)
    return cleaned

all_rows = clean_rows(all_rows)

for row in all_rows[:3]:
    print(row)