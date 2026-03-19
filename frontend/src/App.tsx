import { useCallback, useEffect, useState } from 'react'
import { Activity, Calendar, Layers, MessageCircle, PiggyBank, PlusCircle, RefreshCw, Search, ShoppingCart } from 'lucide-react'
import DateView from './components/DateView'
import SearchView from './components/SearchView'
import AddItemView from './components/AddItemView'
import InventoryView from './components/InventoryView'
import CashView from './components/CashView'
import StatusView from './components/StatusView'
import ChatView from './components/ChatView'
import { getHealth, refreshData } from './api'
import type { HealthData } from './types'
import { APP_VERSION } from './version'

type Tab = 'date' | 'search' | 'add' | 'inventory' | 'cash' | 'status' | 'chat'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'date', label: 'By Date', icon: <Calendar className="w-4 h-4" /> },
  { id: 'search', label: 'Search', icon: <Search className="w-4 h-4" /> },
  { id: 'add', label: 'Add', icon: <PlusCircle className="w-4 h-4" /> },
  { id: 'inventory', label: 'Inventory', icon: <Layers className="w-4 h-4" /> },
  { id: 'cash', label: 'Cash', icon: <PiggyBank className="w-4 h-4" /> },
  { id: 'status', label: 'Status', icon: <Activity className="w-4 h-4" /> },
  { id: 'chat', label: 'AI Chat', icon: <MessageCircle className="w-4 h-4" /> },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('date')
  const [health, setHealth] = useState<HealthData | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)

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
            onClick={() => setActiveTab('date')}
            className="flex items-center gap-2.5 min-w-0 text-left active:opacity-70 transition-opacity"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-gray-900 text-sm sm:text-base leading-tight">
                Kapoor Trader Daily Purchase Tracker
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

        {activeTab === 'date' && <DateView />}
        {activeTab === 'search' && <SearchView />}
        {activeTab === 'add' && <AddItemView />}
        {activeTab === 'inventory' && <InventoryView />}
        {activeTab === 'cash' && <CashView />}
        {activeTab === 'status' && <StatusView />}
        {activeTab === 'chat' && <ChatView />}
      </main>
    </div>
  )
}
