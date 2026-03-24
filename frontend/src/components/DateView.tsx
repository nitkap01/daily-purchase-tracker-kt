import { useEffect, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Package, ShoppingBag } from 'lucide-react'
import { getDateItems } from '../api'
import ItemDetail from './ItemDetail'
import type { DateData } from '../types'

const today = (): string => new Date().toISOString().split('T')[0]

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function DateView({ showMargins }: { showMargins: boolean }) {
  const [date, setDate] = useState(today)
  const [data, setData] = useState<DateData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)

  const load = async (d: string) => {
    if (!d) return
    setLoading(true)
    setError(null)
    try {
      const result = await getDateItems(d)
      setData(result)
    } catch {
      setError('Could not load data. Please try again.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(date)
    setSelectedItem(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // Show item detail when an item is selected
  if (selectedItem) {
    return <ItemDetail item={selectedItem} onBack={() => setSelectedItem(null)} showMargins={showMargins} />
  }

  return (
    <div className="space-y-4">
      {/* Date picker card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <label
          htmlFor="date-picker"
          className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
        >
          <Calendar className="w-4 h-4 text-indigo-600" />
          Select Date
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate((d) => addDays(d, -1))}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 active:scale-95 transition-all shrink-0"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <input
            id="date-picker"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => { if (e.target.value) setDate(e.target.value) }}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          />
          <button
            onClick={() => setDate((d) => { const next = addDays(d, 1); return next <= today() ? next : d })}
            disabled={date >= today()}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 active:scale-95 transition-all shrink-0 disabled:opacity-30"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => setDate(today())}
            disabled={date >= today()}
            className="px-3 h-9 text-xs font-semibold rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-95 transition-all shrink-0 disabled:opacity-30 disabled:cursor-default"
            aria-label="Go to today"
          >
            Today
          </button>
        </div>
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-2" aria-label="Loading">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse"
            >
              <div className="h-4 bg-slate-200 rounded w-2/5 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data?.items.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No purchases found for {date}</p>
        </div>
      )}

      {/* Items list */}
      {!loading && !error && data && data.items.length > 0 && (
        <>
          <p className="text-xs text-gray-500 font-medium px-0.5">
            {data.items.length} item{data.items.length !== 1 ? 's' : ''} on {date} · tap item for history
          </p>

          <div className="space-y-2">
            {data.items.map((item, i) => {
              const isWithBill = item.bill_type?.toUpperCase() === 'W'
              const isWithoutBill = item.bill_type?.toUpperCase() === 'WB'
              const gstAmount = isWithBill ? item.amount * 0.18 : 0
              const totalWithGst = isWithBill ? item.amount + gstAmount : null
              const profitPct =
                item.selling_price && item.selling_price > 0 && item.price > 0
                  ? ((item.selling_price - item.price) / item.price) * 100
                  : null

              return (
                <button
                  key={i}
                  onClick={() => setSelectedItem(item.item)}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-indigo-300 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <Package className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">{item.item}</p>
                          {isWithBill && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">+18% GST</span>
                          )}
                          {isWithoutBill && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Without Bill</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.quantity} × ₹{fmt(item.price)}
                        </p>
                        {isWithBill && totalWithGst !== null && (
                          <p className="text-xs text-green-700 mt-0.5">
                            GST ₹{fmt(gstAmount)} · After tax ₹{fmt(totalWithGst)}
                          </p>
                        )}
                        {item.seller && (
                          <p className="text-xs text-gray-400 mt-0.5">Seller: {item.seller}</p>
                        )}
                        {item.selling_price && item.selling_price > 0 && (
                          <p className="text-xs text-indigo-500 mt-0.5">
                            Sell {showMargins ? `₹${fmt(item.selling_price)}` : <span className="tracking-widest font-mono">••••</span>}
                            {profitPct !== null && (
                              <span className={`ml-1 font-semibold ${profitPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {showMargins ? `(${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(1)}%)` : <span className="tracking-widest font-mono">••••</span>}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-indigo-600 text-sm">₹{fmt(item.amount)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">tap for history</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Total banner */}
          <div className="bg-indigo-600 rounded-xl p-5 text-white shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-200 text-xs font-medium uppercase tracking-widest">
                  Total Spent
                </p>
                <p className="text-3xl font-bold mt-1">₹{fmt(data.total)}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
