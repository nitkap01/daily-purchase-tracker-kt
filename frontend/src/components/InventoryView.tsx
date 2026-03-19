import { useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getInventory } from '../api'
import type { InventoryItem } from '../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899',
  '#14b8a6', '#a855f7', '#eab308', '#64748b', '#0ea5e9',
]

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

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">Purchase Inventory</p>
          <p className="text-xs text-gray-500">Spending &amp; frequency breakdown</p>
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
                        <td className="px-4 py-2.5 font-medium text-gray-900">{item.item}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{fmt(item.total_quantity)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">₹{fmt(item.avg_price)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-indigo-600">₹{fmt(item.total_spent)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Purchase count bar chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Purchase Frequency</p>
            <ResponsiveContainer width="100%" height={Math.max(220, items.length * 36)}>
              <BarChart
                data={[...items].sort((a, b) => b.purchase_count - a.purchase_count)}
                layout="vertical"
                margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="item"
                  width={90}
                  tick={{ fontSize: 11, fill: '#374151' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [v, 'Purchases']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="purchase_count" radius={[0, 4, 4, 0]}>
                  {[...items]
                    .sort((a, b) => b.purchase_count - a.purchase_count)
                    .map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend / ranked list */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Top Items by Purchases</p>
            </div>
            <div className="divide-y divide-slate-50">
              {items.slice(0, 10).map((item, i) => (
                <div key={item.item} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.item}</p>
                    <p className="text-xs text-gray-500">
                      {item.purchase_count} purchase{item.purchase_count !== 1 ? 's' : ''} · avg ₹{fmt(item.avg_price)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-indigo-600">₹{fmt(item.total_spent)}</p>
                    <p className="text-xs text-gray-400">total</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
