import { useEffect, useState } from 'react'
import { BarChart2, ChevronDown, ChevronUp, Package, ShoppingBag, TrendingUp } from 'lucide-react'
import { getSellers, getSellerAnalytics } from '../api'
import type { SellerAnalytics, SellerDayHistory } from '../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    weekday: 'short',
  })

// ── Collapsible day row ────────────────────────────────────────────────────

function DayRow({ day }: { day: SellerDayHistory }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{fmtDate(day.date)}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {day.items.length} item{day.items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-indigo-600">₹{fmt(day.day_total)}</span>
          {open
            ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-500" />
          }
        </div>
      </button>

      {open && (
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {day.items.map((it, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Package className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 shrink-0" />
                <span className="font-medium text-gray-800 dark:text-slate-200 truncate">{it.item}</span>
                {it.bill_type && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                    it.bill_type === 'W'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                  }`}>
                    {it.bill_type}
                  </span>
                )}
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="font-semibold text-gray-800 dark:text-slate-100">₹{fmt(it.amount)}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {it.quantity} × ₹{fmt(it.price)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────

export default function BuyerAnalyticsView() {
  const [sellers, setSellers] = useState<string[]>([])
  const [sellersLoading, setSellersLoading] = useState(true)
  const [selected, setSelected] = useState('')
  const [analytics, setAnalytics] = useState<SellerAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSellers()
      .then((r) => setSellers(r.sellers))
      .catch(() => {})
      .finally(() => setSellersLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) { setAnalytics(null); return }
    setLoading(true)
    setError(null)
    getSellerAnalytics(selected)
      .then((r) => setAnalytics(r))
      .catch(() => setError('Could not load data for this seller.'))
      .finally(() => setLoading(false))
  }, [selected])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <BarChart2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">Buyer Analytics</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Purchase breakdown by seller
          </p>
        </div>
      </div>

      {/* Seller dropdown */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">
          Select Seller
        </label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={sellersLoading}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-800 dark:text-slate-100 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">{sellersLoading ? 'Loading…' : sellers.length === 0 ? 'No sellers found' : '— choose a seller —'}</option>
          {sellers.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-100 dark:bg-slate-600 rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Analytics */}
      {!loading && analytics && (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 text-center">
              <p className="text-xs text-gray-400 dark:text-slate-500">Total Value</p>
              <p className="font-bold text-indigo-600 text-base mt-0.5">₹{fmt(analytics.total_spent)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 text-center">
              <p className="text-xs text-gray-400 dark:text-slate-500">Purchases</p>
              <p className="font-bold text-gray-800 dark:text-slate-100 text-base mt-0.5">{analytics.total_purchases}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 text-center">
              <p className="text-xs text-gray-400 dark:text-slate-500">Items</p>
              <p className="font-bold text-gray-800 dark:text-slate-100 text-base mt-0.5">{analytics.unique_items}</p>
            </div>
          </div>

          {/* Item breakdown */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                By Item
              </p>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700">
              {analytics.item_summary.map((it, i) => {
                const pct = analytics.total_spent > 0
                  ? (it.spent / analytics.total_spent) * 100
                  : 0
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">
                          {it.item}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
                          ×{it.count}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-bold text-indigo-600">₹{fmt(it.spent)}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{it.qty} units</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Date-wise history */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest px-1">
              Purchase History
            </p>
            {analytics.purchase_history.map((day, i) => (
              <DayRow key={i} day={day} />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && !analytics && !error && selected && (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">
          No purchase data found for this seller.
        </div>
      )}

      {/* Prompt state */}
      {!selected && !loading && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-10 text-center">
          <BarChart2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 dark:text-slate-400">
            Select a seller above to see their purchase analytics
          </p>
        </div>
      )}
    </div>
  )
}
