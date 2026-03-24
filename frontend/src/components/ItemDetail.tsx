import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  BarChart2,
  IndianRupee,
  Package,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getItemHistory } from '../api'
import type { ItemHistory } from '../types'

interface Props {
  item: string
  onBack: () => void
  showMargins?: boolean
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const fmtShort = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)

const shortDate = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y.slice(2)}`
}

export default function ItemDetail({ item, onBack, showMargins = true }: Props) {
  const [data, setData] = useState<ItemHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getItemHistory(item)
      .then(setData)
      .catch(() => setError('Could not load item history.'))
      .finally(() => setLoading(false))
  }, [item])

  const chartData = data
    ? [...data.history].reverse().map((h) => ({
        date: shortDate(h.date),
        price: h.price,
        quantity: h.quantity,
        amount: h.amount,
      }))
    : []

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 active:scale-95 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-32" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && data && (
        <>
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{data.item}</h2>
              <p className="text-xs text-gray-500">{data.total_purchases} purchase{data.total_purchases !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              icon={<ShoppingBag className="w-4 h-4 text-indigo-500" />}
              label="Total Spent"
              value={`₹${fmtShort(data.total_spent)}`}
            />
            <StatCard
              icon={<IndianRupee className="w-4 h-4 text-emerald-500" />}
              label="Avg Price"
              value={`₹${fmt(data.avg_price)}`}
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4 text-amber-500" />}
              label="Purchases"
              value={String(data.total_purchases)}
            />
          </div>

          {chartData.length > 1 && (
            <>
              {/* Price over time */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-gray-700">Price over time</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} />
                    <Tooltip
                      formatter={(v: number) => [`₹${fmt(v)}`, 'Price']}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#priceGrad)"
                      dot={{ r: 3, fill: '#6366f1' }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Quantity per purchase */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-gray-700">Quantity per purchase</span>
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: number) => [v, 'Quantity']}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="quantity" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* History list */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 px-0.5">Purchase history</p>
            <div className="space-y-2">
              {data.history.map((entry, i) => {
                const margin =
                  entry.selling_price && entry.selling_price > 0 && entry.price > 0
                    ? entry.selling_price - entry.price
                    : null
                const marginPct =
                  margin !== null && entry.price > 0
                    ? (margin / entry.price) * 100
                    : null
                const isWithBill = entry.bill_type?.toUpperCase() === 'W'
                const isWithoutBill = entry.bill_type?.toUpperCase() === 'WB'

                return (
                  <div
                    key={i}
                    className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <p className="text-sm font-medium text-gray-800">{entry.date}</p>
                          {isWithBill && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">With Bill</span>
                          )}
                          {isWithoutBill && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Without Bill</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {entry.quantity} × ₹{fmt(entry.price)} (buy)
                        </p>
                        {entry.selling_price && entry.selling_price > 0 && (
                          <p className="text-xs text-indigo-500 mt-0.5">
                            Sell: {showMargins ? `₹${fmt(entry.selling_price)}` : <span className="tracking-widest font-mono text-gray-400">••••</span>}
                            {marginPct !== null && margin !== null && (
                              <span className={`ml-1.5 font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {showMargins
                                  ? `margin ₹${fmt(margin)} (${marginPct >= 0 ? '+' : ''}${marginPct.toFixed(1)}%)`
                                  : <span className="tracking-widest font-mono text-gray-400">••••</span>
                                }
                              </span>
                            )}
                          </p>
                        )}
                        {entry.seller && (
                          <p className="text-xs text-gray-400 mt-0.5">Seller: {entry.seller}</p>
                        )}
                      </div>
                      <p className="text-sm font-bold text-indigo-600 shrink-0">₹{fmt(entry.amount)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-[10px] text-gray-500 leading-tight">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{value}</p>
    </div>
  )
}
