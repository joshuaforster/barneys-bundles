import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { Bookmark } from '../types'
import { fmtDate } from '../types'

const API = 'http://127.0.0.1:8000'

function CompetitorBadge({ name }: { name: string }) {
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white select-none"
      style={{ backgroundColor: `hsl(${hue},55%,42%)` }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}

function NoteEditor({ bookmark, onSave }: { bookmark: Bookmark; onSave: (id: string, notes: string) => Promise<void> }) {
  const [notes, setNotes] = useState(bookmark.notes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty = notes !== bookmark.notes

  async function save() {
    setSaving(true)
    await onSave(bookmark.id, notes)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="mt-3">
      <label htmlFor={`notes-${bookmark.id}`} className="block text-xs font-semibold text-slate-400 mb-1.5">Notes</label>
      <textarea
        id={`notes-${bookmark.id}`}
        value={notes}
        onChange={e => { setNotes(e.target.value); setSaved(false) }}
        rows={3}
        placeholder="Add notes about this product…"
        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          {bookmark.updated_at ? `Last updated ${fmtDate(bookmark.updated_at)}` : 'Not yet saved'}
        </p>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs font-semibold text-emerald-600">✓ Saved</span>}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
          >
            {saving ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Saved() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    fetch(`${API}/bookmarks`, { signal: ac.signal })
      .then(r => r.json() as Promise<Bookmark[]>)
      .then(data => { setBookmarks(data); setLoading(false) })
      .catch(err => { if (err.name !== 'AbortError') { setError(String(err.message)); setLoading(false) } })
    return () => ac.abort()
  }, [])

  const saveNotes = useCallback(async (id: string, notes: string) => {
    const updated = await fetch(`${API}/bookmarks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    }).then(r => r.json() as Promise<Bookmark>)
    setBookmarks(prev => prev.map(b => b.id === id ? updated : b))
  }, [])

  const deleteBookmark = useCallback(async (id: string) => {
    setDeletingId(id)
    await fetch(`${API}/bookmarks/${id}`, { method: 'DELETE' })
    setBookmarks(prev => prev.filter(b => b.id !== id))
    setDeletingId(null)
  }, [])

  // Group by competitor
  const byCompetitor = bookmarks.reduce<Record<string, Bookmark[]>>((acc, b) => {
    const key = b.competitor_name
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Saved</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {loading ? 'Loading…' : `${bookmarks.length} saved product${bookmarks.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16" role="status" aria-label="Loading">
          <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-amber-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center" role="alert">
          <p className="font-semibold text-red-700">Could not load bookmarks</p>
          <p className="mt-1 text-sm text-red-500">{error}</p>
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-12 w-12 text-slate-300 mb-4" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-slate-500 font-semibold">Nothing saved yet</p>
          <p className="text-slate-400 text-sm mt-1">Use the bookmark button on the Compare page to save products</p>
          <Link to="/compare" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-amber-600 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">
            Go to Compare
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byCompetitor).map(([competitor, items]) => (
            <motion.section key={competitor} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              aria-labelledby={`comp-${competitor}`}>
              <div className="flex items-center gap-2 mb-3">
                <CompetitorBadge name={competitor} />
                <h2 id={`comp-${competitor}`} className="text-sm font-bold text-slate-700">{competitor}</h2>
                <span className="text-xs text-slate-400">{items.length} saved</span>
              </div>
              <div className="space-y-3">
                <AnimatePresence>
                  {items.map(bm => (
                    <motion.div key={bm.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8, scale: 0.97 }}
                      className={`rounded-2xl border p-5 shadow-sm ${bm.competitor_name === 'Barneys Bundles' ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-white' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {bm.competitor_name === 'Barneys Bundles' && (
                              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">★ Yours</span>
                            )}
                            <span className="text-xs text-slate-400">{bm.competitor_name}</span>
                          </div>
                          <Link
                            to={`/compare?q=${encodeURIComponent(bm.product_name)}`}
                            className="block font-semibold text-slate-900 hover:text-amber-700 hover:underline underline-offset-2 focus:outline-none focus:underline"
                          >
                            {bm.product_name}
                          </Link>
                          {bm.variant && <p className="mt-0.5 text-sm text-slate-400">{bm.variant}</p>}
                          <p className="mt-1 text-xs text-slate-400">
                            Saved {fmtDate(bm.created_at)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteBookmark(bm.id)}
                          disabled={deletingId === bm.id}
                          aria-label={`Remove ${bm.product_name} from saved`}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-red-400"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                      <NoteEditor bookmark={bm} onSave={saveNotes} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  )
}
