import { useEffect, useRef, useState } from 'react'
import { Calendar, History, Package, Search, TrendingUp, X } from 'lucide-react'
import { getItemHistory, getSearchSuggestions } from '../api'
import { useDebounce } from '../hooks/useDebounce'
import type { ItemHistory } from '../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

export default function SearchView() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [history, setHistory] = useState<ItemHistory | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedQuery = useDebounce(query, 300)

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length < 1) {
      setSuggestions([])
      return
    }
    getSearchSuggestions(debouncedQuery.trim())
      .then((r) => setSuggestions(r.suggestions))
      .catch(() => setSuggestions([]))
  }, [debouncedQuery])

  // Fetch history when an item is selected
  useEffect(() => {
    if (!selectedItem) {
      setHistory(null)
      return
    }
    setLoadingHistory(true)
    setError(null)
    getItemHistory(selectedItem)
      .then((r) => setHistory(r))
      .catch(() => {
        setError(`No history found for "${selectedItem}".`)
        setHistory(null)
      })
      .finally(() => setLoadingHistory(false))
  }, [selectedItem])

  const handleSelect = (item: string) => {
    setQuery(item)
    setSelectedItem(item)
    setShowSuggestions(false)
    setSuggestions([])
  }

  const handleClear = () => {
    setQuery('')
    setSelectedItem(null)
    setHistory(null)
    setError(null)
    setSuggestions([])
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-4">
      {/* Search card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <label
          htmlFor="item-search"
          className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
        >
          <Search className="w-4 h-4 text-indigo-600" />
          Search Item
        </label>

        <div className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              id="item-search"
              ref={inputRef}
              type="text"
              value={query}
              placeholder="e.g. Rice, Oil, Tomato…"
              autoComplete="off"
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedItem(null)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="w-full border border-slate-300 rounded-lg pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {query && (
              <button
                onClick={handleClear}
                aria-label="Clear search"
                className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && !selectedItem && (
            <ul
              role="listbox"
              aria-label="Search suggestions"
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-20 max-h-60 overflow-y-auto"
            >
              {suggestions.map((s, i) => (
                <li key={i} role="option" aria-selected={false}>
                  <button
                    onMouseDown={() => handleSelect(s)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-slate-50 last:border-0"
                  >
                    <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {loadingHistory && (
        <div className="space-y-2" aria-label="Loading">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-16"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {!loadingHistory && error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}

      {/* History results */}
      {!loadingHistory && history && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <History className="w-4 h-4 text-indigo-500" />
                <span className="text-xs text-gray-500 font-medium">Purchases</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{history.total_purchases}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-gray-500 font-medium">Total Spent</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">₹{fmt(history.total_spent)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">Avg. Price per unit</span>
            <span className="font-semibold text-gray-800 text-sm">₹{fmt(history.avg_price)}</span>
          </div>

          {/* History list */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5 px-0.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              Purchase history — <span className="text-gray-800 font-semibold">{history.item}</span>
            </p>
            <div className="space-y-2">
              {history.history.map((entry, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{entry.date}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {entry.quantity} × ₹{fmt(entry.price)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-indigo-600 shrink-0">
                    ₹{fmt(entry.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!query && !history && !loadingHistory && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Start typing to search for an item</p>
          <p className="text-gray-400 text-xs mt-1">Suggestions appear as you type</p>
        </div>
      )}
    </div>
  )
}
