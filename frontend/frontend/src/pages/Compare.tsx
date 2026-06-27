import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis,
} from 'recharts'
import type { Product, Bookmark, CompetitorLogo } from '../types'
import { fmt, BB_NAME, BB_COLOR, COMP_COLOR } from '../types'
import { buildComparisonGroups, jaccard, MIN_SCORE } from '../lib/similarity'

const API = 'http://127.0.0.1:8000'

// ─── shared helpers ──────────────────────────────────────────────────────────

function ProductImg({ url, size, alt }: { url?: string | null; size: 48 | 80; alt: string }) {
  const cls = size === 80 ? 'h-20 w-20 rounded-xl' : 'h-12 w-12 rounded-lg'
  return url ? (
    <img src={url} alt={alt} loading="lazy" className={`${cls} object-cover bg-slate-100 border border-slate-200 shrink-0`} />
  ) : (
    <div className={`${cls} bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 text-slate-400">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
      </svg>
    </div>
  )
}

function CompetitorBadge({ name, logos, size = 28 }: { name: string; logos: Record<string, CompetitorLogo>; size?: number }) {
  const logo = logos[name]?.logo_url
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  const px = `${size}px`
  if (logo) return <img src={logo} alt={name} style={{ width: px, height: px }} className="rounded-lg object-contain border border-slate-200 bg-white shrink-0" />
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white leading-none select-none"
      style={{ width: px, height: px, backgroundColor: `hsl(${hue},55%,42%)` }} aria-hidden="true">{initials}</span>
  )
}

function BookmarkButton({ product, bookmarkKeys, onToggle }: {
  product: Product; bookmarkKeys: Set<string>; onToggle: (p: Product) => void
}) {
  const key = `${product.competitor_name}|||${product.product_name}|||${product.variant ?? ''}`
  const saved = bookmarkKeys.has(key)
  return (
    <button type="button" onClick={() => onToggle(product)}
      aria-label={saved ? `Remove ${product.product_name} from saved` : `Save ${product.product_name}`}
      className={`rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${saved ? 'text-amber-500 hover:text-amber-700' : 'text-slate-300 hover:text-amber-400'}`}>
      <svg viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}

// ─── search ──────────────────────────────────────────────────────────────────

function useProductIndex(products: Product[]) {
  return useMemo(() => {
    const bbMap = new Map<string, Product>()
    const compMap = new Map<string, Product>()
    for (const p of products) {
      if (p.is_jonny) { if (!bbMap.has(p.product_name)) bbMap.set(p.product_name, p) }
      else { if (!compMap.has(p.product_name)) compMap.set(p.product_name, p) }
    }
    return [...bbMap.values(), ...compMap.values()]
  }, [products])
}

function ProductSearch({ products, onSelect }: { products: Product[]; onSelect: (p: Product) => void }) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 160)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const index = useProductIndex(products)

  const results = useMemo(() => {
    const trimmed = debouncedQuery.trim().toLowerCase()
    if (!trimmed) return index.filter(p => p.is_jonny).slice(0, 10)
    return index.filter(p => p.product_name.toLowerCase().includes(trimmed)).slice(0, 12)
  }, [index, debouncedQuery])

  const showDropdown = focused && results.length > 0

  const pick = useCallback((p: Product) => {
    onSelect(p); setQuery(''); setDebouncedQuery(''); setFocused(false); setActive(-1)
  }, [onSelect])

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, -1)) }
    else if (e.key === 'Enter' && active >= 0 && results[active]) pick(results[active])
    else if (e.key === 'Escape') { setFocused(false); setActive(-1) }
  }, [showDropdown, results, active, pick])

  return (
    <div className="relative">
      <label htmlFor="compare-search" className="sr-only">Search for a product</label>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-400" aria-hidden="true">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        id="compare-search"
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setActive(-1) }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        onKeyDown={handleKey}
        placeholder="Search to compare a product…"
        aria-label="Search for a product to compare"
        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-base shadow-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
      />
      <AnimatePresence>
        {showDropdown && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 z-30 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-80 overflow-y-auto">
            <div className="sticky top-0 bg-slate-50/95 px-4 py-2 border-b border-slate-100 backdrop-blur-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {debouncedQuery.trim() ? `Results for "${debouncedQuery.trim()}"` : 'Your products — click to compare'}
              </p>
            </div>
            {results.map((p, i) => (
              <div key={p.id} onMouseDown={() => pick(p)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors ${i === active ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                <ProductImg url={p.image_url} size={48} alt="" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {p.is_jonny && <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-px text-[10px] font-bold text-white leading-none">★ Yours</span>}
                    <p className="text-sm font-semibold text-slate-900 truncate">{p.product_name}</p>
                  </div>
                  <p className="text-xs text-slate-400">{p.competitor_name}{p.variant ? ` · ${p.variant}` : ''}</p>
                </div>
                <p className="font-mono font-semibold text-slate-700 shrink-0 text-sm">{fmt(p.price, p.currency)}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── browse mode — notable differences ───────────────────────────────────────

interface NotableDiff {
  bbProduct: Product
  avgCompPrice100g: number
  diff: number
  matchCount: number
}

function useNotableDiffs(products: Product[]): { expensive: NotableDiff[]; cheap: NotableDiff[] } {
  return useMemo(() => {
    if (!products.length) return { expensive: [], cheap: [] }
    const bbByName = new Map<string, Product>()
    for (const p of products) {
      if (p.is_jonny && p.price_per_100g != null && !bbByName.has(p.product_name)) bbByName.set(p.product_name, p)
    }
    const diffs: NotableDiff[] = []
    for (const [, bbProd] of bbByName) {
      const peers = products.filter(p => !p.is_jonny && p.price_per_100g != null && jaccard(bbProd.product_name, p.product_name) >= MIN_SCORE)
      if (peers.length < 2) continue
      const avgComp = peers.reduce((s, p) => s + p.price_per_100g!, 0) / peers.length
      diffs.push({ bbProduct: bbProd, avgCompPrice100g: avgComp, diff: bbProd.price_per_100g! - avgComp, matchCount: peers.length })
    }
    diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    return { expensive: diffs.filter(d => d.diff > 0).slice(0, 4), cheap: diffs.filter(d => d.diff < 0).slice(0, 4) }
  }, [products])
}

function DiffCard({ d, onSelect, bookmarkKeys, onToggleBookmark }: {
  d: NotableDiff; onSelect: (p: Product) => void
  bookmarkKeys: Set<string>; onToggleBookmark: (p: Product) => void
}) {
  const pct = Math.abs((d.diff / d.avgCompPrice100g) * 100)
  const isExpensive = d.diff > 0
  return (
    <motion.div whileHover={{ y: -2 }} className={`rounded-2xl border p-4 min-w-[220px] max-w-[260px] flex-shrink-0 shadow-sm ${isExpensive ? 'border-red-200 bg-red-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold border ${isExpensive ? 'bg-red-100 text-red-700 border-red-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
          {isExpensive ? '▲' : '▼'} {pct.toFixed(0)}% {isExpensive ? 'pricier' : 'cheaper'}
        </span>
        <BookmarkButton product={d.bbProduct} bookmarkKeys={bookmarkKeys} onToggle={onToggleBookmark} />
      </div>
      <ProductImg url={d.bbProduct.image_url} size={48} alt="" />
      <p className="mt-2.5 text-sm font-bold text-slate-900 leading-tight line-clamp-2">{d.bbProduct.product_name}</p>
      <div className="mt-2 space-y-0.5">
        <p className="text-xs text-slate-500">BB: <span className="font-mono font-semibold text-amber-700">{fmt(d.bbProduct.price_per_100g)}/100g</span></p>
        <p className="text-xs text-slate-500">Avg market: <span className="font-mono">{fmt(d.avgCompPrice100g)}/100g</span></p>
        <p className="text-xs text-slate-400">{d.matchCount} competitors</p>
      </div>
      <button type="button" onClick={() => onSelect(d.bbProduct)}
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500">
        Compare →
      </button>
    </motion.div>
  )
}

// ─── browse mode — product cards ─────────────────────────────────────────────

function ProductCard({ p, onSelect, bookmarkKeys, onToggleBookmark, logos }: {
  p: Product; onSelect: (p: Product) => void
  bookmarkKeys: Set<string>; onToggleBookmark: (p: Product) => void
  logos: Record<string, CompetitorLogo>
}) {
  const isJonny = p.is_jonny
  return (
    <div className={`group flex items-start gap-3 rounded-xl border p-3 transition-colors ${isJonny ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
      <ProductImg url={p.image_url} size={48} alt={p.product_name} />
      <div className="flex-1 min-w-0">
        {!isJonny && (
          <div className="flex items-center gap-1.5 mb-0.5">
            <CompetitorBadge name={p.competitor_name} logos={logos} size={16} />
            <span className="text-[10px] font-semibold text-slate-400 truncate">{p.competitor_name}</span>
          </div>
        )}
        <p className={`text-sm font-semibold leading-tight line-clamp-2 ${isJonny ? 'text-amber-900' : 'text-slate-800'}`}>{p.product_name}</p>
        {p.product_type && <p className="text-xs text-slate-400 mt-0.5">{p.product_type}</p>}
        <p className={`text-xs font-mono mt-1 font-bold ${isJonny ? 'text-amber-700' : 'text-slate-700'}`}>{fmt(p.price, p.currency)}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <BookmarkButton product={p} bookmarkKeys={bookmarkKeys} onToggle={onToggleBookmark} />
        <button type="button" onClick={() => onSelect(p)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500">
          Compare
        </button>
      </div>
    </div>
  )
}

// ─── browse mode ─────────────────────────────────────────────────────────────

function BrowseMode({ allProducts, categories, onSelect, bookmarkKeys, onToggleBookmark, logos }: {
  allProducts: Product[]
  categories: string[]
  onSelect: (p: Product) => void
  bookmarkKeys: Set<string>
  onToggleBookmark: (p: Product) => void
  logos: Record<string, CompetitorLogo>
}) {
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [competitorFilter, setCompetitorFilter] = useState<string>('All')

  const diffs = useNotableDiffs(allProducts)

  // Deduplicated product lists
  const bbProducts = useMemo(() => {
    const seen = new Set<string>()
    return allProducts.filter(p => {
      if (!p.is_jonny) return false
      if (activeCategory !== 'All' && p.product_type !== activeCategory) return false
      if (seen.has(p.product_name)) return false
      seen.add(p.product_name)
      return true
    })
  }, [allProducts, activeCategory])

  // Competitor products grouped by competitor
  const competitorsByName = useMemo(() => {
    const competitors = [...new Set(allProducts.filter(p => !p.is_jonny).map(p => p.competitor_name))].sort()
    return competitors.reduce<Record<string, Product[]>>((acc, comp) => {
      if (competitorFilter !== 'All' && comp !== competitorFilter) return acc
      const seen = new Set<string>()
      acc[comp] = allProducts.filter(p => {
        if (p.is_jonny || p.competitor_name !== comp) return false
        if (activeCategory !== 'All' && p.product_type !== activeCategory) return false
        if (seen.has(p.product_name)) return false
        seen.add(p.product_name)
        return true
      })
      return acc
    }, {})
  }, [allProducts, activeCategory, competitorFilter])

  const competitorNames = useMemo(() =>
    [...new Set(allProducts.filter(p => !p.is_jonny).map(p => p.competitor_name))].sort()
  , [allProducts])

  const hasExpensive = diffs.expensive.length > 0
  const hasCheap = diffs.cheap.length > 0

  return (
    <div className="space-y-8">
      {/* Notable differences */}
      {(hasExpensive || hasCheap) && (
        <section aria-labelledby="diffs-heading">
          <h2 id="diffs-heading" className="text-base font-bold text-slate-800 mb-3">Most notable price differences vs market</h2>
          <div className="space-y-4">
            {hasExpensive && (
              <div>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Where you're pricier than competitors</p>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                  {diffs.expensive.map(d => (
                    <DiffCard key={d.bbProduct.id} d={d} onSelect={onSelect}
                      bookmarkKeys={bookmarkKeys} onToggleBookmark={onToggleBookmark} />
                  ))}
                </div>
              </div>
            )}
            {hasCheap && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Where you offer best value</p>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                  {diffs.cheap.map(d => (
                    <DiffCard key={d.bbProduct.id} d={d} onSelect={onSelect}
                      bookmarkKeys={bookmarkKeys} onToggleBookmark={onToggleBookmark} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Category pills */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Browse by category</p>
        <div className="flex flex-wrap gap-2">
          {['All', ...categories].map(cat => (
            <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${activeCategory === cat ? 'bg-amber-500 border-amber-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-700'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column browser */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Your Products */}
        <section aria-labelledby="your-products-heading">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-3 w-3 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
            <h2 id="your-products-heading" className="text-sm font-bold text-amber-800">
              Your Range — Barneys Bundles
              <span className="ml-2 font-normal text-amber-600">({bbProducts.length})</span>
            </h2>
          </div>
          {bbProducts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <p className="text-sm text-slate-400">No products in this category</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bbProducts.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.2) }}>
                  <ProductCard p={p} onSelect={onSelect} bookmarkKeys={bookmarkKeys} onToggleBookmark={onToggleBookmark} logos={logos} />
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Competitor Products */}
        <section aria-labelledby="comp-products-heading">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-indigo-500 shrink-0" aria-hidden="true" />
              <h2 id="comp-products-heading" className="text-sm font-bold text-slate-700">Competitors</h2>
            </div>
            <label htmlFor="comp-filter" className="sr-only">Filter by competitor</label>
            <select id="comp-filter" value={competitorFilter} onChange={e => setCompetitorFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30">
              <option value="All">All stores</option>
              {competitorNames.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-4">
            {Object.entries(competitorsByName).filter(([, items]) => items.length > 0).map(([comp, items]) => (
              <CompetitorSection key={comp} name={comp} products={items} logos={logos}
                onSelect={onSelect} bookmarkKeys={bookmarkKeys} onToggleBookmark={onToggleBookmark} />
            ))}
            {Object.values(competitorsByName).every(v => v.length === 0) && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-400">No products in this category</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function CompetitorSection({ name, products, logos, onSelect, bookmarkKeys, onToggleBookmark }: {
  name: string; products: Product[]; logos: Record<string, CompetitorLogo>
  onSelect: (p: Product) => void; bookmarkKeys: Set<string>; onToggleBookmark: (p: Product) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const LIMIT = 5
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? products : products.slice(0, LIMIT)

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button type="button" onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-inset text-left">
        <CompetitorBadge name={name} logos={logos} size={28} />
        <span className="flex-1 text-sm font-bold text-slate-700">{name}</span>
        <span className="text-xs text-slate-400">{products.length}</span>
        <motion.span animate={{ rotate: expanded ? 90 : 0 }} className="text-slate-400 text-xs font-bold" aria-hidden="true">▶</motion.span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}>
            <div className="p-3 space-y-2">
              {shown.map(p => (
                <ProductCard key={p.id} p={p} onSelect={onSelect} bookmarkKeys={bookmarkKeys} onToggleBookmark={onToggleBookmark} logos={logos} />
              ))}
              {products.length > LIMIT && (
                <button type="button" onClick={() => setShowAll(s => !s)}
                  className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-amber-700 focus:outline-none focus:underline">
                  {showAll ? 'Show less' : `Show ${products.length - LIMIT} more…`}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── comparison mode ──────────────────────────────────────────────────────────

interface BarTipPayload { competitor: string; avg: number; isJonny: boolean; count: number }
function BarTip({ active, payload }: { active?: boolean; payload?: { payload: BarTipPayload }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <p className={`font-semibold text-sm ${d.isJonny ? 'text-amber-700' : 'text-slate-800'}`}>{d.competitor}</p>
      <p className="text-slate-700 font-mono mt-0.5">{fmt(d.avg)} <span className="text-slate-400 text-xs">/ 100g</span></p>
      <p className="text-slate-400 text-xs">{d.count} product{d.count !== 1 ? 's' : ''}</p>
    </div>
  )
}

// Always renders exactly 5 cells so it shares column widths with the parent table header
function VariantRow({ p, jonnyPrice, isJonny, delay }: {
  p: Product; jonnyPrice: number | null; isJonny: boolean; delay?: number
}) {
  const diff = jonnyPrice != null && p.price != null && !isJonny ? jonnyPrice - p.price : null
  const pct = diff != null && p.price != null ? (diff / p.price) * 100 : null
  const sizeLabel = p.variant ?? 'Standard size'
  return (
    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay ?? 0 }}
      className={`border-b text-sm ${isJonny ? 'bg-amber-50/40 border-amber-100' : 'border-slate-100 hover:bg-slate-50/40'}`}>
      {/* Col 1 — indented to align under product name in header row */}
      <td className="py-2.5 pr-4 pl-20">
        <div className="flex items-center gap-2">
          <ProductImg url={p.image_url} size={48} alt="" />
          <a href={p.product_url} target="_blank" rel="noopener noreferrer"
            className={`text-xs font-medium hover:underline underline-offset-2 truncate ${isJonny ? 'text-amber-800' : 'text-slate-700'}`}>
            {sizeLabel}
          </a>
        </div>
      </td>
      {/* Col 2 */}
      <td className="px-4 py-2.5 font-mono text-xs text-slate-600 whitespace-nowrap">{fmt(p.price_per_100g, p.currency)}</td>
      {/* Col 3 */}
      <td className="px-4 py-2.5 font-mono font-semibold text-slate-800 whitespace-nowrap">{fmt(p.price, p.currency)}</td>
      {/* Col 4 — Barneys price */}
      <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">
        {!isJonny && jonnyPrice != null
          ? <span className="font-semibold text-amber-700">{fmt(jonnyPrice, p.currency)}</span>
          : <span className="text-slate-300">—</span>}
      </td>
      {/* Col 5 — Difference */}
      <td className="px-4 py-2.5">
        {!isJonny && diff != null && pct != null ? (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold font-mono ${diff > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
            {diff > 0 ? '▼' : '▲'} {fmt(Math.abs(diff), p.currency)} ({Math.abs(pct).toFixed(1)}%)
          </span>
        ) : <span className="text-slate-300 text-xs">—</span>}
      </td>
    </motion.tr>
  )
}

function GroupRow({ group, jonnyGroup, allExpanded, bookmarkKeys, onToggleBookmark, logos }: {
  group: ReturnType<typeof buildComparisonGroups>[0]
  jonnyGroup: ReturnType<typeof buildComparisonGroups>[0] | undefined
  allExpanded: boolean
  bookmarkKeys: Set<string>
  onToggleBookmark: (p: Product) => void
  logos: Record<string, CompetitorLogo>
}) {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => { setExpanded(allExpanded) }, [allExpanded])

  const isJonny = group.is_jonny
  const jonnyPrice = jonnyGroup?.min_price ?? null
  const diff = jonnyPrice != null && group.min_price != null && !isJonny ? jonnyPrice - group.min_price : null
  const pct = diff != null && group.min_price != null ? (diff / group.min_price) * 100 : null

  return (
    <>
      <tr className={`border-b cursor-pointer transition-colors ${isJonny ? 'bg-amber-100/60 border-amber-200 hover:bg-amber-100' : 'border-slate-200 hover:bg-slate-50'}`}
        onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <motion.span animate={{ rotate: expanded ? 90 : 0 }} className="text-slate-400 text-xs font-bold select-none" aria-hidden="true">▶</motion.span>
            <ProductImg url={group.variants[0]?.image_url} size={48} alt="" />
            <div className="min-w-0">
              {!isJonny && (
                <div className="flex items-center gap-1.5 mb-0.5">
                  <CompetitorBadge name={group.competitor_name} logos={logos} size={16} />
                  <span className="text-[10px] font-semibold text-slate-400">{group.competitor_name}</span>
                </div>
              )}
              <p className={`font-semibold text-sm truncate ${isJonny ? 'text-amber-800' : 'text-slate-800'}`}>{group.product_name}</p>
              <p className="text-xs text-slate-400">{group.variants.length} size{group.variants.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 font-mono text-sm text-slate-600 whitespace-nowrap">
          {group.best_price_per_100g != null ? fmt(group.best_price_per_100g) : '—'}
        </td>
        <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">
          {group.min_price != null ? `from ${fmt(group.min_price)}` : '—'}
        </td>
        {!isJonny && (
          <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">
            {jonnyPrice != null ? <span className="font-semibold text-amber-700">{fmt(jonnyPrice)}</span> : <span className="text-slate-300">—</span>}
          </td>
        )}
        {!isJonny && (
          <td className="px-4 py-3">
            {diff != null && pct != null ? (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold font-mono ${diff > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                {diff > 0 ? '▼ BB cheaper' : '▲ BB pricier'} · {Math.abs(pct).toFixed(1)}%
              </span>
            ) : <span className="text-slate-300 text-xs">No BB match</span>}
          </td>
        )}
        {isJonny && (
          <td colSpan={2} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-800">★ Your products</span>
              <BookmarkButton product={group.variants[0]} bookmarkKeys={bookmarkKeys} onToggle={onToggleBookmark} />
            </div>
          </td>
        )}
      </tr>
      {/* Variant rows rendered as direct <tr> siblings — no nested table — so columns align with header */}
      {expanded && group.variants.map((v, i) => (
        <VariantRow key={v.id} p={v} jonnyPrice={jonnyPrice} isJonny={isJonny} delay={i * 0.04} />
      ))}
    </>
  )
}

function WhatIf({ jonnyGroup, competitorGroups }: {
  jonnyGroup: ReturnType<typeof buildComparisonGroups>[0]
  competitorGroups: ReturnType<typeof buildComparisonGroups>
}) {
  const jonnyCurrentPrice = jonnyGroup.min_price ?? 0
  const maxCompetitorPrice = Math.max(...competitorGroups.map(g => g.min_price ?? 0), jonnyCurrentPrice)
  const sliderMax = Math.max(maxCompetitorPrice * 1.5, jonnyCurrentPrice * 2, 20)
  const [hypoPrice, setHypoPrice] = useState(jonnyCurrentPrice)
  const [costPrice, setCostPrice] = useState('')
  const margin = costPrice !== '' && Number(costPrice) > 0 && hypoPrice > 0
    ? ((hypoPrice - Number(costPrice)) / hypoPrice * 100) : null

  const ranking = useMemo(() => {
    const compPrices = competitorGroups.filter(g => g.min_price != null)
      .map(g => ({ name: g.competitor_name, price: g.min_price! }))
      .sort((a, b) => a.price - b.price)
    return { rank: compPrices.filter(c => c.price < hypoPrice).length + 1, total: compPrices.length + 1, compPrices }
  }, [competitorGroups, hypoPrice])

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="mt-6 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
      <h3 className="text-lg font-bold text-amber-900 mb-1">What-if pricing</h3>
      <p className="text-sm text-amber-700/70 mb-5">See how a price change would rank you against competitors</p>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="hypo-slider" className="block text-sm font-semibold text-amber-800 mb-2">
            Hypothetical price: <span className="font-mono text-amber-600">{fmt(hypoPrice)}</span>
            {hypoPrice !== jonnyCurrentPrice && (
              <span className={`ml-2 text-xs font-bold ${hypoPrice < jonnyCurrentPrice ? 'text-emerald-600' : 'text-red-600'}`}>
                ({hypoPrice < jonnyCurrentPrice ? '▼' : '▲'} {fmt(Math.abs(hypoPrice - jonnyCurrentPrice))})
              </span>
            )}
          </label>
          <input id="hypo-slider" type="range" min={0} max={sliderMax} step={0.01} value={hypoPrice}
            onChange={e => setHypoPrice(Number(e.target.value))}
            className="w-full accent-amber-500" aria-label={`Hypothetical price: ${fmt(hypoPrice)}`} />
          <div className="flex justify-between text-xs text-amber-600/60 mt-1"><span>£0</span><span>{fmt(sliderMax)}</span></div>
        </div>
        <div>
          <label htmlFor="cost-price" className="block text-sm font-semibold text-amber-800 mb-2">Cost price (optional)</label>
          <input id="cost-price" type="number" min={0} step={0.01} value={costPrice} onChange={e => setCostPrice(e.target.value)}
            placeholder="e.g. 1.50" className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-white/70 p-4 text-center">
          <p className="text-xs text-amber-600/70 mb-1 font-medium">Your rank</p>
          <p className="text-3xl font-black text-amber-700">#{ranking.rank}</p>
          <p className="text-xs text-amber-600/60">of {ranking.total} competitors</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white/70 p-4 text-center">
          <p className="text-xs text-amber-600/70 mb-1 font-medium">Margin</p>
          {margin != null
            ? <><p className={`text-3xl font-black ${margin > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{margin.toFixed(1)}%</p><p className="text-xs text-slate-400">at {fmt(hypoPrice)}</p></>
            : <p className="text-2xl font-bold text-slate-300">—</p>}
        </div>
        <div className="rounded-xl border border-amber-200 bg-white/70 p-4 text-center">
          <p className="text-xs text-amber-600/70 mb-1 font-medium">vs current</p>
          <p className={`text-3xl font-black ${hypoPrice < jonnyCurrentPrice ? 'text-emerald-600' : hypoPrice > jonnyCurrentPrice ? 'text-red-600' : 'text-slate-400'}`}>
            {hypoPrice === jonnyCurrentPrice ? '—' : (hypoPrice < jonnyCurrentPrice ? '▼' : '▲') + ' ' + fmt(Math.abs(hypoPrice - jonnyCurrentPrice))}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold text-amber-800 mb-2">Price ranking</p>
        <div className="flex flex-wrap gap-2">
          {[...ranking.compPrices, { name: BB_NAME, price: hypoPrice }]
            .sort((a, b) => a.price - b.price)
            .map((c, i) => (
              <span key={c.name} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border ${c.name === BB_NAME ? 'bg-amber-500 text-white border-amber-600 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>
                #{i + 1} {c.name === BB_NAME ? 'You' : c.name.split(' ')[0]} · {fmt(c.price)}
              </span>
            ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Compare() {
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [logos, setLogos] = useState<Record<string, CompetitorLogo>>({})
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Product | null>(null)
  const [expandAll, setExpandAll] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    Promise.all([
      fetch(`${API}/products`, { signal: ac.signal }).then(r => r.json() as Promise<Product[]>),
      fetch(`${API}/product-types`, { signal: ac.signal }).then(r => r.json() as Promise<string[]>),
      fetch(`${API}/competitors/logos`, { signal: ac.signal }).then(r => r.json() as Promise<Record<string, CompetitorLogo>>),
      fetch(`${API}/bookmarks`, { signal: ac.signal }).then(r => r.json() as Promise<Bookmark[]>),
    ]).then(([prods, cats, logoMap, bms]) => {
      setAllProducts(prods); setCategories(cats); setLogos(logoMap); setBookmarks(bms); setLoading(false)
    }).catch(err => { if (err.name !== 'AbortError') { setError(String(err.message)); setLoading(false) } })
    return () => ac.abort()
  }, [])

  const bookmarkKeys = useMemo(() =>
    new Set(bookmarks.map(b => `${b.competitor_name}|||${b.product_name}|||${b.variant ?? ''}`))
  , [bookmarks])

  const toggleBookmark = useCallback(async (p: Product) => {
    const key = `${p.competitor_name}|||${p.product_name}|||${p.variant ?? ''}`
    if (bookmarkKeys.has(key)) {
      const bm = bookmarks.find(b => `${b.competitor_name}|||${b.product_name}|||${b.variant ?? ''}` === key)
      if (!bm) return
      await fetch(`${API}/bookmarks/${bm.id}`, { method: 'DELETE' })
      setBookmarks(prev => prev.filter(b => b.id !== bm.id))
    } else {
      const result = await fetch(`${API}/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_name: p.competitor_name, product_name: p.product_name, variant: p.variant }),
      }).then(r => r.json() as Promise<Bookmark>)
      setBookmarks(prev => [...prev, result])
    }
  }, [bookmarkKeys, bookmarks])

  const groups = useMemo(() => selected ? buildComparisonGroups(selected, allProducts) : [], [selected, allProducts])
  const jonnyGroup = groups.find(g => g.is_jonny)
  const competitorGroups = groups.filter(g => !g.is_jonny)

  const chartData = useMemo(() =>
    groups.filter(g => g.best_price_per_100g != null)
      .map(g => ({ competitor: g.competitor_name, avg: g.best_price_per_100g!, isJonny: g.is_jonny, count: g.variants.length }))
      .sort((a, b) => a.avg - b.avg)
  , [groups])

  const scatterData = useMemo(() =>
    groups.flatMap(g =>
      g.variants.filter(v => v.price != null && v.weight_grams != null)
        .map(v => ({ weight: v.weight_grams!, price: v.price!, isJonny: g.is_jonny }))
    )
  , [groups])

  if (loading) return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Loading">
      <div className="h-8 w-8 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
    </div>
  )
  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center" role="alert">
      <p className="font-semibold text-red-700">Could not load products</p>
      <p className="mt-1 text-sm text-red-500">{error}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Compare</h1>
        <p className="mt-0.5 text-sm text-slate-500">Search or browse to compare Barneys Bundles against competitors</p>
      </div>

      <ProductSearch products={allProducts} onSelect={p => { setSelected(p); setExpandAll(false) }} />

      {!selected ? (
        <BrowseMode
          allProducts={allProducts}
          categories={categories}
          onSelect={p => { setSelected(p); setExpandAll(false) }}
          bookmarkKeys={bookmarkKeys}
          onToggleBookmark={toggleBookmark}
          logos={logos}
        />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={selected.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Selected product header */}
            <div className="flex items-start gap-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
              <ProductImg url={selected.image_url} size={80} alt={selected.product_name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">Comparing</span>
                  <div className="flex items-center gap-1.5">
                    <CompetitorBadge name={selected.competitor_name} logos={logos} size={18} />
                    <span className="text-sm text-amber-700 font-medium">{selected.competitor_name}</span>
                  </div>
                </div>
                <h2 className="text-lg font-bold text-amber-900 leading-tight">{selected.product_name}</h2>
                {selected.variant && <p className="text-amber-700/70 text-sm mt-0.5">{selected.variant}</p>}
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="font-mono text-xl font-black text-amber-800">{fmt(selected.price, selected.currency)}</span>
                  {selected.price_per_100g != null && <span className="text-sm text-amber-600">{fmt(selected.price_per_100g, selected.currency)} / 100g</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <BookmarkButton product={selected} bookmarkKeys={bookmarkKeys} onToggle={toggleBookmark} />
                <button type="button" onClick={() => setSelected(null)} aria-label="Back to browse"
                  className="rounded-lg p-2 text-amber-600 hover:bg-amber-200/60 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>

            {groups.length <= 1 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                <p className="text-slate-400">No competitor products found with a similar name</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Competitors found', value: String(competitorGroups.length) },
                    { label: 'Barneys from', value: fmt(jonnyGroup?.min_price) },
                    { label: 'Cheapest competitor', value: fmt(Math.min(...competitorGroups.map(g => g.min_price ?? Infinity).filter(isFiniteN))) },
                    { label: 'Most expensive', value: fmt(Math.max(...competitorGroups.map(g => g.min_price ?? -Infinity).filter(v => v !== -Infinity))) },
                  ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                      <p className="text-xl font-black text-slate-800 mt-0.5 font-mono">{s.value}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                    <h3 className="text-sm font-bold text-slate-700">All matching products · click a row to expand variants</h3>
                    <button type="button" onClick={() => setExpandAll(e => !e)}
                      className="text-xs font-semibold text-amber-600 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded px-2 py-1">
                      {expandAll ? 'Collapse all' : 'Expand all'}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" aria-label="Competitor comparison">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/40">
                          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Competitor · Product</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Best £/100g</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">From price</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Barneys price</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jonnyGroup && <GroupRow group={jonnyGroup} jonnyGroup={jonnyGroup} allExpanded={expandAll} bookmarkKeys={bookmarkKeys} onToggleBookmark={toggleBookmark} logos={logos} />}
                        {competitorGroups
                          .sort((a, b) => (a.min_price ?? Infinity) - (b.min_price ?? Infinity))
                          .map(g => <GroupRow key={`${g.competitor_name}|||${g.product_name}`} group={g} jonnyGroup={jonnyGroup} allExpanded={expandAll} bookmarkKeys={bookmarkKeys} onToggleBookmark={toggleBookmark} logos={logos} />)}
                      </tbody>
                    </table>
                  </div>
                </div>

                {chartData.length > 1 && (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-700 mb-4">Best £/100g by competitor</h3>
                      <div role="img" aria-label="Bar chart: price per 100g by competitor">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 56 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="competitor" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-35} textAnchor="end" height={72} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={0} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `£${(v as number).toFixed(2)}`} tickLine={false} axisLine={false} width={52} />
                            <Tooltip content={<BarTip />} cursor={{ fill: '#f8fafc' }} />
                            <Bar dataKey="avg" radius={[6, 6, 0, 0]} maxBarSize={48}>
                              {chartData.map((d, i) => <Cell key={i} fill={d.isJonny ? BB_COLOR : COMP_COLOR} fillOpacity={d.isJonny ? 1 : 0.65} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-5 mt-1">
                        <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-3 w-3 rounded-sm shrink-0 bg-amber-500" aria-hidden="true" />Barneys</span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-3 w-3 rounded-sm shrink-0 bg-indigo-500/65" aria-hidden="true" />Competitors</span>
                      </div>
                    </motion.div>

                    {scatterData.length > 3 && (
                      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-700 mb-4">Price vs weight</h3>
                        <div role="img" aria-label="Scatter chart: price vs weight">
                          <ResponsiveContainer width="100%" height={260}>
                            <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis type="number" dataKey="weight" name="Weight" unit="g" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} label={{ value: 'Weight (g)', position: 'insideBottom', offset: -4, fill: '#94a3b8', fontSize: 11 }} />
                              <YAxis type="number" dataKey="price" name="Price" tickFormatter={v => `£${(v as number).toFixed(0)}`} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                              <ZAxis range={[40, 40]} />
                              <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v) => [`£${(v as number).toFixed(2)}`, 'Price']} />
                              <Scatter data={scatterData.filter(d => !d.isJonny)} fill={COMP_COLOR} fillOpacity={0.55} name="Competitors" />
                              <Scatter data={scatterData.filter(d => d.isJonny)} fill={BB_COLOR} name="Barneys" />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-5 mt-1">
                          <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="inline-block h-3 w-3 rounded-full shrink-0 bg-amber-500" aria-hidden="true" />Barneys</span>
                          <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="inline-block h-3 w-3 rounded-full shrink-0 bg-indigo-500/55" aria-hidden="true" />Competitors</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {jonnyGroup && <WhatIf jonnyGroup={jonnyGroup} competitorGroups={competitorGroups} />}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

function isFiniteN(n: number) { return Number.isFinite(n) }
