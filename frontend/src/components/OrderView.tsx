import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Package,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { getInventory } from '../api'
import type { InventoryItem } from '../types'

interface OrderLine {
  item: string
  qty: number
  buyPrice: number
  sellPrice: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const today = (): string => new Date().toISOString().split('T')[0]

const formatDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white'

// ── Order Builder ────────────────────────────────────────────────────────

function OrderBuilder({
  items,
  loading,
  lines,
  setLines,
  invoiceDate,
  setInvoiceDate,
  customerName,
  setCustomerName,
  onNext,
}: {
  items: InventoryItem[]
  loading: boolean
  lines: OrderLine[]
  setLines: React.Dispatch<React.SetStateAction<OrderLine[]>>
  invoiceDate: string
  setInvoiceDate: (d: string) => void
  customerName: string
  setCustomerName: (n: string) => void
  onNext: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [qty, setQty] = useState('1')
  const [sellPrice, setSellPrice] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const filteredItems = items.filter((it) =>
    it.item.toLowerCase().includes(search.toLowerCase()),
  )

  const handleSelectItem = (it: InventoryItem) => {
    setSelectedItem(it)
    setSearch(it.item)
    setShowDropdown(false)
    setSellPrice(
      it.selling_price && it.selling_price > 0 ? String(it.selling_price) : '',
    )
    setQty('1')
  }

  const handleAddLine = () => {
    if (!selectedItem) return
    const q = parseFloat(qty)
    const sp = parseFloat(sellPrice)
    if (isNaN(q) || q <= 0 || isNaN(sp) || sp <= 0) return

    setLines((prev) => [
      ...prev,
      {
        item: selectedItem.item,
        qty: q,
        buyPrice: selectedItem.latest_price ?? selectedItem.avg_price,
        sellPrice: sp,
      },
    ])
    setSearch('')
    setSelectedItem(null)
    setQty('1')
    setSellPrice('')
    searchRef.current?.focus()
  }

  const removeLine = (i: number) =>
    setLines((prev) => prev.filter((_, idx) => idx !== i))

  const totalCost = lines.reduce((s, l) => s + l.qty * l.buyPrice, 0)
  const totalRevenue = lines.reduce((s, l) => s + l.qty * l.sellPrice, 0)
  const totalProfit = totalRevenue - totalCost
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  const qtyN = parseFloat(qty)
  const spN = parseFloat(sellPrice)
  const canAdd = selectedItem != null && qtyN > 0 && spN > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">Order Builder</p>
          <p className="text-xs text-gray-500">Add items then generate invoice</p>
        </div>
      </div>

      {/* Invoice meta */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Invoice Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={invoiceDate}
              max={today()}
              onChange={(e) => { if (e.target.value) setInvoiceDate(e.target.value) }}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Customer (optional)</label>
            <input
              type="text"
              placeholder="Customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Add item */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Add Item</p>
        </div>
        <div className="p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search Inventory</label>
            <input
              ref={searchRef}
              type="text"
              placeholder={loading ? 'Loading items…' : 'Type to search…'}
              disabled={loading}
              value={search}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setSearch(e.target.value)
                setSelectedItem(null)
                setShowDropdown(true)
              }}
              className={inputCls}
            />
            {showDropdown && search && !selectedItem && filteredItems.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-52 overflow-y-auto">
                {filteredItems.map((it) => (
                  <button
                    key={it.item}
                    onMouseDown={() => handleSelectItem(it)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                  >
                    <span className="font-medium text-gray-800">{it.item}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      buy ₹{fmt(it.latest_price ?? it.avg_price)}
                    </span>
                    {it.selling_price != null && it.selling_price > 0 && (
                      <span className="ml-2 text-xs text-emerald-600">
                        sell ₹{fmt(it.selling_price)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Qty + sell price */}
          {selectedItem && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Selling Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder={`buy: ₹${fmt(selectedItem.latest_price ?? selectedItem.avg_price)}`}
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Live profit preview */}
          {selectedItem && qtyN > 0 && spN > 0 && (() => {
            const bp = selectedItem.latest_price ?? selectedItem.avg_price
            const profit = (spN - bp) * qtyN
            const pct = bp > 0 ? ((spN - bp) / bp) * 100 : 0
            return (
              <div className="flex items-center gap-2 text-xs font-medium bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-gray-500">Line total: ₹{fmt(spN * qtyN)}</span>
                <span className="mx-1 text-gray-300">·</span>
                <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                  {profit >= 0 ? '+' : ''}₹{fmt(profit)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}% margin)
                </span>
              </div>
            )
          })()}

          <button
            onClick={handleAddLine}
            disabled={!canAdd}
            className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add to Order
          </button>
        </div>
      </div>

      {/* Order lines */}
      {lines.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                Order Lines
              </p>
              <span className="text-xs text-gray-400">{lines.length} item{lines.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {lines.map((l, i) => {
                const cost = l.qty * l.buyPrice
                const rev = l.qty * l.sellPrice
                const profit = rev - cost
                const pct = cost > 0 ? (profit / cost) * 100 : 0
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{l.item}</p>
                      <p className="text-xs text-gray-400">
                        {l.qty} × ₹{fmt(l.sellPrice)} = ₹{fmt(rev)}
                        <span className={`ml-1.5 font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => removeLine(i)}
                      className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Running totals */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-400">Cost</p>
              <p className="font-bold text-gray-700 mt-0.5">₹{fmt(totalCost)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Revenue</p>
              <p className="font-bold text-emerald-600 mt-0.5">₹{fmt(totalRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Profit</p>
              <p className={`font-bold mt-0.5 ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {totalProfit >= 0 ? '+' : ''}₹{fmt(totalProfit)}
              </p>
            </div>
          </div>
          <div className="text-center">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${
              margin >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}>
              {margin >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              Overall Margin: {margin.toFixed(1)}%
            </span>
          </div>

          <button
            onClick={onNext}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm active:scale-95 transition-all"
          >
            Build Invoice
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  )
}

// ── Invoice View ─────────────────────────────────────────────────────────

function InvoiceView({
  lines,
  invoiceDate,
  customerName,
  onBack,
}: {
  lines: OrderLine[]
  invoiceDate: string
  customerName: string
  onBack: () => void
}) {
  const totalCost = lines.reduce((s, l) => s + l.qty * l.buyPrice, 0)
  const totalRevenue = lines.reduce((s, l) => s + l.qty * l.sellPrice, 0)
  const totalProfit = totalRevenue - totalCost
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  const invoiceNo = `INV-${invoiceDate.replace(/-/g, '')}-${String(lines.length).padStart(2, '0')}`

  const handlePrint = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${invoiceNo} - Kapoor Traders</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; background: white; padding: 40px; max-width: 720px; margin: 0 auto; }
    .header { background: #4f46e5; color: white; padding: 28px 32px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: flex-start; }
    .firm-name { font-size: 24px; font-weight: 800; letter-spacing: 0.3px; }
    .firm-sub { font-size: 11px; color: #c7d2fe; margin-top: 3px; }
    .inv-meta { text-align: right; }
    .inv-label { font-size: 10px; font-weight: 600; color: #c7d2fe; text-transform: uppercase; letter-spacing: 1.5px; }
    .inv-no { font-size: 16px; font-weight: 700; color: white; margin-top: 2px; }
    .inv-date { font-size: 12px; color: #c7d2fe; margin-top: 4px; }
    .card { border: 1px solid #e2e8f0; border-top: 0; border-radius: 0 0 12px 12px; overflow: hidden; }
    .bill-to { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; }
    .small-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 3px; }
    .bill-name { font-size: 14px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f8fafc; }
    th { padding: 10px 18px; text-align: right; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
    th:first-child { text-align: left; }
    td { padding: 13px 18px; text-align: right; font-size: 13px; border-bottom: 1px solid #f8fafc; color: #475569; }
    td:first-child { text-align: left; font-weight: 600; color: #1e293b; }
    .total-row td { background: #eef2ff; font-weight: 700; font-size: 15px; color: #4338ca; border-top: 2px solid #c7d2fe; border-bottom: 0; padding-top: 14px; padding-bottom: 14px; }
    .total-row td:first-child { color: #312e81; }
    .footer { margin-top: 28px; text-align: center; font-size: 11px; color: #94a3b8; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="firm-name">Kapoor Traders</div>
      <div class="firm-sub">Quality Products, Trusted Service</div>
    </div>
    <div class="inv-meta">
      <div class="inv-label">Invoice</div>
      <div class="inv-no">${invoiceNo}</div>
      <div class="inv-date">${formatDate(invoiceDate)}</div>
    </div>
  </div>
  <div class="card">
    ${customerName ? `<div class="bill-to"><div class="small-label">Bill To</div><div class="bill-name">${customerName}</div></div>` : ''}
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Rate (&#8377;)</th>
          <th>Total (&#8377;)</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map(l => `<tr><td>${l.item}</td><td>${l.qty}</td><td>${fmt(l.sellPrice)}</td><td>${fmt(l.qty * l.sellPrice)}</td></tr>`).join('\n        ')}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="3">Grand Total</td>
          <td>&#8377;${fmt(totalRevenue)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="footer">Thank you for your business! &mdash; Kapoor Traders</div>
</body>
</html>`
    const w = window.open('', '_blank', 'width=820,height=700')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
  }

  return (
    <div className="space-y-4">
      {/* Invoice card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-5 py-4 flex items-start justify-between">
          <div>
            <p className="text-white font-bold text-xl tracking-wide">Kapoor Traders</p>
            <p className="text-indigo-300 text-xs mt-0.5">Quality Products, Trusted Service</p>
            <p className="text-indigo-200 text-xs mt-2 font-semibold">{invoiceNo}</p>
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-xs uppercase tracking-widest">Invoice</p>
            <p className="text-white text-sm font-bold mt-1">{formatDate(invoiceDate)}</p>
          </div>
        </div>

        {customerName && (
          <div className="px-5 py-3 border-b border-slate-100">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Bill To</p>
            <p className="font-semibold text-gray-800 text-sm">{customerName}</p>
          </div>
        )}

        {/* Items table — NO purchase price shown */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Item</th>
                <th className="text-right px-4 py-2.5 font-medium">Qty</th>
                <th className="text-right px-4 py-2.5 font-medium">Rate (₹)</th>
                <th className="text-right px-4 py-2.5 font-medium">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lines.map((l, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{l.item}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{l.qty}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(l.sellPrice)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {fmt(l.qty * l.sellPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-indigo-100 bg-indigo-50">
                <td colSpan={3} className="px-4 py-3 font-bold text-indigo-900">Grand Total</td>
                <td className="px-4 py-3 text-right text-base font-bold text-indigo-600">
                  ₹{fmt(totalRevenue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Profit summary — internal, not for customer */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Profit Summary (your view)
          </p>
        </div>
        <div className="p-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-400">Cost</p>
            <p className="font-bold text-gray-700 mt-0.5">₹{fmt(totalCost)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Revenue</p>
            <p className="font-bold text-emerald-600 mt-0.5">₹{fmt(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Profit</p>
            <p className={`font-bold mt-0.5 ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalProfit >= 0 ? '+' : ''}₹{fmt(totalProfit)}
            </p>
          </div>
        </div>
        <div className="pb-4 text-center">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${
            margin >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}>
            {margin >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            Margin: {margin.toFixed(1)}%
          </span>
        </div>

        {/* Per-item profit breakdown */}
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {lines.map((l, i) => {
            const cost = l.qty * l.buyPrice
            const rev = l.qty * l.sellPrice
            const profit = rev - cost
            const pct = cost > 0 ? (profit / cost) * 100 : 0
            return (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="text-gray-600 truncate max-w-[140px]">{l.item}</span>
                <span className={`font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {profit >= 0 ? '+' : ''}₹{fmt(profit)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-300 bg-white text-gray-700 font-semibold text-sm hover:bg-slate-50 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Edit Order
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm active:scale-95 transition-all"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────

export default function OrderView() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'order' | 'invoice'>('order')
  const [invoiceDate, setInvoiceDate] = useState(today)
  const [customerName, setCustomerName] = useState('')
  const [lines, setLines] = useState<OrderLine[]>([])

  useEffect(() => {
    getInventory()
      .then((r) => setItems(r.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (step === 'invoice') {
    return (
      <InvoiceView
        lines={lines}
        invoiceDate={invoiceDate}
        customerName={customerName}
        onBack={() => setStep('order')}
      />
    )
  }

  return (
    <OrderBuilder
      items={items}
      loading={loading}
      lines={lines}
      setLines={setLines}
      invoiceDate={invoiceDate}
      setInvoiceDate={setInvoiceDate}
      customerName={customerName}
      setCustomerName={setCustomerName}
      onNext={() => setStep('invoice')}
    />
  )
}
