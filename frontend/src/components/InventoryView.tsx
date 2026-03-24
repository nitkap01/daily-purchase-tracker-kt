import { useEffect, useRef, useState } from 'react'
import { Check, Layers, Pencil, X } from 'lucide-react'
import { getInventory, renameItem } from '../api'
import type { InventoryItem } from '../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)

function RenameCell({ item, onRenamed }: { item: string; onRenamed: (oldName: string, newName: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setValue(item)
    setEditing(true)
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  const cancel = () => {
    setEditing(false)
    setError(null)
  }

  const save = async () => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === item) { cancel(); return }
    setSaving(true)
    setError(null)
    try {
      await renameItem({ old_name: item, new_name: trimmed })
      onRenamed(item, trimmed)
      setEditing(false)
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Rename failed.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 group">
        <span className="font-medium text-gray-900">{item}</span>
        <button
          onClick={startEdit}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-indigo-600 transition-all"
          aria-label={`Rename ${item}`}
          title="Rename item"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="text-sm border border-indigo-400 rounded-md px-2 py-0.5 w-32 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          disabled={saving}
        />
        <button
          onClick={save}
          disabled={saving || !value.trim()}
          className="w-6 h-6 flex items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
          title="Save"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={cancel}
          disabled={saving}
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-slate-100"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default function InventoryView() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getInventory()
      .then((r) => setItems(r.items))
      .catch(() => setError('Could not load inventory.'))
      .finally(() => setLoading(false))
  }, [])

  const handleRenamed = (oldName: string, newName: string) => {
    setItems((prev) =>
      prev.map((it) => (it.item === oldName ? { ...it, item: newName } : it))
    )
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">Purchase Inventory</p>
          <p className="text-xs text-gray-500">Spending &amp; frequency breakdown · hover item to rename</p>
        </div>
        {!loading && !error && (
          <span className="ml-auto text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
            {items.length} items
          </span>
        )}
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 h-80 flex items-center justify-center animate-pulse">
          <span className="text-gray-400 text-sm">Loading…</span>
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No inventory data yet</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          {/* Table — Total Spent per item */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Total Spent per Item</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-2 font-medium">#</th>
                    <th className="text-left px-4 py-2 font-medium">Item</th>
                    <th className="text-right px-4 py-2 font-medium">Qty</th>
                    <th className="text-right px-4 py-2 font-medium">Avg Price</th>
                    <th className="text-right px-4 py-2 font-medium">Total Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[...items]
                    .sort((a, b) => b.total_spent - a.total_spent)
                    .map((item, i) => (
                      <tr key={item.item} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <RenameCell item={item.item} onRenamed={handleRenamed} />
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{fmt(item.total_quantity)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">₹{fmt(item.avg_price)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-indigo-600">₹{fmt(item.total_spent)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

