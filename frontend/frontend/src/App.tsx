import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Products from './pages/Products'
import Compare from './pages/Compare'
import Changes from './pages/Changes'
import Insights from './pages/Insights'
import Saved from './pages/Saved'
import Competitors from './pages/Competitors'
import ScrapeNow from './components/ScrapeNow'

function IconProducts() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
function IconCompare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5" aria-hidden="true">
      <path d="M7 16l-4-4 4-4M17 8l4 4-4 4" /><line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  )
}
function IconChanges() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5" aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  )
}
function IconInsights() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5" aria-hidden="true">
      <path d="M2 20h20M6 20V10M12 20V4M18 20v-8" />
    </svg>
  )
}
function IconSaved() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function IconCompetitors() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5" aria-hidden="true">
      <circle cx="9" cy="7" r="4" /><circle cx="17" cy="11" r="3" />
      <path d="M1 21v-2a7 7 0 0 1 11.95-4.95" /><path d="M16 21v-2a4 4 0 0 1 4-4h1" />
    </svg>
  )
}

const NAV = [
  { to: '/', label: 'Products', icon: <IconProducts /> },
  { to: '/compare', label: 'Compare', icon: <IconCompare /> },
  { to: '/changes', label: 'Changes', icon: <IconChanges /> },
  { to: '/insights', label: 'Insights', icon: <IconInsights /> },
  { to: '/competitors', label: 'Competitors', icon: <IconCompetitors /> },
  { to: '/saved', label: 'Saved', icon: <IconSaved /> },
] as const

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-inset ${
      isActive
        ? 'bg-amber-500/15 text-amber-400 shadow-sm'
        : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
    }`

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <motion.aside
        id="sidebar"
        initial={false}
        animate={{ x: open ? 0 : undefined }}
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-950 border-r border-slate-800/60
          transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
        aria-label="Main navigation"
      >
        {/* Brand — larger logo */}
        <div className="flex flex-col items-center gap-3 px-5 py-6 border-b border-slate-800/60">
          <img
            src="/BarneysBundlesLogo.webp"
            alt="Barney's Bundles"
            className="h-20 w-20 rounded-2xl object-contain shadow-lg shadow-black/30"
          />
          <div className="text-center leading-tight">
            <p className="text-white font-bold text-sm tracking-tight">Barney's Bundles</p>
            <p className="text-slate-500 text-xs mt-0.5">Intelligence</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Pages">
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkClass} onClick={onClose}>
              {icon}
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Scrape button */}
        <div className="border-t border-slate-800/60 pt-3">
          <ScrapeNow />
        </div>
      </motion.aside>
    </>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <Routes location={location}>
          <Route path="/" element={<Products />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/changes" element={<Changes />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/competitors" element={<Competitors />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <BrowserRouter>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-72 focus:z-[100] focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to main content
      </a>

      <div className="flex min-h-screen bg-slate-50">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex min-h-screen flex-1 flex-col md:pl-64">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 backdrop-blur-sm px-4 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              aria-expanded={sidebarOpen ? 'true' : 'false'}
              aria-controls="sidebar"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <img src="/BarneysBundlesLogo.webp" alt="" className="h-7 w-7 rounded-lg object-contain" aria-hidden="true" />
            <span className="font-bold text-slate-900 text-sm">Barney's Bundles</span>
          </header>

          <main id="main-content" className="flex-1 p-5 lg:p-8">
            <AnimatedRoutes />
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
