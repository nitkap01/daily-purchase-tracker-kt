import { useCallback, useEffect, useState } from 'react'
import { Activity, BarChart2, Calendar, ClipboardList, CreditCard, Eye, EyeOff, Layers, MessageCircle, Moon, PiggyBank, RefreshCw, Search, ShoppingCart, Sun } from 'lucide-react'
import DateView from './components/DateView'
import SearchView from './components/SearchView'
import InventoryView from './components/InventoryView'
import CashView from './components/CashView'
import StatusView from './components/StatusView'
import ChatView from './components/ChatView'
import OrderView from './components/OrderView'
import BuyerAnalyticsView from './components/BuyerAnalyticsView'
import PaymentsView from './components/PaymentsView'
import ChequesView from './components/ChequesView'
import { exportCsv, getHealth, refreshData } from './api'
import type { HealthData } from './types'
import { APP_VERSION } from './version'

type Tab = 'date' | 'search' | 'inventory' | 'cash' | 'order' | 'analytics' | 'payments' | 'cheques' | 'status' | 'chat'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'analytics', label: 'Buyers', icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'date', label: 'By Date', icon: <Calendar className="w-4 h-4" /> },
  { id: 'search', label: 'Search', icon: <Search className="w-4 h-4" /> },
  { id: 'inventory', label: 'Inventory', icon: <Layers className="w-4 h-4" /> },
  { id: 'cash', label: 'Cash', icon: <PiggyBank className="w-4 h-4" /> },
  { id: 'order', label: 'Orders', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'cheques', label: 'Cheques', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'status', label: 'Status', icon: <Activity className="w-4 h-4" /> },
  { id: 'chat', label: 'AI Chat', icon: <MessageCircle className="w-4 h-4" /> },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('analytics')
  const [health, setHealth] = useState<HealthData | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [showMargins, setShowMargins] = useState(() => {
    return localStorage.getItem('showMargins') !== 'false'
  })
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  useEffect(() => {
    localStorage.setItem('showMargins', showMargins ? 'true' : 'false')
  }, [showMargins])

  const loadHealth = useCallback(async () => {
    try {
      const data = await getHealth()
      setHealth(data)
    } catch {
      // silently fail — app still works without health status
    }
  }, [])

  useEffect(() => {
    loadHealth()
  }, [loadHealth])

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const result = await refreshData()
      setRefreshMsg(`Refreshed — ${result.rows} rows`)
      await loadHealth()
    } catch {
      setRefreshMsg('Refresh failed. Please try again.')
    } finally {
      setRefreshing(false)
      setTimeout(() => setRefreshMsg(null), 4000)
    }
  }

  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const blob = await exportCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kapoor_traders_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // silently ignore — user sees no state change
    } finally {
      setExporting(false)
    }
  }

  const formatRefresh = (iso: string | null): string => {
    if (!iso) return 'Never'
    const d = new Date(iso)  // ISO already has timezone offset from Python
    return isNaN(d.getTime()) ? iso : d.toLocaleString()
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Brand — click to go home */}
          <button
            onClick={() => setActiveTab('analytics')}
            className="flex items-center gap-2.5 min-w-0 text-left active:opacity-70 transition-opacity"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-gray-900 text-sm sm:text-base leading-tight">
                Kapoor Traders CMS
              </h1>
              <p className="text-xs text-gray-400 leading-tight truncate">
                {health?.last_refreshed
                  ? `Updated ${formatRefresh(health.last_refreshed)}`
                  : `v${APP_VERSION}`}
              </p>
            </div>
          </button>

          {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {refreshMsg && (
                <span className="text-xs text-indigo-600 font-medium hidden sm:block max-w-[180px] truncate">
                  {refreshMsg}
                </span>
              )}
              {/* Eye toggle — show/hide margins */}
              <button
                onClick={() => setShowMargins((v) => !v)}
                title={showMargins ? 'Hide margins & selling prices' : 'Show margins & selling prices'}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors active:scale-95 ${
                  showMargins
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    : 'border-slate-200 bg-slate-50 text-gray-400 hover:bg-slate-100'
                }`}
              >
                {showMargins ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              {/* CSV export */}
              <button
                onClick={handleExportCsv}
                disabled={exporting}
                title="Download purchases as CSV"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-gray-600 transition-colors active:scale-95 disabled:opacity-50 hidden sm:flex"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={() => setDark((d) => !d)}
                title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-gray-600 transition-colors active:scale-95"
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh data from Google Sheets"
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            </div>
          </div>

        {/* ── Tabs ── */}
        <div className="max-w-2xl mx-auto px-4 flex border-t border-slate-100 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-2xl mx-auto px-4 py-5 pb-10">
        {/* Loading banner */}
        {health !== null && !health.data_loaded && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-sm mb-4">
            Data is still loading — click <strong>Refresh</strong> if it takes too long.
          </div>
        )}
        {/* Refresh message (mobile) */}
        {refreshMsg && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg px-4 py-3 text-sm mb-4 sm:hidden">
            {refreshMsg}
          </div>
        )}

        {activeTab === 'date' && <DateView showMargins={showMargins} />}
        {activeTab === 'search' && <SearchView showMargins={showMargins} />}
        {activeTab === 'inventory' && <InventoryView />}
        {activeTab === 'cash' && <CashView />}
        {activeTab === 'order' && <OrderView />}
        {activeTab === 'analytics' && <BuyerAnalyticsView />}
        {activeTab === 'payments' && <PaymentsView />}
        {activeTab === 'cheques' && <ChequesView />}
        {activeTab === 'status' && <StatusView />}
        {activeTab === 'chat' && <ChatView />}
      </main>
    </div>
  )
}
