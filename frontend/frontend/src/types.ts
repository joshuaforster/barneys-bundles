export interface Product {
  id: string
  scrape_run_id: string
  scraped_at: string
  competitor_name: string
  product_name: string
  variant: string | null
  price: number | null
  previous_price: number | null
  price_changed: boolean
  price_change_amount: number | null
  price_change_date: string | null
  currency: string
  weight_grams: number | null
  price_per_100g: number | null
  image_url?: string | null
  available: boolean
  product_type: string | null
  tags: string[]
  product_url: string
  is_jonny: boolean
}

export type SortKey = 'product_name' | 'competitor_name' | 'price' | 'price_per_100g' | 'weight_grams'
export type SortDir = 'asc' | 'desc'

export const BB_NAME = 'Barneys Bundles'
export const BB_COLOR = '#f59e0b'     // amber-500
export const COMP_COLOR = '#6366f1'   // indigo-500

export function fmt(amount: number | null | undefined, currency = 'GBP'): string {
  if (amount == null) return '—'
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£'
  return `${symbol}${amount.toFixed(2)}`
}

export function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export interface Bookmark {
  id: string
  competitor_name: string
  product_name: string
  variant: string | null
  notes: string
  created_at: string | null
  updated_at: string | null
}

export interface CompetitorLogo {
  logo_url: string | null
  display_name: string
}

export function sortProducts(products: Product[], key: SortKey, dir: SortDir): Product[] {
  return [...products].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'product_name':
        cmp = a.product_name.localeCompare(b.product_name)
        break
      case 'competitor_name':
        cmp = a.competitor_name.localeCompare(b.competitor_name)
        break
      case 'price':
        cmp = (a.price ?? Infinity) - (b.price ?? Infinity)
        break
      case 'price_per_100g':
        cmp = (a.price_per_100g ?? Infinity) - (b.price_per_100g ?? Infinity)
        break
      case 'weight_grams':
        cmp = (a.weight_grams ?? Infinity) - (b.weight_grams ?? Infinity)
        break
    }
    return dir === 'asc' ? cmp : -cmp
  })
}
