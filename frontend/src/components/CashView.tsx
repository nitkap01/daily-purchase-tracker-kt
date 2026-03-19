import { useEffect, useState } from 'react'
import { PiggyBank, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { addCashEntry, getCashEntries } from '../api'
import type { CashEntry } from '../types'

const today = (): string => new Date().toISOString().split('T')[0]

const shortDate = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y.slice(2)}`
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n)

const fmtShort = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)

const ITEMS_PER_PAGE = 10

const inputCls =
  'w-full min-w-0 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

export default function CashView() {
  const [entries, setEntries] = useState<CashEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const reload = () =>
    getCashEntries()
      .then((r) => { setEntries(r.entries); setTotal(r.total) })
      .catch(() => {})

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    const amt = parseFloat(amount)
    if (!date) { setFormError('Date is required.'); return }
    if (isNaN(amt) || amt <= 0) { setFormError('Enter a valid amount > 0.'); return }
    setFormError(null)
    setSaving(true)
    try {
      await addCashEntry({ date, amount: amt, note: note.trim() })
      await reload()
      setAmount('')
      setNote('')
      setPage(0)
      setSuccess(`Saved ₹${fmt(amt)} for ${shortDate(date)}`)
      setTimeout(() => setSuccess(null), 3500)
    } catch {
      setFormError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Chart: entries sorted asc for trend line
  const chartData = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: shortDate(e.date), amount: e.amount }))

  // Table: entries sorted desc (newest first)
  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  const totalPages = Math.ceil(sortedEntries.length / ITEMS_PER_PAGE)
  const pageEntries = sortedEntries.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
        <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
          <PiggyBank className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">Daily Cash</p>
          <p className="text-xs text-gray-500">Track cash in/out by date</p>
        </div>
        {!loading && (
          <span className="ml-auto text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            ₹{fmtShort(total)} total
          </span>
        )}
      </div>

      {/* Entry form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-emerald-600 px-4 py-3 flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-white" />
          <h2 className="text-sm font-semibold text-white">Add Cash Entry</h2>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <div className="overflow-hidden">
                <input
                  type="date"
                  value={date}
                  max={today()}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. Morning collection"
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputCls}
            />
          </div>

          {formError && (
            <p className="text-xs text-red-600 font-medium">{formError}</p>
          )}
          {success && (
            <p className="text-xs text-emerald-600 font-medium">{success}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors active:scale-95"
          >
            {saving ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
      </div>

      {/* Chart */}
      {!loading && chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Cash Over Time
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `₹${fmtShort(v)}`}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                formatter={(v: number) => [`₹${fmt(v)}`, 'Amount']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#cashGrad)"
                dot={{ r: 3, fill: '#10b981' }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {!loading && sortedEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Entries
            </p>
            <span className="text-xs text-gray-400">{sortedEntries.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Note</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageEntries.map((e, i) => (
                  <tr key={`${e.date}-${i}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{shortDate(e.date)}</td>
                    <td className="px-4 py-2.5 text-gray-500 truncate max-w-[140px]">
                      {e.note || <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-600">₹{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 text-xs font-medium text-gray-600 disabled:opacity-30 hover:text-indigo-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <span className="text-xs text-gray-400">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 text-xs font-medium text-gray-600 disabled:opacity-30 hover:text-indigo-600 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && sortedEntries.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <PiggyBank className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No cash entries yet — add one above</p>
        </div>
      )}
    </div>
  )
}
