import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { Product } from '../types'
import { fmt, fmtDate, BB_COLOR, COMP_COLOR } from '../types'


const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

interface TipPayload { payload: { name: string; count: number; isJonny: boolean } }
interface TipProps { active?: boolean; payload?: TipPayload[] }
function BarTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <p className={`font-semibold text-sm ${d.isJonny ? 'text-amber-700' : 'text-slate-800'}`}>{d.name}</p>
      <p className="text-slate-600 text-sm mt-0.5">{d.count} change{d.count !== 1 ? 's' : ''}</p>
    </div>
  )
}

function DeltaBadge({ amount, currency }: { amount: number | null; currency: string }) {
  if (amount == null) return <span className="text-slate-300">—</span>
  const up = amount > 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold font-mono tabular-nums ${up ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
      aria-label={`Price ${up ? 'increased' : 'decreased'} by ${fmt(Math.abs(amount), currency)}`}
    >
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      {fmt(Math.abs(amount), currency)}
    </span>
  )
}

export default function Changes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [changes, setChanges] = useState<Product[]>([])
  const [competitors, setCompetitors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const competitor = searchParams.get('c') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('p') ?? '1', 10))
  const PAGE = 30

  useEffect(() => {
    const ac = new AbortController()
    Promise.all([
      fetch(`${API}/price-changes`, { signal: ac.signal }).then(r => r.json() as Promise<Product[]>),
      fetch(`${API}/competitors`, { signal: ac.signal }).then(r => r.json() as Promise<string[]>),
    ]).then(([ch, comps]) => {
      setChanges(ch); setCompetitors(comps); setLoading(false)
    }).catch(err => { if (err.name !== 'AbortError') { setError(String(err.message)); setLoading(false) } })
    return () => ac.abort()
  }, [])

  const filtered = useMemo(() =>
    competitor ? changes.filter(c => c.competitor_name === competitor) : changes
  , [changes, competitor])

  const totalPages = Math.ceil(filtered.length / PAGE)
  const paginated = filtered.slice((page - 1) * PAGE, page * PAGE)

  const chartData = useMemo(() => {
    const map = new Map<string, { count: number; isJonny: boolean }>()
    for (const c of changes) {
      const existing = map.get(c.competitor_name)
      if (existing) existing.count++
      else map.set(c.competitor_name, { count: 1, isJonny: c.is_jonny })
    }
    return [...map.entries()]
      .map(([name, { count, isJonny }]) => ({ name, count, isJonny }))
      .sort((a, b) => b.count - a.count)
  }, [changes])

  const setC = (v: string) => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    if (v) next.set('c', v); else next.delete('c')
    next.delete('p')
    return next
  })
  const setPage = (n: number) => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    if (n === 1) next.delete('p'); else next.set('p', String(n))
    return next
  })

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Price Changes</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {loading ? 'Loading…' : `${filtered.length.toLocaleString()} change${filtered.length !== 1 ? 's' : ''}${competitor ? ` for ${competitor}` : ' detected'}`}
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="comp-filter" className="sr-only">Filter by competitor</label>
        <select id="comp-filter" value={competitor} onChange={e => setC(e.target.value)}
          className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30">
          <option value="">All competitors</option>
          {competitors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16" role="status" aria-label="Loading"><div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-amber-500 animate-spin" /></div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center" role="alert">
          <p className="font-semibold text-red-700">Could not load changes</p>
          <p className="mt-1 text-sm text-red-500">{error}</p>
        </div>
      ) : (
        <>
          {!competitor && chartData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-700 mb-4">Changes by competitor</h2>
              <div role="img" aria-label="Bar chart of price changes per competitor">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-35} textAnchor="end" height={72} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={0} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                    <Tooltip content={<BarTip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={44}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.isJonny ? BB_COLOR : COMP_COLOR} fillOpacity={d.isJonny ? 1 : 0.65} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {paginated.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-slate-400">No price changes{competitor ? ` for ${competitor}` : ''}</p>
            </div>
          ) : (
            <ol className="space-y-3" aria-label="Price changes feed">
              {paginated.map((p, i) => (
                <motion.li key={p.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.25), duration: 0.18 }}>
                  <div className={`rounded-2xl border p-5 shadow-sm ${p.is_jonny ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-white' : 'border-slate-200 bg-white hover:bg-slate-50/60 transition-colors'}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          {p.is_jonny && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">★ Barneys</span>}
                          <span className={`text-xs font-semibold ${p.is_jonny ? 'text-amber-700' : 'text-slate-500'}`}>{p.competitor_name}</span>
                          {p.product_type && <><span className="text-slate-300 select-none">·</span><span className="text-xs text-slate-400">{p.product_type}</span></>}
                        </div>
                        <a href={p.product_url} target="_blank" rel="noopener noreferrer"
                          className={`block font-semibold leading-tight hover:underline underline-offset-2 focus:outline-none focus:underline ${p.is_jonny ? 'text-amber-900' : 'text-slate-900 hover:text-amber-600'}`}
                          aria-label={`Open ${p.product_name} (new tab)`}>
                          {p.product_name}
                        </a>
                        {p.variant && <p className="mt-0.5 text-sm text-slate-400 truncate">{p.variant}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end"
                        aria-label={`Price changed from ${fmt(p.previous_price, p.currency)} to ${fmt(p.price, p.currency)}`}>
                        <div className="text-right">
                          <p className="text-xs text-slate-400 mb-0.5">Was</p>
                          <p className="font-mono text-slate-400 line-through">{fmt(p.previous_price, p.currency)}</p>
                        </div>
                        <span className="text-slate-300 text-lg select-none" aria-hidden="true">→</span>
                        <div className="text-right">
                          <p className="text-xs text-slate-400 mb-0.5">Now</p>
                          <p className={`font-mono font-bold text-lg ${p.is_jonny ? 'text-amber-800' : 'text-slate-800'}`}>{fmt(p.price, p.currency)}</p>
                        </div>
                        <DeltaBadge amount={p.price_change_amount} currency={p.currency} />
                      </div>
                    </div>
                    {p.price_change_date && (
                      <p className="mt-3 text-xs text-slate-400">
                        <time dateTime={p.price_change_date}>Detected {fmtDate(p.price_change_date)}</time>
                      </p>
                    )}
                  </div>
                </motion.li>
              ))}
            </ol>
          )}

          {totalPages > 1 && (
            <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
              <p className="text-sm text-slate-400">Page <span className="font-semibold text-slate-600">{page}</span> of <span className="font-semibold text-slate-600">{totalPages}</span></p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500">← Previous</button>
                <button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages} aria-label="Next page"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500">Next →</button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
