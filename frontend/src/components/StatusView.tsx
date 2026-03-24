import { useEffect, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { getAppStatus } from '../api'
import type { AppStatus } from '../types'

function StatusBadge({ ok, message }: { ok: boolean; message: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
      }`}
    >
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {message}
    </span>
  )
}

export default function StatusView() {
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const loadStatus = () => {
    setStatusLoading(true)
    getAppStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setStatusLoading(false))
  }

  useEffect(() => {
    loadStatus()
  }, [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">System Status</p>
            <p className="text-xs text-gray-500">Connection health</p>
          </div>
        </div>
        <button
          onClick={loadStatus}
          disabled={statusLoading}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Connection checks */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Connections</p>
        </div>
        {statusLoading ? (
          <div className="p-6 flex items-center justify-center animate-pulse">
            <span className="text-gray-400 text-sm">Checking…</span>
          </div>
        ) : !status ? (
          <div className="p-4 text-sm text-red-600">Could not reach backend.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {/* Google Sheet */}
            <div className="flex items-center gap-3 px-4 py-3">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Google Sheet</p>
                <p className="text-xs text-gray-400 truncate">
                  {(status.checks.google_sheet as { sheet_id?: string }).sheet_id ?? '—'}
                </p>
              </div>
              <StatusBadge
                ok={status.checks.google_sheet.ok}
                message={status.checks.google_sheet.message as string}
              />
            </div>

            {/* PostgreSQL */}
            <div className="flex items-center gap-3 px-4 py-3">
              <Database className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">PostgreSQL</p>
                <p className="text-xs text-gray-400 truncate">
                  {(status.checks.postgres as { host?: string; database?: string }).host}
                  {' / '}
                  {(status.checks.postgres as { host?: string; database?: string }).database}
                </p>
              </div>
              <StatusBadge
                ok={status.checks.postgres.ok}
                message={status.checks.postgres.message as string}
              />
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
