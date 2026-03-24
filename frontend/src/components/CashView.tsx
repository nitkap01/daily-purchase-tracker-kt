import { useEffect, useState } from 'react'
import { PiggyBank, ChevronLeft, ChevronRight, Pencil, Trash2, Check, X, TrendingUp, TrendingDown } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { addCashEntry, getCashEntries, updateCashEntry, deleteCashEntry } from '../api'
import type { CashEntry } from '../types'

const today = (): string => new Date().toISOString().split('T')[0]

const currentMonthStart = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

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

type SummaryRow = { label: string; credit: number; debit: number; net: number }

// ── Daily Cash Flow Chart ────────────────────────────────────────────────

function DailyCashFlow({ entries }: { entries: CashEntry[] }) {
  const [fromDate, setFromDate] = useState(currentMonthStart)
  const [toDate, setToDate] = useState(today)

  const dailyData = (() => {
    const map = new Map<string, { credit: number; debit: number }>()
    entries
      .filter((e) => e.date >= fromDate && e.date <= toDate)
      .forEach((e) => {
        const prev = map.get(e.date) ?? { credit: 0, debit: 0 }
        if (e.type === 'debit') {
          map.set(e.date, { ...prev, debit: prev.debit + e.amount })
        } else {
          map.set(e.date, { ...prev, credit: prev.credit + e.amount })
        }
      })
    return Array.from(map.entries())
      .map(([date, v]) => ({
        date: shortDate(date),
        credit: v.credit,
        debit: v.debit,
        net: v.credit - v.debit,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  })()

  const totalCredit = dailyData.reduce((s, r) => s + r.credit, 0)
  const totalDebit = dailyData.reduce((s, r) => s + r.debit, 0)
  const netCash = totalCredit - totalDebit

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Daily Cash Flow</p>
      </div>
      <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">To</label>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            max={today()}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <button
          onClick={() => { setFromDate(currentMonthStart()); setToDate(today()) }}
          className="text-xs font-medium px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
        >
          This Month
        </button>
      </div>

      <div className="px-4 py-3 flex gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg px-3 py-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-700">Credit ₹{fmtShort(totalCredit)}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-1.5">
          <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          <span className="text-xs font-medium text-red-600">Debit ₹{fmtShort(totalDebit)}</span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${netCash >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
          <span className={`text-xs font-bold ${netCash >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            Net {netCash >= 0 ? '+' : ''}₹{fmtShort(netCash)}
          </span>
        </div>
      </div>

      {dailyData.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">No entries for selected range</p>
      ) : (
        <div className="px-4 pb-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `₹${fmtShort(v)}`}
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  `₹${fmt(v)}`,
                  name === 'credit' ? 'Credit' : name === 'debit' ? 'Debit' : 'Net',
                ]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend
                formatter={(v) => (v === 'credit' ? 'Credit' : v === 'debit' ? 'Debit' : 'Net')}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="credit" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="debit" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Summary Tabs (credit/debit/net by week or month) ─────────────────────

function SummaryTabs({ entries, fmt }: {
  entries: CashEntry[]
  fmt: (n: number) => string
}) {
  const [tab, setTab] = useState<'monthly' | 'weekly'>('monthly')

  const buildRows = (
    getKey: (e: CashEntry) => string,
    getLabel: (e: CashEntry) => string,
  ): (SummaryRow & { key: string })[] => {
    const map = new Map<string, { label: string; credit: number; debit: number }>()
    entries.forEach((e) => {
      const k = getKey(e)
      const prev = map.get(k) ?? { label: getLabel(e), credit: 0, debit: 0 }
      if (e.type === 'debit') {
        map.set(k, { ...prev, debit: prev.debit + e.amount })
      } else {
        map.set(k, { ...prev, credit: prev.credit + e.amount })
      }
    })
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, label: v.label, credit: v.credit, debit: v.debit, net: v.credit - v.debit }))
      .sort((a, b) => b.key.localeCompare(a.key))
  }

  const rows =
    tab === 'monthly'
      ? buildRows((e) => e.date.slice(0, 7), (e) => getMonthLabel(e.date))
      : buildRows((e) => getISOWeek(e.date), (e) => getISOWeek(e.date))

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
        <div className="px-4 py-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wide">
                <th className="text-left py-1 font-medium">{tab === 'monthly' ? 'Month' : 'Week'}</th>
                <th className="text-right py-1 font-medium text-emerald-600">Credit</th>
                <th className="text-right py-1 font-medium text-red-500">Debit</th>
                <th className="text-right py-1 font-medium text-blue-600">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="py-2 pr-2 font-medium text-gray-700">{r.label}</td>
                  <td className="py-2 text-right font-semibold text-emerald-600">₹{fmt(r.credit)}</td>
                  <td className="py-2 text-right font-semibold text-red-500">₹{fmt(r.debit)}</td>
                  <td className={`py-2 text-right font-bold ${r.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {r.net >= 0 ? '+' : ''}₹{fmt(r.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main CashView ─────────────────────────────────────────────────────────

export default function CashView() {
  const [entries, setEntries] = useState<CashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [entryType, setEntryType] = useState<'credit' | 'debit'>('credit')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const [editId, setEditId] = useState<number | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editType, setEditType] = useState<'credit' | 'debit'>('credit')
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const reload = () =>
    getCashEntries()
      .then((r) => setEntries(r.entries))
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
      await addCashEntry({ date, amount: amt, note: note.trim(), type: entryType })
      await reload()
      setAmount('')
      setNote('')
      setPage(0)
      setSuccess(`Saved ₹${fmt(amt)} (${entryType}) for ${shortDate(date)}`)
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
    setEditType(e.type ?? 'credit')
  }

  const cancelEdit = () => setEditId(null)

  const commitEdit = async () => {
    if (!editId) return
    const amt = parseFloat(editAmount)
    if (!editDate || isNaN(amt) || amt <= 0) return
    setEditSaving(true)
    try {
      await updateCashEntry(editId, { date: editDate, amount: amt, note: editNote.trim(), type: editType })
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

  const totalCredit = entries.filter((e) => e.type !== 'debit').reduce((s, e) => s + e.amount, 0)
  const totalDebit = entries.filter((e) => e.type === 'debit').reduce((s, e) => s + e.amount, 0)

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
          <p className="text-xs text-gray-500">Track credit &amp; debit by date</p>
        </div>
        {!loading && (
          <div className="ml-auto flex flex-col items-end gap-0.5">
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              +₹{fmtShort(totalCredit)}
            </span>
            <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
              −₹{fmtShort(totalDebit)}
            </span>
          </div>
        )}
      </div>

      {/* Entry form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-emerald-600 px-4 py-3 flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-white" />
          <h2 className="text-sm font-semibold text-white">Add Cash Entry</h2>
        </div>
        <div className="p-4 space-y-3">
          {/* Credit / Debit toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setEntryType('credit')}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                entryType === 'credit'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-500 hover:bg-slate-50'
              }`}
            >
              Credit (In)
            </button>
            <button
              onClick={() => setEntryType('debit')}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                entryType === 'debit'
                  ? 'bg-red-500 text-white'
                  : 'bg-white text-gray-500 hover:bg-slate-50'
              }`}
            >
              Debit (Out)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={date}
                max={today()}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
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

          {formError && <p className="text-xs text-red-600 font-medium">{formError}</p>}
          {success && <p className="text-xs text-emerald-600 font-medium">{success}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors active:scale-95 ${
              entryType === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {saving ? 'Saving…' : `Save ${entryType === 'credit' ? 'Credit' : 'Debit'}`}
          </button>
        </div>
      </div>

      {/* Daily Cash Flow chart */}
      {!loading && entries.length > 0 && <DailyCashFlow entries={entries} />}

      {/* Weekly / Monthly summary */}
      {!loading && entries.length > 0 && (
        <SummaryTabs entries={entries} fmt={fmt} />
      )}

      {/* Entries table */}
      {!loading && sortedEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Entries</p>
            <span className="text-xs text-gray-400">{sortedEntries.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
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
                        <select
                          value={editType}
                          onChange={(ev) => setEditType(ev.target.value as 'credit' | 'debit')}
                          className="border border-slate-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          <option value="credit">Credit</option>
                          <option value="debit">Debit</option>
                        </select>
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
                          <button onClick={commitEdit} disabled={editSaving}
                            className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors" title="Save">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={cancelEdit} disabled={editSaving}
                            className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-200 text-gray-600 hover:bg-slate-300 disabled:opacity-40 transition-colors" title="Cancel">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={`${e.date}-${i}`} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{shortDate(e.date)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          e.type === 'debit' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {e.type === 'debit' ? 'Debit' : 'Credit'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 truncate max-w-[120px]">
                        {e.note || <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-bold ${e.type === 'debit' ? 'text-red-500' : 'text-emerald-600'}`}>
                        {e.type === 'debit' ? '−' : '+'}₹{fmt(e.amount)}
                      </td>
                      <td className="px-2 py-2">
                        {e.id && (
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(e)}
                              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(e.id!)} disabled={deletingId === e.id}
                              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors" title="Delete">
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

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="flex items-center gap-1 text-xs font-medium text-gray-600 disabled:opacity-30 hover:text-indigo-600 transition-colors">
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <span className="text-xs text-gray-400">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="flex items-center gap-1 text-xs font-medium text-gray-600 disabled:opacity-30 hover:text-indigo-600 transition-colors">
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
