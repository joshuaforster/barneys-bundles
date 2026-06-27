import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Product, CompetitorLogo } from '../types'
import { BB_NAME, fmt } from '../types'

const API = 'http://127.0.0.1:8000'

function nameToHsl(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return `hsl(${h},55%,45%)`
}

function CompetitorBadge({ name, logos, size = 32 }: { name: string; logos: Record<string, CompetitorLogo>; size?: number }) {
  const logo = logos[name]
  if (logo?.logo_url) {
    return <img src={logo.logo_url} alt={name} style={{ width: size, height: size }} className="rounded-full object-contain border border-slate-200 bg-white" />
  }
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span style={{ width: size, height: size, background: nameToHsl(name), fontSize: size * 0.38 }}
      className="inline-flex items-center justify-center rounded-full font-bold text-white select-none shrink-0">
      {initials}
    </span>
  )
}

function NoteEditor({ name, initial, onSave }: { name: string; initial: string; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(initial)
  const [saved, setSaved] = useState(false)
  const dirty = notes !== initial

  useEffect(() => { setNotes(initial) }, [initial])

  const save = useCallback(() => {
    onSave(notes)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [notes, onSave])

  return (
    <div className="space-y-2">
      <label htmlFor={`notes-${name}`} className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes on {name}</label>
      <textarea id={`notes-${name}`} value={notes} onChange={e => { setNotes(e.target.value); setSaved(false) }}
        placeholder={`Jot down anything about ${name} — pricing strategy, standout products, strengths, weaknesses…`}
        rows={5}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none" />
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={!dirty}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">
          Save notes
        </button>
        {saved && <span className="text-sm font-semibold text-emerald-600">✓ Saved</span>}
        {dirty && !saved && <span className="text-xs text-slate-400">Unsaved changes</span>}
      </div>
    </div>
  )
}

interface CompetitorStats {
  name: string
  count: number
  minPrice: number | null
  avgPrice: number | null
  categories: string[]
  products: Product[]
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-center">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="font-bold text-sm text-slate-800 font-mono">{value}</p>
    </div>
  )
}

function CompetitorCard({ stats, notes, logos, onSaveNotes }: {
  stats: CompetitorStats
  notes: string
  logos: Record<string, CompetitorLogo>
  onSaveNotes: (notes: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [catFilter, setCatFilter] = useState('')
  const visibleProducts = catFilter
    ? stats.products.filter(p => (p.product_type ?? '') === catFilter)
    : stats.products.slice(0, open ? 40 : 0)

  return (
    <motion.div layout className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-5 cursor-pointer hover:bg-slate-50/60 transition-colors"
        onClick={() => setOpen(o => !o)}>
        <CompetitorBadge name={stats.name} logos={logos} size={44} />
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-900 text-base truncate">{stats.name}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{stats.count.toLocaleString()} products · {stats.categories.length} categories</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:grid grid-cols-2 gap-2">
            <StatPill label="Cheapest" value={stats.minPrice != null ? fmt(stats.minPrice) : '—'} />
            <StatPill label="Avg price" value={stats.avgPrice != null ? fmt(stats.avgPrice) : '—'} />
          </div>
          <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-slate-400 text-sm font-bold select-none" aria-hidden="true">▶</motion.span>
        </div>
      </div>

      {/* Expanded body */}
      <AnimatePresence>
        {open && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="border-t border-slate-100 p-5 space-y-5">
              {/* Notes */}
              <NoteEditor name={stats.name} initial={notes} onSave={onSaveNotes} />

              {/* Category filter pills */}
              {stats.categories.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Browse by category</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setCatFilter('')}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${!catFilter ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                      All
                    </button>
                    {stats.categories.map(cat => (
                      <button key={cat} type="button" onClick={() => setCatFilter(c => c === cat ? '' : cat)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${catFilter === cat ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Products list */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {catFilter ? `${visibleProducts.length} in "${catFilter}"` : `${Math.min(40, stats.count)} of ${stats.count} products`}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(catFilter ? visibleProducts : stats.products.slice(0, 24)).map(p => (
                    <a key={p.id} href={p.product_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:border-amber-200 hover:bg-amber-50/40 transition-colors group">
                      {p.image_url
                        ? <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover border border-slate-100 shrink-0" />
                        : <div className="h-10 w-10 rounded-lg bg-slate-100 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-amber-700">{p.product_name}</p>
                        {p.variant && <p className="text-xs text-slate-400 truncate">{p.variant}</p>}
                        <p className="text-xs font-mono text-slate-600 mt-0.5">{fmt(p.price, p.currency)}</p>
                      </div>
                    </a>
                  ))}
                </div>
                {!catFilter && stats.count > 24 && (
                  <p className="text-xs text-slate-400 text-center pt-1">+ {stats.count - 24} more — use Compare to explore all</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Competitors() {
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [logos, setLogos] = useState<Record<string, CompetitorLogo>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ac = new AbortController()
    Promise.all([
      fetch(`${API}/products`, { signal: ac.signal }).then(r => r.json() as Promise<Product[]>),
      fetch(`${API}/competitors/logos`, { signal: ac.signal }).then(r => r.json() as Promise<Record<string, CompetitorLogo>>),
      fetch(`${API}/competitor-notes`, { signal: ac.signal }).then(r => r.json() as Promise<Record<string, { notes: string }>>),
    ]).then(([prods, lg, n]) => {
      setAllProducts(prods)
      setLogos(lg)
      setNotes(Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v.notes])))
      setLoading(false)
    }).catch(() => setLoading(false))
    return () => ac.abort()
  }, [])

  const stats: CompetitorStats[] = useMemo(() => {
    const map = new Map<string, CompetitorStats>()
    for (const p of allProducts) {
      if (p.competitor_name === BB_NAME) continue
      let s = map.get(p.competitor_name)
      if (!s) {
        s = { name: p.competitor_name, count: 0, minPrice: null, avgPrice: null, categories: [], products: [] }
        map.set(p.competitor_name, s)
      }
      s.count++
      s.products.push(p)
      if (p.price != null) {
        s.minPrice = s.minPrice == null ? p.price : Math.min(s.minPrice, p.price)
      }
      if (p.product_type && !s.categories.includes(p.product_type)) s.categories.push(p.product_type)
    }
    for (const s of map.values()) {
      const prices = s.products.map(p => p.price).filter((x): x is number => x != null)
      s.avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
      s.categories.sort()
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [allProducts])

  const saveNotes = useCallback(async (name: string, text: string) => {
    setNotes(prev => ({ ...prev, [name]: text }))
    await fetch(`${API}/competitor-notes/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: text }),
    })
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Competitors</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {loading ? 'Loading…' : `${stats.length} competitor stores tracked`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20" role="status" aria-label="Loading">
          <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-amber-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {stats.map(s => (
            <CompetitorCard key={s.name} stats={s} notes={notes[s.name] ?? ''} logos={logos}
              onSaveNotes={text => saveNotes(s.name, text)} />
          ))}
        </div>
      )}
    </div>
  )
}
