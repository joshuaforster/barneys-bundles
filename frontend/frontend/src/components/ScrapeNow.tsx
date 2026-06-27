import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const API = 'http://127.0.0.1:8000'

const DOG_FACTS = [
  '🐾 Dogs have a sense of smell 40x stronger than humans',
  '🦴 A dog\'s nose print is unique — like a human fingerprint',
  '🐕 The Basenji is the only dog that can\'t bark — it yodels instead',
  '🌙 Dogs dream just like us — watch for those little leg twitches',
  '💓 A dog\'s heart beats 60–140 times per minute',
  '🐶 Puppies are born blind, deaf, and toothless',
  '🏃 Greyhounds can run up to 45 mph — faster than a horse over short distances',
  '🦷 Dogs have 42 adult teeth compared to our 32',
  '👃 Dogs can smell cancer, low blood sugar, and even fear',
  '💤 Dogs spend about 50% of the day sleeping',
  '🐩 Poodles don\'t shed — perfect for allergy sufferers',
  '🧠 Border Collies are considered the most intelligent dog breed',
  '🌍 There are an estimated 900 million dogs in the world',
  '🐾 A group of pugs is called a grumble',
  '❤️ Stroking a dog lowers your blood pressure — science says so',
  '🦴 Natural dog treats are better for teeth than most dental sticks',
  '🐕 Dogs can understand up to 250 words and gestures',
  '🌟 Dalmatians are born completely white — spots appear later',
  '🎾 Dogs have a "play bow" to invite other dogs to play',
  '🐾 Barneys Bundles makes treats dogs actually go wild for!',
]

// Confetti particle component
function ConfettiPiece({ x, color, delay }: { x: number; color: string; delay: number }) {
  const startY = -20
  const endY = typeof window !== 'undefined' ? window.innerHeight + 40 : 900
  const drift = (Math.random() - 0.5) * 200
  return (
    <motion.div
      initial={{ x, y: startY, rotate: 0, opacity: 1 }}
      animate={{ x: x + drift, y: endY, rotate: 720, opacity: 0 }}
      transition={{ duration: 3.5, delay, ease: 'easeIn' }}
      style={{ position: 'fixed', top: 0, left: 0, width: 10, height: 10, borderRadius: 2, background: color, pointerEvents: 'none', zIndex: 9999 }}
    />
  )
}

function Confetti({ active }: { active: boolean }) {
  const pieces = useRef<{ id: number; x: number; color: string; delay: number }[]>([])
  if (active && pieces.current.length === 0) {
    const colors = ['#f59e0b', '#10b981', '#6366f1', '#f43f5e', '#06b6d4', '#8b5cf6', '#ffffff']
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200
    pieces.current = Array.from({ length: 120 }, (_, i) => ({
      id: i,
      x: Math.random() * w,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 1.2,
    }))
  }
  if (!active) { pieces.current = []; return null }
  return (
    <>
      {pieces.current.map(p => <ConfettiPiece key={p.id} x={p.x} color={p.color} delay={p.delay} />)}
    </>
  )
}

interface ScrapeStatus {
  last_scraped_at: string | null
  last_rows: number
  last_changes: number
  can_scrape_now: boolean
  is_running: boolean
  next_allowed_in_seconds: number
}

