import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import type { Product } from '../types'
import { fmt, BB_NAME, BB_COLOR, COMP_COLOR } from '../types'
import { jaccard, MIN_SCORE } from '../lib/similarity'

const API = 'http://127.0.0.1:8000'

const PIE_COLORS = [
  '#f59e0b', '#6366f1', '#10b981', '#f43f5e', '#3b82f6',
  '#8b5cf6', '#06b6d4', '#a3e635', '#fb923c', '#e879f9',
]

interface StatCardProps { label: string; value: string | number; sub?: string; accent?: boolean; delay?: number }
function StatCard({ label, value, sub, accent, delay = 0 }: StatCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className={`rounded-2xl border p-5 shadow-sm ${accent ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-white' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-3xl font-black tabular-nums ${accent ? 'text-amber-700' : 'text-slate-800'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </motion.div>
  )
}

interface PiePayload { name: string; value: number; payload?: { percent?: number } }
interface PieTipProps { active?: boolean; payload?: { payload: PiePayload }[] }
function PieTip({ active, payload }: PieTipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <p className="font-semibold text-slate-800 text-sm">{d.name}</p>
      <p className="text-slate-600 text-sm">{d.value.toLocaleString()} products</p>
    </div>
  )
}

interface BarTipPayload { competitor: string; count: number; isJonny: boolean }
interface BarTipProps { active?: boolean; payload?: { payload: BarTipPayload }[] }
function BarTip({ active, payload }: BarTipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <p className={`font-semibold text-sm ${d.isJonny ? 'text-amber-700' : 'text-slate-800'}`}>{d.competitor}</p>
      <p className="text-slate-600 text-sm mt-0.5">{d.count.toLocaleString()} products</p>
    </div>
  )
}

export default function Insights() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    fetch(`${API}/products`, { signal: ac.signal })
      .then(r => r.json() as Promise<Product[]>)
      .then(data => { setProducts(data); setLoading(false) })
      .catch(err => { if (err.name !== 'AbortError') { setError(String(err.message)); setLoading(false) } })
    return () => ac.abort()
  }, [])

  const stats = useMemo(() => {
    const competitors = new Set(products.filter(p => !p.is_jonny).map(p => p.competitor_name))
    const jonny = products.filter(p => p.is_jonny)
    const priceChanges = products.filter(p => p.price_changed)
    return {
      totalCompetitors: competitors.size,
      totalProducts: products.length,
      totalChanges: priceChanges.length,
      barneysProducts: jonny.length,
    }
  }, [products])

  // Products per competitor bar chart
  const byCompetitor = useMemo(() => {
    const map = new Map<string, { count: number; isJonny: boolean }>()
    for (const p of products) {
      const ex = map.get(p.competitor_name)
      if (ex) ex.count++
      else map.set(p.competitor_name, { count: 1, isJonny: p.is_jonny })
    }
    return [...map.entries()]
      .map(([competitor, { count, isJonny }]) => ({ competitor, count, isJonny }))
      .sort((a, b) => b.count - a.count)
  }, [products])

  // Product type pie
  const byType = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      const t = p.product_type ?? 'Uncategorised'
      map.set(t, (map.get(t) ?? 0) + 1)
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [products])

  // Barneys most expensive vs market median
  const barneysExpensive = useMemo(() => {
    const jonny = products.filter(p => p.is_jonny && p.price_per_100g != null)
    return jonny
      .map(j => {
        const peers = products.filter(
          p => !p.is_jonny && p.price_per_100g != null &&
               jaccard(j.product_name, p.product_name) >= MIN_SCORE
        )
        if (!peers.length) return null
        const avgComp = peers.reduce((s, p) => s + p.price_per_100g!, 0) / peers.length
        const diff = j.price_per_100g! - avgComp
        return { product: j, diff, avgComp, peerCount: peers.length }
      })
      .filter((x): x is NonNullable<typeof x> => x != null && x.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 5)
  }, [products])

  // Barneys best value
  const barneysValue = useMemo(() => {
    const jonny = products.filter(p => p.is_jonny && p.price_per_100g != null)
    return jonny
      .map(j => {
        const peers = products.filter(
          p => !p.is_jonny && p.price_per_100g != null &&
               jaccard(j.product_name, p.product_name) >= MIN_SCORE
        )
        if (!peers.length) return null
        const avgComp = peers.reduce((s, p) => s + p.price_per_100g!, 0) / peers.length
        const diff = j.price_per_100g! - avgComp
        return { product: j, diff, avgComp, peerCount: peers.length }
      })
      .filter((x): x is NonNullable<typeof x> => x != null && x.diff < 0)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 5)
  }, [products])

  // Biggest price drops (across all competitors)
  const biggestDrops = useMemo(() =>
    products
      .filter(p => p.price_changed && p.price_change_amount != null && p.price_change_amount < 0)
      .sort((a, b) => (a.price_change_amount ?? 0) - (b.price_change_amount ?? 0))
      .slice(0, 8)
  , [products])

  if (loading) return (
    <div className="flex justify-center py-24" role="status" aria-label="Loading">
      <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-amber-500 animate-spin" />
    </div>
  )

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center" role="alert">
      <p className="font-semibold text-red-700">Could not load data</p>
      <p className="mt-1 text-sm text-red-500">{error}</p>
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Insights</h1>
        <p className="mt-0.5 text-sm text-slate-500">Market overview for Barney's Bundles</p>
      </div>

      {/* Stat cards */}
      <section aria-label="Summary statistics">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Competitors tracked" value={stats.totalCompetitors} delay={0} />
          <StatCard label="Total products" value={stats.totalProducts.toLocaleString()} sub="all variants" delay={0.05} />
          <StatCard label="Price changes" value={stats.totalChanges.toLocaleString()} sub="detected this run" delay={0.1} />
          <StatCard label="Barneys products" value={stats.barneysProducts} accent delay={0.15} />
        </div>
      </section>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Products by competitor bar chart */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          aria-labelledby="by-competitor-heading"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="by-competitor-heading" className="text-sm font-bold text-slate-700 mb-4">Products per store</h2>
          <div role="img" aria-label="Bar chart showing product count per competitor">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byCompetitor} margin={{ top: 4, right: 8, left: 0, bottom: 64 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="competitor" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-35} textAnchor="end" height={76} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                <Tooltip content={<BarTip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={44}>
                  {byCompetitor.map((d, i) => <Cell key={i} fill={d.isJonny ? BB_COLOR : COMP_COLOR} fillOpacity={d.isJonny ? 1 : 0.6} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-5 mt-1">
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-3 w-3 rounded-sm shrink-0 bg-amber-500" aria-hidden="true" />{BB_NAME}</span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-3 w-3 rounded-sm shrink-0 bg-indigo-500/60" aria-hidden="true" />Competitors</span>
          </div>
        </motion.section>

        {/* Product type pie chart */}
        {byType.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            aria-labelledby="by-type-heading"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 id="by-type-heading" className="text-sm font-bold text-slate-700 mb-4">Product types</h2>
            <div role="img" aria-label="Pie chart showing product distribution by type">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="45%"
                    outerRadius={90} paddingAngle={2}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${(name ?? '').length > 14 ? (name ?? '').slice(0, 13) + '…' : (name ?? '')} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}>
                    {byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.section>
        )}
      </div>

      {/* Analysis lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Barneys most expensive vs market */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
          aria-labelledby="expensive-heading"
          className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <h2 id="expensive-heading" className="text-sm font-bold text-slate-700 mb-1">Where Barneys is most expensive</h2>
          <p className="text-xs text-slate-400 mb-4">vs average competitor £/100g</p>
          {barneysExpensive.length === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">None — Barneys leads on price everywhere with matching products!</p>
          ) : (
            <ol className="space-y-3">
              {barneysExpensive.map(({ product, diff, avgComp }, i) => (
                <motion.li key={product.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <Link to={`/compare?pid=${product.id}`} className="text-sm font-semibold text-slate-800 hover:text-amber-600 hover:underline underline-offset-2 truncate block focus:outline-none focus:underline">
                      {product.product_name}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Barneys: <span className="font-mono font-semibold text-amber-700">{fmt(product.price_per_100g)}/100g</span>
                      {' · '}Competitors avg: <span className="font-mono">{fmt(avgComp)}/100g</span>
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-bold text-red-600 font-mono">+{fmt(diff)}</span>
                </motion.li>
              ))}
            </ol>
          )}
        </motion.section>

        {/* Barneys best value */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          aria-labelledby="value-heading"
          className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h2 id="value-heading" className="text-sm font-bold text-slate-700 mb-1">Where Barneys has best value</h2>
          <p className="text-xs text-slate-400 mb-4">cheapest vs average competitor £/100g</p>
          {barneysValue.length === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">No matching products found with competitor comparisons yet</p>
          ) : (
            <ol className="space-y-3">
              {barneysValue.map(({ product, diff, avgComp }, i) => (
                <motion.li key={product.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.34 + i * 0.05 }}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <Link to={`/compare?pid=${product.id}`} className="text-sm font-semibold text-slate-800 hover:text-amber-600 hover:underline underline-offset-2 truncate block focus:outline-none focus:underline">
                      {product.product_name}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Barneys: <span className="font-mono font-semibold text-amber-700">{fmt(product.price_per_100g)}/100g</span>
                      {' · '}Competitors avg: <span className="font-mono">{fmt(avgComp)}/100g</span>
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700 font-mono">{fmt(diff)}</span>
                </motion.li>
              ))}
            </ol>
          )}
        </motion.section>
      </div>

      {/* Biggest price drops */}
      {biggestDrops.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
          aria-labelledby="drops-heading"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="drops-heading" className="text-sm font-bold text-slate-700 mb-4">Biggest price drops this run</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Biggest price drops">
              <thead>
                <tr className="border-b border-slate-100">
                  <th scope="col" className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Product</th>
                  <th scope="col" className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Competitor</th>
                  <th scope="col" className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Was</th>
                  <th scope="col" className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Now</th>
                  <th scope="col" className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Drop</th>
                </tr>
              </thead>
              <tbody>
                {biggestDrops.map((p, i) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 + i * 0.04 }}
                    className={`border-b border-slate-50 ${p.is_jonny ? 'bg-amber-50/40' : ''}`}>
                    <td className="py-2.5 pr-4">
                      <a href={p.product_url} target="_blank" rel="noopener noreferrer"
                        className="hover:text-amber-600 hover:underline underline-offset-2 font-medium text-slate-800 focus:outline-none focus:underline truncate block max-w-[200px]"
                        aria-label={`Open ${p.product_name} (new tab)`}>
                        {p.product_name}
                      </a>
                      {p.variant && <span className="text-xs text-slate-400">{p.variant}</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">
                      {p.is_jonny
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">★ Barneys</span>
                        : p.competitor_name}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-400 line-through">{fmt(p.previous_price, p.currency)}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-800">{fmt(p.price, p.currency)}</td>
                    <td className="py-2.5 pl-2 text-right">
                      <span className="font-mono font-bold text-emerald-600">▼ {fmt(Math.abs(p.price_change_amount!), p.currency)}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>
      )}
    </div>
  )
}
