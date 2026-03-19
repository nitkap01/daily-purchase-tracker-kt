import { useEffect, useState } from 'react'
import { PiggyBank, ChevronLeft, ChevronRight, Pencil, Trash2, Check, X } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { addCashEntry, getCashEntries, updateCashEntry, deleteCashEntry } from '../api'
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

// Returns ISO week label like "2026-W12"
const getISOWeek = (dateStr: string): string => {
  const d = new Date(dateStr)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const diff = d.getTime() - startOfWeek1.getTime()
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const getMonthLabel = (dateStr: string): string => {
  const [y, m] = dateStr.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`
}

const inputCls =
  'w-full min-w-0 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

type SummaryRow = { label: string; amount: number }

function SummaryTabs({
  weeklyTotals,
  monthlyTotals,
  fmt,
  fmtShort,
}: {
  weeklyTotals: SummaryRow[]
  monthlyTotals: SummaryRow[]
  fmt: (n: number) => string
  fmtShort: (n: number) => string
}) {
  const [tab, setTab] = useState<'weekly' | 'monthly'>('monthly')
  const rows = tab === 'weekly' ? weeklyTotals : monthlyTotals
  const max = Math.max(...rows.map((r) => r.amount), 1)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Tab header */}
      <div className="border-b border-slate-100 flex">
        {(['monthly', 'weekly'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
              tab === t
                ? 'text-emerald-700 bg-emerald-50 border-b-2 border-emerald-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'monthly' ? 'By Month' : 'By Week'}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">No data</p>
      ) : (
        <>
          {/* Bar chart */}
          <div className="px-4 pt-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={rows} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `₹${fmtShort(v)}`}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                />
                <Tooltip
                  formatter={(v: number) => [`₹${fmt(v)}`, 'Total']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {rows.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#059669' : '#6ee7b7'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary table */}
          <div className="px-4 pb-4 pt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase tracking-wide">
                  <th className="text-left py-1 font-medium">
                    {tab === 'monthly' ? 'Month' : 'Week'}
                  </th>
                  <th className="text-right py-1 font-medium">Total</th>
                  <th className="w-1/3 py-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r, i) => (
                  <tr key={r.label} className="group">
                    <td className="py-2 pr-3 font-medium text-gray-700">{r.label}</td>
                    <td className="py-2 text-right font-bold text-emerald-600 whitespace-nowrap">
                      ₹{fmt(r.amount)}
                    </td>
                    <td className="py-2 pl-3">
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${i === 0 ? 'bg-emerald-500' : 'bg-emerald-300'}`}
                          style={{ width: `${(r.amount / max) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

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

  // Edit state
  const [editId, setEditId] = useState<number | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

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

  const startEdit = (e: CashEntry) => {
    if (!e.id) return
    setEditId(e.id)
    setEditDate(e.date)
    setEditAmount(String(e.amount))
    setEditNote(e.note)
  }

  const cancelEdit = () => setEditId(null)

  const commitEdit = async () => {
    if (!editId) return
    const amt = parseFloat(editAmount)
    if (!editDate || isNaN(amt) || amt <= 0) return
    setEditSaving(true)
    try {
      await updateCashEntry(editId, { date: editDate, amount: amt, note: editNote.trim() })
      await reload()
      setEditId(null)
    } catch {
      // keep edit row open on failure
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await deleteCashEntry(id)
      await reload()
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  // Chart: entries sorted asc for trend line
  const chartData = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: shortDate(e.date), amount: e.amount }))

  // Weekly totals
  const weeklyTotals = (() => {
    const map = new Map<string, number>()
    entries.forEach((e) => {
      const k = getISOWeek(e.date)
      map.set(k, (map.get(k) ?? 0) + e.amount)
    })
    return Array.from(map.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.label.localeCompare(a.label))
  })()

  // Monthly totals
  const monthlyTotals = (() => {
    const map = new Map<string, { label: string; amount: number }>()
    entries.forEach((e) => {
      const key = e.date.slice(0, 7)
      const prev = map.get(key)
      map.set(key, { label: getMonthLabel(e.date), amount: (prev?.amount ?? 0) + e.amount })
    })
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.key.localeCompare(a.key))
  })()

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

      {/* Weekly / Monthly summary */}
      {!loading && entries.length > 0 && (
        <SummaryTabs
          weeklyTotals={weeklyTotals}
          monthlyTotals={monthlyTotals}
          fmt={fmt}
          fmtShort={fmtShort}
        />
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
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageEntries.map((e, i) =>
                  editId === e.id ? (
                    <tr key={`edit-${e.id}`} className="bg-indigo-50">
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          value={editDate}
                          max={today()}
                          onChange={(ev) => setEditDate(ev.target.value)}
                          className="border border-slate-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 w-32"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={editNote}
                          maxLength={300}
                          placeholder="Note"
                          onChange={(ev) => setEditNote(ev.target.value)}
                          className="border border-slate-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full min-w-[100px]"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={editAmount}
                          onChange={(ev) => setEditAmount(ev.target.value)}
                          className="border border-slate-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 w-24 text-right"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={commitEdit}
                            disabled={editSaving}
                            className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={editSaving}
                            className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-200 text-gray-600 hover:bg-slate-300 disabled:opacity-40 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={`${e.date}-${i}`} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{shortDate(e.date)}</td>
                      <td className="px-4 py-2.5 text-gray-500 truncate max-w-[140px]">
                        {e.note || <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-600">₹{fmt(e.amount)}</td>
                      <td className="px-2 py-2">
                        {e.id && (
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit(e)}
                              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(e.id!)}
                              disabled={deletingId === e.id}
                              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                )}
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
