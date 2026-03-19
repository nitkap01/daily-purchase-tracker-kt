import { useEffect, useState } from 'react'
import { Check, PlusCircle, X } from 'lucide-react'
import { addItem, getSearchSuggestions } from '../api'
import { useDebounce } from '../hooks/useDebounce'

const today = (): string => new Date().toISOString().split('T')[0]

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

export default function AddItemView() {
  const [date, setDate] = useState(today)
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const debouncedItem = useDebounce(itemName, 300)

  useEffect(() => {
    if (debouncedItem.trim().length < 1) {
      setSuggestions([])
      return
    }
    getSearchSuggestions(debouncedItem.trim())
      .then((r) => setSuggestions(r.suggestions))
      .catch(() => setSuggestions([]))
  }, [debouncedItem])

  const computedAmount =
    quantity && price ? parseFloat(quantity) * parseFloat(price) : null

  const handleSave = async () => {
    setError(null)
    setSuccess(null)
    if (!itemName.trim()) return setError('Item name is required.')
    const qty = parseFloat(quantity)
    const prc = parseFloat(price)
    if (!qty || qty <= 0) return setError('Quantity must be a positive number.')
    if (!prc || prc <= 0) return setError('Price must be a positive number.')

    setSaving(true)
    try {
      const result = await addItem({ date, item: itemName.trim(), quantity: qty, price: prc })
      setSuccess(`Added — total ₹${fmt(result.amount)}`)
      setItemName('')
      setQuantity('')
      setPrice('')
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header strip */}
        <div className="bg-indigo-600 px-4 py-3 flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-white" />
          <h2 className="text-sm font-semibold text-white">Add Purchase</h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Date */}
          <Field label="Date">
            <div className="overflow-hidden">
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full min-w-0 border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            </div>
          </Field>

          {/* Item name with autocomplete */}
          <Field label="Item Name">
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Rice, Wheat…"
                value={itemName}
                autoComplete="off"
                onChange={(e) => {
                  setItemName(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className={inputCls}
              />
              {itemName && (
                <button
                  onClick={() => { setItemName(''); setSuggestions([]) }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear item"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <ul
                  role="listbox"
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-20 max-h-48 overflow-y-auto"
                >
                  {suggestions.map((s) => (
                    <li key={s} role="option" aria-selected={false}>
                      <button
                        onMouseDown={() => {
                          setItemName(s)
                          setShowSuggestions(false)
                        }}
                        className="w-full px-4 py-2.5 text-sm text-left hover:bg-indigo-50 hover:text-indigo-700 border-b border-slate-50 last:border-0 transition-colors"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>

          {/* Quantity & Price row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Price (₹)">
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Computed total preview */}
          {computedAmount !== null && computedAmount > 0 && (
            <div className="bg-indigo-50 rounded-lg px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs text-indigo-600 font-medium">Amount</span>
              <span className="text-base font-bold text-indigo-700">₹{fmt(computedAmount)}</span>
            </div>
          )}

          {/* Feedback */}
          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-sm py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                Save Purchase
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info note */}
      <p className="text-xs text-gray-400 text-center px-4">
        Entries are saved to memory and visible immediately. They reset on the next sheet refresh.
      </p>
    </div>
  )
}

const inputCls =
  'w-full min-w-0 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
