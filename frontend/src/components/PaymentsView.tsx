import { useEffect, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  createPayment,
  deletePayment,
  getPayments,
  markPaymentReceived,
} from '../api'
import type { Payment } from '../types'

const today = (): string => new Date().toISOString().split('T')[0]

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const shortDate = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y.slice(2)}`
}

const inputCls =
  'w-full min-w-0 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

type SortField = 'party_name' | 'amount' | 'purchase_date' | 'days_to_pay'
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
        dir === 'asc' ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )
      ) : (
        <ChevronDown className="w-3 h-3 opacity-30" />
      )}
    </button>
  )
}

export default function PaymentsView() {
  const [pending, setPending] = useState<Payment[]>([])
  const [received, setReceived] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(false)

  // Add form
  const [showForm, setShowForm] = useState(false)
  const [partyName, setPartyName] = useState('')
  const [amount, setAmount] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Search
  const [search, setSearch] = useState('')

  // Sort — pending
  const [pendingSort, setPendingSort] = useState<SortField>('purchase_date')
  const [pendingDir, setPendingDir] = useState<SortDir>('desc')

  // Sort — received
  const [receivedSort, setReceivedSort] = useState<SortField>('days_to_pay')
  const [receivedDir, setReceivedDir] = useState<SortDir>('asc')

  const [markingId, setMarkingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const reload = () =>
    getPayments()
      .then((data) => {
        setPending(data.pending)
        setReceived(data.received)
        setDbError(false)
      })
      .catch(() => setDbError(true))

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    const amt = parseFloat(amount)
    if (!partyName.trim()) { setFormError('Party name is required.'); return }
    if (isNaN(amt) || amt <= 0) { setFormError('Enter a valid amount > 0.'); return }
    if (!purchaseDate) { setFormError('Purchase date is required.'); return }
    setFormError(null)
    setSaving(true)
    try {
      await createPayment({
        party_name: partyName.trim(),
        amount: amt,
        purchase_date: purchaseDate,
        notes: notes.trim(),
      })
      await reload()
      setPartyName('')
      setAmount('')
      setPurchaseDate(today())
      setNotes('')
      setShowForm(false)
      setSuccessMsg('Payment entry added.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch {
      setFormError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleMarkReceived = async (id: number) => {
    setMarkingId(id)
    try {
      await markPaymentReceived(id)
      await reload()
    } catch {
      // ignore
    } finally {
      setMarkingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await deletePayment(id)
      await reload()
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  const applySort = (list: Payment[], field: SortField, dir: SortDir): Payment[] => {
    return [...list].sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      if (field === 'party_name') {
        av = a.party_name.toLowerCase()
        bv = b.party_name.toLowerCase()
      } else if (field === 'amount') {
        av = a.amount
        bv = b.amount
      } else if (field === 'purchase_date') {
        av = a.purchase_date
        bv = b.purchase_date
      } else if (field === 'days_to_pay') {
        av = a.days_to_pay ?? 0
        bv = b.days_to_pay ?? 0
      }
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
  }

  const filterBySearch = (list: Payment[]) =>
    search.trim()
      ? list.filter((p) =>
          p.party_name.toLowerCase().includes(search.trim().toLowerCase()),
        )
      : list

  const togglePendingSort = (f: SortField) => {
    if (pendingSort === f) setPendingDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setPendingSort(f); setPendingDir('asc') }
  }

  const toggleReceivedSort = (f: SortField) => {
    if (receivedSort === f) setReceivedDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setReceivedSort(f); setReceivedDir('asc') }
  }

  const filteredPending = applySort(filterBySearch(pending), pendingSort, pendingDir)
  const filteredReceived = applySort(filterBySearch(received), receivedSort, receivedDir)

  const totalPending = pending.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
        <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">Payments</p>
          <p className="text-xs text-gray-500">Track pending &amp; received payments</p>
        </div>
        {!loading && pending.length > 0 && (
          <div className="shrink-0">
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              {pending.length} pending · ₹{fmt(totalPending)}
            </span>
          </div>
        )}
      </div>

      {dbError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          Could not connect to database. Payments require PostgreSQL.
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          placeholder="Search by party name…"
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-slate-300 rounded-lg pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Add Payment Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Pending Payment
          </span>
          {showForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showForm && (
          <div className="p-4 space-y-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Party Name</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Traders"
                maxLength={500}
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={purchaseDate}
                  max={today()}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
              <input
                type="text"
                placeholder="e.g. Invoice #123"
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputCls}
              />
            </div>

            {formError && <p className="text-xs text-red-600 font-medium">{formError}</p>}
            {successMsg && <p className="text-xs text-emerald-600 font-medium">{successMsg}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors active:scale-95"
              >
                {saving ? 'Saving…' : 'Save Payment'}
              </button>
              <button
                onClick={() => { setShowForm(false); setFormError(null) }}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-gray-500 hover:bg-slate-50 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {successMsg && !showForm && (
        <p className="text-xs text-emerald-600 font-medium px-1">{successMsg}</p>
      )}

      {/* Pending Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Pending Payments
          </p>
          <span className="text-xs text-gray-400">{filteredPending.length} entries</span>
        </div>

        {loading ? (
          <div className="px-4 py-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredPending.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">
            {search ? 'No matching pending payments' : 'No pending payments'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="bg-slate-50 text-xs text-gray-500 uppercase tracking-wide border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 font-medium">
                    <SortButton field="party_name" label="Party" current={pendingSort} dir={pendingDir} onChange={togglePendingSort} />
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium">
                    <SortButton field="amount" label="Amount" current={pendingSort} dir={pendingDir} onChange={togglePendingSort} />
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium">
                    <SortButton field="purchase_date" label="Date" current={pendingSort} dir={pendingDir} onChange={togglePendingSort} />
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Notes</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPending.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.party_name}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-500">₹{fmt(p.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{shortDate(p.purchase_date)}</td>
                    <td className="px-4 py-3 text-gray-400 truncate max-w-[120px] hidden sm:table-cell">
                      {p.notes || <span className="italic">—</span>}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleMarkReceived(p.id)}
                          disabled={markingId === p.id}
                          title="Mark as received"
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingId === p.id}
                          title="Delete"
                          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors active:scale-95 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Received Payments Table */}
      {received.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Payment Received
            </p>
            <span className="text-xs text-gray-400">{filteredReceived.length} entries</span>
          </div>

          {filteredReceived.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No matching received payments</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="bg-slate-50 text-xs text-gray-500 uppercase tracking-wide border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 font-medium">
                      <SortButton field="party_name" label="Party" current={receivedSort} dir={receivedDir} onChange={toggleReceivedSort} />
                    </th>
                    <th className="text-right px-4 py-2.5 font-medium">
                      <SortButton field="amount" label="Amount" current={receivedSort} dir={receivedDir} onChange={toggleReceivedSort} />
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium">
                      <SortButton field="purchase_date" label="Purchase" current={receivedSort} dir={receivedDir} onChange={toggleReceivedSort} />
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">Received On</th>
                    <th className="text-right px-4 py-2.5 font-medium">
                      <SortButton field="days_to_pay" label="Days" current={receivedSort} dir={receivedDir} onChange={toggleReceivedSort} />
                    </th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredReceived.map((p) => {
                    const days = p.days_to_pay ?? 0
                    const daysColor =
                      days <= 7 ? 'text-emerald-600' : days <= 30 ? 'text-amber-600' : 'text-red-500'

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-3 font-medium text-gray-800">{p.party_name}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">₹{fmt(p.amount)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{shortDate(p.purchase_date)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {p.received_at ? shortDate(p.received_at.slice(0, 10)) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${daysColor}`}>
                          {p.days_to_pay !== null ? `${p.days_to_pay}d` : '—'}
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={deletingId === p.id}
                            title="Delete"
                            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors active:scale-95 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
