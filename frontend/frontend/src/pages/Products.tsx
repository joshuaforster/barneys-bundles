import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { Product, SortKey, SortDir } from '../types'
import { fmt, sortProducts, BB_NAME } from '../types'
import { computeBBCoverage } from '../lib/similarity'

const API = 'http://127.0.0.1:8000'
const PAGE_SIZE = 50

function ProductImg({ url, alt }: { url?: string | null; alt: string }) {
  return url ? (
    <img src={url} alt={alt} loading="lazy" className="h-12 w-12 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0" />
  ) : (
    <div className="h-12 w-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5 text-slate-400">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
      </svg>
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      {[12, 28, 48, 20, 16, 14, 20, 14].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`h-4 w-${w} rounded bg-slate-200 animate-pulse`} />
        </td>
      ))}
      <td className="px-4 py-3"><div className="h-4 w-12 rounded bg-slate-100 animate-pulse" /></td>
    </tr>
  )
}

function SortTh({ column, label, sortKey, sortDir, onSort }: {
  column: SortKey; label: string; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void
}) {
  const active = sortKey === column
  const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
  return (
    <th scope="col" aria-sort={ariaSort as 'ascending' | 'descending' | 'none'} className="px-4 py-3 text-left">
      <button type="button" onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors"
        aria-label={`Sort by ${label}`}>
        {label}
        <span aria-hidden="true" className={active ? 'text-amber-500' : 'text-slate-300'}>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}

function MultiSelect({ id, label, options, value, onChange }: {
  id: string; label: string; options: string[]; value: string[]; onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const toggle = (opt: string) => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  const summary = value.length === 0 ? `All ${label}s` : value.length === 1 ? value[0] : `${value.length} selected`

  return (
    <div ref={ref} className="relative">
      <label id={`${id}-lbl`} className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</label>
      <button type="button" aria-haspopup="true" aria-expanded={open ? 'true' : 'false'} aria-labelledby={`${id}-lbl`}
        onClick={() => setOpen(o => !o)}
        className="flex w-full min-w-[180px] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500">
        <span className="truncate">{summary}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.1 }}
            role="group" aria-labelledby={`${id}-lbl`}
            className="absolute top-full left-0 z-20 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {value.length > 0 && (
              <div className="border-b border-slate-100 px-3 py-2">
                <button type="button" onClick={() => onChange([])} className="text-xs font-semibold text-amber-600 hover:text-amber-700 focus:outline-none focus:underline">
                  Clear {value.length} selected
                </button>
              </div>
            )}
            <div className="max-h-56 overflow-y-auto py-1">
              {options.map(opt => (
                <label key={opt} className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 ${value.includes(opt) ? 'bg-amber-50' : ''}`}>
                  <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)}
                    className="h-4 w-4 rounded border-slate-300 accent-amber-500 focus:ring-amber-500" />
                  <span className={`truncate ${opt === BB_NAME ? 'font-bold text-amber-700' : 'text-slate-700'}`}>{opt}</span>
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CategoryFilter({ productTypes, selectedTypes, onToggle }: {
  productTypes: string[]
  selectedTypes: string[]
  onToggle: (type: string) => void
}) {
  const [open, setOpen] = useState(false)
  const activeCount = selectedTypes.length
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 rounded w-fit">
        <span>Category</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-amber-100 border border-amber-200 text-amber-800 px-2 py-0.5 text-[11px] font-bold">{activeCount} selected</span>
        )}
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-slate-400" aria-hidden="true">▾</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="flex flex-wrap gap-2 pt-1">
              {productTypes.map(type => {
                const active = selectedTypes.includes(type)
                return (
                  <button key={type} type="button" onClick={() => onToggle(type)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 ${active ? 'bg-amber-100 border-amber-300 text-amber-900' : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:text-amber-800'}`}>
                    {type}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span id={`${id}-lbl`} className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <button type="button" role="switch" aria-checked={String(checked) as 'true' | 'false'} aria-labelledby={`${id}-lbl`}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 ${checked ? 'bg-amber-700' : 'bg-slate-200'}`}>
        <motion.span layout className="inline-block h-4 w-4 rounded-full bg-white shadow-md"
          animate={{ x: checked ? 24 : 4 }} transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
      </button>
    </div>
  )
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [competitors, setCompetitors] = useState<string[]>([])
  const [productTypes, setProductTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const view = (searchParams.get('view') ?? 'all') as 'all' | 'bb' | 'comp'
  const q = searchParams.get('q') ?? ''
  const selectedCompetitors = useMemo(() => (searchParams.get('c') ?? '').split(',').filter(Boolean), [searchParams])
  const selectedTypes = useMemo(() => (searchParams.get('t') ?? '').split(',').filter(Boolean), [searchParams])
  const onlyAvailable = searchParams.get('av') === '1'
  const onlyJonny = searchParams.get('jn') === '1'
  const onlyChanged = searchParams.get('pc') === '1'
  const onlyBBMatch = searchParams.get('bb') === '1'

  const VALID_SORT: SortKey[] = ['product_name', 'competitor_name', 'price', 'price_per_100g', 'weight_grams']
  const rawSk = searchParams.get('sk') ?? 'competitor_name'
  const sortKey: SortKey = (VALID_SORT.includes(rawSk as SortKey) ? rawSk : 'competitor_name') as SortKey
  const sortDir: SortDir = searchParams.get('sd') === 'desc' ? 'desc' : 'asc'
  const page = Math.max(1, parseInt(searchParams.get('p') ?? '1', 10))

  const setParam = useCallback((updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(updates)) { if (!v) next.delete(k); else next.set(k, v) }
      next.delete('p')
      return next
    })
  }, [setSearchParams])

  const handleSort = useCallback((key: SortKey) => {
    const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('sk', key); next.set('sd', newDir); next.delete('p')
      return next
    })
  }, [sortKey, sortDir, setSearchParams])

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true); setError(null)
    Promise.all([
      fetch(`${API}/products`, { signal: ac.signal }).then(r => r.json() as Promise<Product[]>),
      fetch(`${API}/competitors`, { signal: ac.signal }).then(r => r.json() as Promise<string[]>),
      fetch(`${API}/product-types`, { signal: ac.signal }).then(r => r.json() as Promise<string[]>),
    ]).then(([prods, comps, types]) => {
      setAllProducts(prods); setCompetitors(comps.filter(c => c !== BB_NAME)); setProductTypes(types); setLoading(false)
    }).catch(err => { if (err.name !== 'AbortError') { setError(String(err.message)); setLoading(false) } })
    return () => ac.abort()
  }, [])

  const bbCoverage = useMemo(() => computeBBCoverage(allProducts), [allProducts])

  const bbCount = useMemo(() => allProducts.filter(p => p.is_jonny).length, [allProducts])
  const compCount = useMemo(() => allProducts.filter(p => !p.is_jonny).length, [allProducts])

  const filtered = useMemo(() => {
    let list = allProducts
    if (view === 'bb') list = list.filter(p => p.is_jonny)
    else if (view === 'comp') list = list.filter(p => !p.is_jonny)
    if (q) { const lq = q.toLowerCase(); list = list.filter(p => p.product_name.toLowerCase().includes(lq) || p.competitor_name.toLowerCase().includes(lq)) }
    if (selectedCompetitors.length) list = list.filter(p => selectedCompetitors.includes(p.competitor_name))
    if (selectedTypes.length) list = list.filter(p => selectedTypes.includes(p.product_type ?? ''))
    if (onlyAvailable) list = list.filter(p => p.available)
    if (view !== 'bb' && onlyJonny) list = list.filter(p => p.is_jonny)
    if (onlyChanged) list = list.filter(p => p.price_changed)
    if (onlyBBMatch) list = list.filter(p => p.is_jonny || bbCoverage.has(p.id))
    return sortProducts(list, sortKey, sortDir)
  }, [allProducts, view, q, selectedCompetitors, selectedTypes, onlyAvailable, onlyJonny, onlyChanged, onlyBBMatch, sortKey, sortDir, bbCoverage])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasFilters = !!(q || selectedCompetitors.length || selectedTypes.length || onlyAvailable || onlyJonny || onlyChanged || onlyBBMatch)

  const toggleType = useCallback((type: string) => {
    const next = selectedTypes.includes(type) ? selectedTypes.filter(t => t !== type) : [...selectedTypes, type]
    setParam({ t: next.join(',') || null })
  }, [selectedTypes, setParam])

  const pageNums = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const s = new Set([1, totalPages, page - 1, page, page + 1].filter(n => n >= 1 && n <= totalPages))
    return [...s].sort((a, b) => a - b)
  })()

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Products</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {loading ? 'Loading…' : `${filtered.length.toLocaleString()} of ${allProducts.length.toLocaleString()} products${hasFilters ? ' matching filters' : ''}`}
          </p>
        </div>
        {hasFilters && (
          <button type="button" onClick={() => setSearchParams({})}
            className="text-sm font-semibold text-amber-600 hover:text-amber-700 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded">
            Clear all filters
          </button>
        )}
      </div>

      {/* View tabs — BB separate from competitors */}
      <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm gap-1" aria-label="Product view">
        {([
          { id: 'all', label: 'All Products', count: allProducts.length },
          { id: 'bb', label: '★ Your Range', count: bbCount },
          { id: 'comp', label: 'Other stores', count: compCount },
        ] as const).map(tab => (
          <button key={tab.id} type="button"
            onClick={() => { const next = new URLSearchParams(searchParams); if (tab.id === 'all') next.delete('view'); else next.set('view', tab.id); next.delete('p'); setSearchParams(next) }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 ${view === tab.id ? (tab.id === 'bb' ? 'bg-amber-100 text-amber-900 border border-amber-200 shadow-sm' : 'bg-slate-100 text-slate-900 border border-slate-200 shadow-sm') : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
            {tab.label}
            <span className={`ml-2 text-xs font-normal ${view === tab.id ? 'opacity-70' : 'text-slate-400'}`}>({tab.count.toLocaleString()})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <label htmlFor="product-search" className="sr-only">Search products</label>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3.5 top-3 h-5 w-5 text-slate-400 pointer-events-none" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input id="product-search" type="search" value={q} onChange={e => setParam({ q: e.target.value || null })}
          placeholder="Search products or competitors…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm shadow-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          {view !== 'bb' && (
            <MultiSelect id="comp-ms" label="Competitor" options={competitors} value={selectedCompetitors} onChange={v => setParam({ c: v.join(',') || null })} />
          )}
          <Toggle id="avail" label="In stock" checked={onlyAvailable} onChange={v => setParam({ av: v ? '1' : null })} />
          {view === 'all' && <Toggle id="jonny" label="Barneys only" checked={onlyJonny} onChange={v => setParam({ jn: v ? '1' : null })} />}
          <Toggle id="changed" label="Price changed" checked={onlyChanged} onChange={v => setParam({ pc: v ? '1' : null })} />
          {view !== 'bb' && <Toggle id="bbmatch" label="BB has this" checked={onlyBBMatch} onChange={v => setParam({ bb: v ? '1' : null })} />}
        </div>
        {/* Category multi-select pills — collapsible */}
        {productTypes.length > 0 && <CategoryFilter productTypes={productTypes} selectedTypes={selectedTypes} onToggle={toggleType} />}
      </div>

      {/* Table */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center" role="alert">
          <p className="font-semibold text-red-700">Could not load products</p>
          <p className="mt-1 text-sm text-red-500">{error}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Products">
              <caption className="sr-only">{filtered.length} products, sorted by {sortKey} {sortDir}</caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Image</th>
                  <SortTh column="competitor_name" label="Store" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh column="product_name" label="Product" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Size / Pack</th>
                  <SortTh column="price" label="Price" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh column="price_per_100g" label="£/100g" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh column="weight_grams" label="Weight" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">BB match</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)
                  : paginated.length === 0
                    ? <tr><td colSpan={9} className="px-4 py-14 text-center text-slate-400">No products match the current filters</td></tr>
                    : paginated.map((p, i) => (
                      <motion.tr key={p.id}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.018, 0.25), duration: 0.2 }}
                        className={`border-b transition-colors ${p.is_jonny ? 'bg-amber-50 hover:bg-amber-100/70 border-amber-100' : 'border-slate-100 hover:bg-slate-50/70'}`}>
                        <td className="px-4 py-2.5"><ProductImg url={p.image_url} alt="" /></td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {p.is_jonny
                            ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" /><span className="font-bold text-amber-700 text-xs">{p.competitor_name}</span></span>
                            : <span className="text-slate-500 text-xs">{p.competitor_name}</span>}
                        </td>
                        <td className="px-4 py-2.5 max-w-[260px]">
                          <a href={p.product_url} target="_blank" rel="noopener noreferrer"
                            className={`font-medium hover:underline underline-offset-2 focus:outline-none focus:underline ${p.is_jonny ? 'text-amber-800' : 'text-slate-900 hover:text-amber-600'}`}
                            aria-label={`Open ${p.product_name} (new tab)`}>
                            {p.product_name}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[140px] truncate" title={p.variant ?? undefined}>{p.variant ?? <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-2.5 font-mono font-semibold whitespace-nowrap text-slate-800">{fmt(p.price, p.currency)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600 whitespace-nowrap">{fmt(p.price_per_100g, p.currency)}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{p.weight_grams != null ? `${p.weight_grams}g` : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${p.available ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${p.available ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />
                            {p.available ? 'In stock' : 'Out of stock'}
                          </span>
                          {p.price_changed && (
                            <span className="ml-1 inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">↕ Changed</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {p.is_jonny
                            ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-xs font-bold text-amber-700">BB ★</span>
                            : bbCoverage.has(p.id)
                              ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-600">BB ✓</span>
                              : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      </motion.tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
          <p className="text-sm text-slate-400">Page <span className="font-semibold text-slate-600">{page}</span> of <span className="font-semibold text-slate-600">{totalPages}</span></p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setSearchParams(p => { const n = new URLSearchParams(p); n.set('p', String(page - 1)); return n })}
              disabled={page <= 1} aria-label="Previous page"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500">
              ← Prev
            </button>
            {pageNums.map((n, i) => {
              const prev = pageNums[i - 1]
              const gap = prev != null && n - prev > 1
              return (
                <span key={n} className="flex items-center gap-1">
                  {gap && <span className="select-none text-slate-300 px-1" aria-hidden="true">…</span>}
                  <button type="button" onClick={() => setSearchParams(p => { const nx = new URLSearchParams(p); nx.set('p', String(n)); return nx })}
                    aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined}
                    className={`h-8 w-8 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 ${n === page ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {n}
                  </button>
                </span>
              )
            })}
            <button type="button" onClick={() => setSearchParams(p => { const n = new URLSearchParams(p); n.set('p', String(page + 1)); return n })}
              disabled={page >= totalPages} aria-label="Next page"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500">
              Next →
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
