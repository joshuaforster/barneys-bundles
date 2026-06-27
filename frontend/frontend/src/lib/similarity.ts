import type { Product } from '../types'

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'with', 'for', 'of', 'in', 'at', 'by', 'to',
  'is', 'it', 'be', 'has', 'its', 'our', 'from', 'are', 'this', 'that',
  'dog', 'pet', 'natural', 'treat', 'treats',
])

export function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w))
}

export function jaccard(a: string, b: string): number {
  const ta = new Set(tokenize(a))
  const tb = new Set(tokenize(b))
  if (ta.size === 0 && tb.size === 0) return 0
  let intersection = 0
  for (const t of ta) if (tb.has(t)) intersection++
  const union = ta.size + tb.size - intersection
  return union === 0 ? 0 : intersection / union
}

export const MIN_SCORE = 0.15

export interface ComparisonGroup {
  competitor_name: string
  product_name: string
  variants: Product[]
  is_jonny: boolean
  score: number
  min_price: number | null
  best_price_per_100g: number | null
}

export function buildComparisonGroups(
  selected: Product,
  allProducts: Product[],
): ComparisonGroup[] {
  // Group by (competitor_name, product_name), score each group
  const map = new Map<string, ComparisonGroup>()

  for (const p of allProducts) {
    if (p.id === selected.id) continue
    const score = jaccard(selected.product_name, p.product_name)
    if (score < MIN_SCORE) continue

    const key = `${p.competitor_name}|||${p.product_name}`
    const existing = map.get(key)
    if (existing) {
      existing.variants.push(p)
      if (p.price != null && (existing.min_price == null || p.price < existing.min_price)) {
        existing.min_price = p.price
      }
      if (
        p.price_per_100g != null &&
        (existing.best_price_per_100g == null || p.price_per_100g < existing.best_price_per_100g)
      ) {
        existing.best_price_per_100g = p.price_per_100g
      }
      if (score > existing.score) existing.score = score
    } else {
      map.set(key, {
        competitor_name: p.competitor_name,
        product_name: p.product_name,
        variants: [p],
        is_jonny: p.is_jonny,
        score,
        min_price: p.price,
        best_price_per_100g: p.price_per_100g,
      })
    }
  }

  // Also include the selected product's own group (Jonny's baseline)
  const selectedKey = `${selected.competitor_name}|||${selected.product_name}`
  if (!map.has(selectedKey)) {
    // Find other variants of the same product
    const sameGroup = allProducts.filter(
      p => p.competitor_name === selected.competitor_name &&
           p.product_name === selected.product_name &&
           p.id !== selected.id
    )
    const prices = [selected, ...sameGroup].map(p => p.price).filter((v): v is number => v != null)
    const p100g = [selected, ...sameGroup].map(p => p.price_per_100g).filter((v): v is number => v != null)
    map.set(selectedKey, {
      competitor_name: selected.competitor_name,
      product_name: selected.product_name,
      variants: [selected, ...sameGroup],
      is_jonny: selected.is_jonny,
      score: 1,
      min_price: prices.length > 0 ? Math.min(...prices) : null,
      best_price_per_100g: p100g.length > 0 ? Math.min(...p100g) : null,
    })
  }

  return [...map.values()].sort((a, b) => {
    // Jonny's group always first
    if (a.is_jonny && !b.is_jonny) return -1
    if (!a.is_jonny && b.is_jonny) return 1
    // Then sort by score desc
    return b.score - a.score
  })
}

/** Pre-compute which non-Barneys products have a Barneys equivalent */
export function computeBBCoverage(products: Product[]): Set<string> {
  const jonnyProducts = products.filter(p => p.is_jonny)
  const covered = new Set<string>()

  for (const p of products) {
    if (p.is_jonny) continue
    for (const j of jonnyProducts) {
      if (jaccard(p.product_name, j.product_name) >= MIN_SCORE) {
        covered.add(p.id)
        break
      }
    }
  }

  return covered
}