function fmtTime(iso: string | null) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const now = Date.now()
  const diff = Math.round((now - d.getTime()) / 60000)
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtCountdown(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function ScrapeNow() {
  const [status, setStatus] = useState<ScrapeStatus | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [fact, setFact] = useState(DOG_FACTS[0])
  const [factIndex, setFactIndex] = useState(0)
  const [confetti, setConfetti] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const factTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(() => {
    fetch(`${API}/scrape/status`)
      .then(r => r.json() as Promise<ScrapeStatus>)
      .then(s => {
        setStatus(s)
        setCountdown(s.next_allowed_in_seconds)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchStatus()
    const t = setInterval(fetchStatus, 15000)
    return () => clearInterval(t)
  }, [fetchStatus])

  // Countdown ticker
  useEffect(() => {
    if (countdown <= 0) { if (countdownTimer.current) clearInterval(countdownTimer.current); return }
    countdownTimer.current = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => { if (countdownTimer.current) clearInterval(countdownTimer.current) }
  }, [countdown])

  // Cycle dog facts while scraping
  useEffect(() => {
    if (!status?.is_running) { if (factTimer.current) clearTimeout(factTimer.current); return }
    factTimer.current = setTimeout(() => {
      setFactIndex(i => {
        const next = (i + 1) % DOG_FACTS.length
        setFact(DOG_FACTS[next])
        return next
      })
    }, 3500)
    return () => { if (factTimer.current) clearTimeout(factTimer.current) }
  }, [status?.is_running, factIndex])

  const handleScrape = useCallback(async () => {
    if (!status?.can_scrape_now) return
    setFact(DOG_FACTS[0])
    setFactIndex(0)
    // Optimistically mark as running
    setStatus(prev => prev ? { ...prev, is_running: true, can_scrape_now: false } : prev)
    try {
      const res = await fetch(`${API}/scrape`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as { rows: number; changes: number; scraped_at: string }
        setStatus({
          last_scraped_at: data.scraped_at,
          last_rows: data.rows,
          last_changes: data.changes,
          can_scrape_now: false,
          is_running: false,
          next_allowed_in_seconds: 3600,
        })
        setCountdown(3600)
        setConfetti(true)
        setTimeout(() => setConfetti(false), 5000)
      } else {
        fetchStatus()
      }
    } catch {
      fetchStatus()
    }
  }, [status, fetchStatus])

  const running = status?.is_running ?? false
  const canScrape = status?.can_scrape_now ?? false

  return (
    <>
      <Confetti active={confetti} />

      {/* Compact sidebar trigger */}
      <div className="px-3 pb-4">
        <button type="button" onClick={() => setIsOpen(true)}
          className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${running ? 'bg-amber-500/20 text-amber-300 animate-pulse' : canScrape ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-400' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
          {/* Chew toy / bone icon */}
          <span className="text-lg select-none" aria-hidden="true">{running ? '🐾' : '🦴'}</span>
          <span className="flex-1 text-left truncate">
            {running ? 'Scraping…' : canScrape ? 'Scrape Now' : 'Scrape Now'}
          </span>
          {status?.last_scraped_at && !running && (
            <span className="text-[10px] font-normal opacity-70 shrink-0">{fmtTime(status.last_scraped_at)}</span>
          )}
        </button>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => { if (!running) setIsOpen(false) }} aria-hidden="true" />

            <motion.div initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl pointer-events-auto overflow-hidden">

                {/* Header with bone */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 px-6 pt-7 pb-5 text-center border-b border-amber-100">
                  <motion.div
                    animate={running ? { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.1, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                    className="text-5xl mb-3 select-none" aria-hidden="true">
                    🦴
                  </motion.div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {running ? 'Fetching treats…' : 'Scrape competitor prices'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {running ? 'Sniffing out the best prices across the web' : 'Fetch the latest prices from all competitor stores'}
                  </p>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                  {/* Last scraped info */}
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Last scraped</span>
                      <span className="font-semibold text-slate-800">
                        {status?.last_scraped_at ? new Date(status.last_scraped_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                      </span>
                    </div>
                    {status?.last_rows ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Products found</span>
                        <span className="font-semibold text-slate-800">{status.last_rows.toLocaleString()}</span>
                      </div>
                    ) : null}
                    {status?.last_changes != null && status.last_changes > 0 ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Price changes</span>
                        <span className="font-semibold text-blue-700">{status.last_changes} detected</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Running state — dog fact */}
                  <AnimatePresence mode="wait">
                    {running && (
                      <motion.div key={fact} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">Did you know?</p>
                        <p className="text-sm text-amber-900 font-medium">{fact}</p>
                      </motion.div>
                    )}
                    {!running && !canScrape && countdown > 0 && (
                      <motion.div key="cooldown" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                        <p className="text-xs text-slate-400 mb-1">Next scrape available in</p>
                        <p className="text-2xl font-bold font-mono text-slate-700">{fmtCountdown(countdown)}</p>
                        <p className="text-xs text-slate-400 mt-1">Rate limited to once per hour</p>
                      </motion.div>
                    )}
                    {!running && canScrape && (
                      <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                        <p className="text-sm font-semibold text-emerald-700">Ready to fetch! 🐕</p>
                        <p className="text-xs text-emerald-600 mt-0.5">This usually takes 1–2 minutes</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    {!running && (
                      <button type="button" onClick={() => setIsOpen(false)}
                        className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-slate-400">
                        Close
                      </button>
                    )}
                    <button type="button" onClick={handleScrape} disabled={!canScrape || running}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 ${canScrape && !running ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-400' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                      {running ? (
                        <>
                          <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
                          Sniffing…
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true">🦴</span>
                          {canScrape ? 'Fetch prices!' : 'On cooldown'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
