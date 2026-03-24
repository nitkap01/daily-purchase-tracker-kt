import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  clearCheque,
  createCheque,
  deleteCheque,
  getCheques,
  getPayments,
  rejectCheque,
} from '../api'
import type { Cheque, Payment } from '../types'

const today = (): string => new Date().toISOString().split('T')[0]

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const shortDate = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y.slice(2)}`
}

const fmtTs = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const inputCls =
  'w-full min-w-0 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

type SortField = 'party_name' | 'amount' | 'cheque_date'
type SortDir = 'asc' | 'desc'

function SortButton({
  field,
  label,
  current,
  dir,
  onChange,
}: {
  field: SortField
  label: string
  current: SortField
  dir: SortDir
  onChange: (f: SortField) => void
}) {
  const active = current === field
  return (
    <button
      onClick={() => onChange(field)}
      className={`flex items-center gap-0.5 text-xs font-medium transition-colors ${
        active ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {label}
      {active ? (
        dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ChevronDown className="w-3 h-3 opacity-30" />
      )}
    </button>
  )
}

export default function ChequesView() {
  const [pending, setPending] = useState<Cheque[]>([])
  const [settled, setSettled] = useState<Cheque[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(false)

  // Pending payments — used to show match hint in the add form
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([])

  // Add form
  const [showForm, setShowForm] = useState(false)
  const [partyName, setPartyName] = useState('')
  const [amount, setAmount] = useState('')
  const [chequeNumber, setChequeNumber] = useState('')
  const [chequeDate, setChequeDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Search
  const [search, setSearch] = useState('')

  // Sort — pending
  const [pendingSort, setPendingSort] = useState<SortField>('cheque_date')
  const [pendingDir, setPendingDir] = useState<SortDir>('desc')

  // Sort — settled
  const [settledSort, setSettledSort] = useState<SortField>('cheque_date')
  const [settledDir, setSettledDir] = useState<SortDir>('desc')

  const [actingId, setActingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const reload = () =>
    getCheques()
      .then((data) => {
        setPending(data.pending)
        setSettled(data.settled)
        setDbError(false)
      })
      .catch(() => setDbError(true))

  useEffect(() => {
    reload().finally(() => setLoading(false))
    getPayments()
      .then((data) => setPendingPayments(data.pending))
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    const amt = parseFloat(amount)
    if (!partyName.trim()) { setFormError('Party name is required.'); return }
    if (isNaN(amt) || amt <= 0) { setFormError('Enter a valid amount > 0.'); return }
    if (!chequeNumber.trim()) { setFormError('Cheque number is required.'); return }
    if (!chequeDate) { setFormError('Cheque date is required.'); return }
    setFormError(null)
    setSaving(true)
    try {
      await createCheque({
        party_name: partyName.trim(),
        amount: amt,
        cheque_number: chequeNumber.trim(),
        cheque_date: chequeDate,
      })
      await reload()
      setPartyName('')
      setAmount('')
      setChequeNumber('')
      setChequeDate(today())
      setShowForm(false)
      setSuccessMsg('Cheque entry added.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch {
      setFormError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async (id: number) => {
    setActingId(id)
    try {
      await clearCheque(id)
      await reload()
    } catch {
      // ignore
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (id: number) => {
    setActingId(id)
    try {
      await rejectCheque(id)
      await reload()
    } catch {
      // ignore
    } finally {
      setActingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await deleteCheque(id)
      await reload()
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  const applySort = (list: Cheque[], field: SortField, dir: SortDir): Cheque[] =>
    [...list].sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      if (field === 'party_name') { av = a.party_name.toLowerCase(); bv = b.party_name.toLowerCase() }
      else if (field === 'amount') { av = a.amount; bv = b.amount }
      else if (field === 'cheque_date') { av = a.cheque_date; bv = b.cheque_date }
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })

  const filterBySearch = (list: Cheque[]) => {
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((c) => {
      const matchParty = c.party_name.toLowerCase().includes(q)
      const matchAmount = fmt(c.amount).includes(q) || String(c.amount).includes(q)
      const matchDate =
        c.cheque_date.includes(q) || shortDate(c.cheque_date).includes(q)
      return matchParty || matchAmount || matchDate
    })
  }

  const togglePendingSort = (f: SortField) => {
    if (pendingSort === f) setPendingDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setPendingSort(f); setPendingDir('asc') }
  }

  const toggleSettledSort = (f: SortField) => {
    if (settledSort === f) setSettledDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSettledSort(f); setSettledDir('asc') }
  }

  const displayPending = filterBySearch(applySort(pending, pendingSort, pendingDir))
  const displaySettled = filterBySearch(applySort(settled, settledSort, settledDir))

  const pendingTotal = displayPending.reduce((s, c) => s + c.amount, 0)

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-gray-900">Cheques</h2>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(null) }}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Cheque
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2.5 text-sm">
          {successMsg}
        </div>
      )}

      {/* DB error */}
      {dbError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          Database unavailable — cheque data cannot be loaded.
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-gray-800">New Cheque Entry</p>
          {formError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}
          {(() => {
            const amt = parseFloat(amount)
            const match =
              partyName.trim() && !isNaN(amt) && amt > 0
                ? pendingPayments.find(
                    (p) =>
                      p.party_name.toLowerCase() === partyName.trim().toLowerCase() &&
                      p.amount === amt,
                  )
                : undefined
            return match ? (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  Matches pending payment:{' '}
                  <strong>{match.party_name}</strong> · ₹{fmt(match.amount)}
                  {match.notes ? ` (${match.notes})` : ''}
                  {' '}— confirming this cheque will auto-mark that payment as received.
                </span>
              </div>
            ) : null
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Party Name</label>
              <input
                className={inputCls}
                placeholder="e.g. Sharma Brothers"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount (₹)</label>
              <input
                className={inputCls}
                placeholder="0.00"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cheque Number</label>
              <input
                className={inputCls}
                placeholder="e.g. 000123"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cheque Date</label>
              <input
                className={inputCls}
                type="date"
                value={chequeDate}
                onChange={(e) => setChequeDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 active:scale-[0.99]"
            >
              {saving ? 'Saving…' : 'Save Cheque'}
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError(null) }}
              className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-gray-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          placeholder="Search by party, amount or date…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
      )}

      {/* Pending cheques */}
      {!loading && !dbError && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Pending</span>
              {displayPending.length > 0 && (
                <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded-full">
                  {displayPending.length}
                </span>
              )}
            </div>
            {displayPending.length > 0 && (
              <span className="text-xs font-semibold text-orange-600">
                Total ₹{fmt(pendingTotal)}
              </span>
            )}
          </div>

          {/* Sort controls — pending */}
          {displayPending.length > 1 && (
            <div className="flex items-center gap-3 px-0.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">Sort:</span>
              <SortButton field="party_name" label="Party" current={pendingSort} dir={pendingDir} onChange={togglePendingSort} />
              <SortButton field="amount" label="Amount" current={pendingSort} dir={pendingDir} onChange={togglePendingSort} />
              <SortButton field="cheque_date" label="Date" current={pendingSort} dir={pendingDir} onChange={togglePendingSort} />
            </div>
          )}

          {displayPending.length === 0 && !search && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-sm">
              <p className="text-gray-400 text-sm">No pending cheques</p>
            </div>
          )}
          {displayPending.length === 0 && search && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
              <p className="text-gray-400 text-sm">No results for "{search}"</p>
            </div>
          )}

          {displayPending.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold text-gray-900">{c.party_name}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Pending</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Cheque #{c.cheque_number} · {shortDate(c.cheque_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-sm font-bold text-indigo-600">₹{fmt(c.amount)}</p>
                  {/* Clear (✓) */}
                  <button
                    onClick={() => handleClear(c.id)}
                    disabled={actingId === c.id}
                    title="Mark as cleared by bank"
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 transition-colors disabled:opacity-50 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  {/* Reject (✗) */}
                  <button
                    onClick={() => handleReject(c.id)}
                    disabled={actingId === c.id}
                    title="Mark as rejected by bank"
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors disabled:opacity-50 active:scale-95"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                    title="Delete entry"
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 border border-slate-200 transition-colors disabled:opacity-50 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settled cheques */}
      {!loading && !dbError && (settled.length > 0 || (search && displaySettled.length > 0)) && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 px-0.5">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Settled</span>
            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-full">
              {displaySettled.length}
            </span>
          </div>

          {/* Sort controls — settled */}
          {displaySettled.length > 1 && (
            <div className="flex items-center gap-3 px-0.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">Sort:</span>
              <SortButton field="party_name" label="Party" current={settledSort} dir={settledDir} onChange={toggleSettledSort} />
              <SortButton field="amount" label="Amount" current={settledSort} dir={settledDir} onChange={toggleSettledSort} />
              <SortButton field="cheque_date" label="Date" current={settledSort} dir={settledDir} onChange={toggleSettledSort} />
            </div>
          )}

          {displaySettled.map((c) => {
            const isCleared = c.status === 'cleared'
            const settledAt = isCleared ? c.cleared_at : c.rejected_at
            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm opacity-80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold text-gray-900">{c.party_name}</p>
                      {isCleared ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">Cleared</span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Rejected</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Cheque #{c.cheque_number} · {shortDate(c.cheque_date)}
                    </p>
                    <p className={`text-xs mt-0.5 ${isCleared ? 'text-green-600' : 'text-red-500'}`}>
                      {isCleared ? 'Cleared' : 'Rejected'} on {fmtTs(settledAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-bold text-gray-500">₹{fmt(c.amount)}</p>
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      title="Delete entry"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 border border-slate-200 transition-colors disabled:opacity-50 active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
