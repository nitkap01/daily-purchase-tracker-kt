import { useEffect, useState } from 'react'
import { BarChart2, Calendar, ChevronDown, ChevronUp, Package, ShoppingBag, TrendingUp } from 'lucide-react'
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

const todayIso = (): string => new Date().toISOString().split('T')[0]

const firstOfMonthIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const firstOfLastMonthIso = (): string => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().split('T')[0]
}

const lastOfLastMonthIso = (): string => {
  const d = new Date()
  d.setDate(0)
  return d.toISOString().split('T')[0]
}

// ── Collapsible day row ────────────────────────────────────────────────────

function DayRow({ day }: { day: SellerDayHistory }) {
  const [open, setOpen] = useState(false)

  const dayGstAmt = day.items.reduce(
    (s, it) => s + (it.bill_type?.toUpperCase() === 'W' ? it.amount * 0.18 : 0),
    0,
  )
  const hasGst = dayGstAmt > 0

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
              {hasGst && <span className="ml-1 text-green-600 dark:text-green-400 font-medium">· GST applicable</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold text-indigo-600">₹{fmt(day.day_total)}</p>
            {hasGst && (
              <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                +GST ₹{fmt(dayGstAmt)} = ₹{fmt(day.day_total + dayGstAmt)}
              </p>
            )}
          </div>
          {open
            ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-500" />
          }
        </div>
      </button>

      {open && (
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {day.items.map((it, i) => {
            const isWithBill = it.bill_type?.toUpperCase() === 'W'
            const isWithoutBill = it.bill_type?.toUpperCase() === 'WB'
            const gstAmt = isWithBill ? it.amount * 0.18 : 0
            return (
              <div key={i} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 shrink-0" />
                    <span className="font-medium text-gray-800 dark:text-slate-200 truncate">{it.item}</span>
                    {isWithBill && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        With Bill
                      </span>
                    )}
                    {isWithoutBill && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                        Without Bill
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
                {isWithBill && (
                  <p className="mt-0.5 ml-5 text-xs text-green-700 dark:text-green-400">
                    GST 18% ₹{fmt(gstAmt)} · After tax ₹{fmt(it.amount + gstAmt)}
                  </p>
                )}
              </div>
            )
          })}
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

  // Date range — default: 1st of current month → today
  const [fromDate, setFromDate] = useState(firstOfMonthIso)
  const [toDate, setToDate] = useState(todayIso)

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
    getSellerAnalytics(selected, fromDate || undefined, toDate || undefined)
      .then((r) => setAnalytics(r))
      .catch(() => setError('Could not load data for this seller.'))
      .finally(() => setLoading(false))
  }, [selected, fromDate, toDate])

  const applyPreset = (preset: 'month' | 'lastMonth' | 'all') => {
    if (preset === 'month') { setFromDate(firstOfMonthIso()); setToDate(todayIso()) }
    else if (preset === 'lastMonth') { setFromDate(firstOfLastMonthIso()); setToDate(lastOfLastMonthIso()) }
    else { setFromDate(''); setToDate('') }
  }

  const activePreset = (): 'month' | 'lastMonth' | 'all' | null => {
    if (fromDate === firstOfMonthIso() && toDate === todayIso()) return 'month'
    if (fromDate === firstOfLastMonthIso() && toDate === lastOfLastMonthIso()) return 'lastMonth'
    if (!fromDate && !toDate) return 'all'
    return null
  }
  const preset = activePreset()

  // GST-inclusive total computed from purchase history
  const gstTotal = analytics
    ? analytics.purchase_history.reduce(
        (s, day) => s + day.items.reduce((is, it) =>
          is + (it.bill_type?.toUpperCase() === 'W' ? it.amount * 0.18 : 0), 0), 0)
    : 0
  const hasAnyGst = gstTotal > 0

  const presetBtnCls = (active: boolean) =>
    `text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
      active
        ? 'bg-indigo-600 text-white border-indigo-600'
        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
    }`

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

      {/* Date filter */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
            Date Range
          </p>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          <button className={presetBtnCls(preset === 'month')} onClick={() => applyPreset('month')}>
            This Month
          </button>
          <button className={presetBtnCls(preset === 'lastMonth')} onClick={() => applyPreset('lastMonth')}>
            Last Month
          </button>
          <button className={presetBtnCls(preset === 'all')} onClick={() => applyPreset('all')}>
            All Time
          </button>
        </div>

        {/* Custom from/to */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
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
              <p className="text-xs text-gray-400 dark:text-slate-500">Base Total</p>
              <p className="font-bold text-indigo-600 text-base mt-0.5">₹{fmt(analytics.total_spent)}</p>
              {hasAnyGst && (
                <p className="text-[10px] text-green-600 dark:text-green-400 font-medium mt-0.5">
                  +GST ₹{fmt(gstTotal)}<br />
                  = ₹{fmt(analytics.total_spent + gstTotal)}
                </p>
              )}
              {(analytics.with_bill_spent > 0 || analytics.without_bill_spent > 0) && (
                <div className="mt-1.5 space-y-0.5 text-left">
                  {analytics.with_bill_spent > 0 && (
                    <p className="text-[10px] text-green-700 dark:text-green-400 font-medium">
                      W ₹{fmt(analytics.with_bill_spent)}
                    </p>
                  )}
                  {analytics.without_bill_spent > 0 && (
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                      WB ₹{fmt(analytics.without_bill_spent)}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 text-center">
              <p className="text-xs text-gray-400 dark:text-slate-500">Purchases</p>
              <p className="font-bold text-gray-800 dark:text-slate-100 text-base mt-0.5">{analytics.total_purchases}</p>
              {(analytics.with_bill_purchases > 0 || analytics.without_bill_purchases > 0) && (
                <div className="mt-1.5 space-y-0.5 text-left">
                  {analytics.with_bill_purchases > 0 && (
                    <p className="text-[10px] text-green-700 dark:text-green-400 font-medium">
                      W {analytics.with_bill_purchases}
                    </p>
                  )}
                  {analytics.without_bill_purchases > 0 && (
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                      WB {analytics.without_bill_purchases}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 text-center">
              <p className="text-xs text-gray-400 dark:text-slate-500">Items</p>
              <p className="font-bold text-gray-800 dark:text-slate-100 text-base mt-0.5">{analytics.unique_items}</p>
              {(analytics.with_bill_unique_items > 0 || analytics.without_bill_unique_items > 0) && (
                <div className="mt-1.5 space-y-0.5 text-left">
                  {analytics.with_bill_unique_items > 0 && (
                    <p className="text-[10px] text-green-700 dark:text-green-400 font-medium">
                      W {analytics.with_bill_unique_items}
                    </p>
                  )}
                  {analytics.without_bill_unique_items > 0 && (
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                      WB {analytics.without_bill_unique_items}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Empty state for filtered range */}
          {analytics.purchase_history.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
              <p className="text-gray-400 dark:text-slate-500 text-sm">No purchases in this date range</p>
            </div>
          )}

          {/* Date-wise history */}
          {analytics.purchase_history.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest px-1">
                Purchase History
              </p>
              {analytics.purchase_history.map((day, i) => (
                <DayRow key={i} day={day} />
              ))}
            </div>
          )}

          {/* Item breakdown */}
          {analytics.item_summary.length > 0 && (
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
          )}
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
