import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Key,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react'
import { getAppStatus, getSyncLog, syncDbToSheet, syncSheetToDb, uploadCredentials } from '../api'
import type { AppStatus, SyncLogEntry } from '../types'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

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
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([])
  const [logLoading, setLogLoading] = useState(true)
  const [syncing, setSyncing] = useState<'sheet_to_db' | 'db_to_sheet' | null>(null)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pendingSync, setPendingSync] = useState<'sheet_to_db' | 'db_to_sheet' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadStatus = () => {
    setStatusLoading(true)
    getAppStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setStatusLoading(false))
  }

  const loadLog = () => {
    setLogLoading(true)
    getSyncLog()
      .then((r) => setSyncLog(r.log))
      .catch(() => setSyncLog([]))
      .finally(() => setLogLoading(false))
  }

  useEffect(() => {
    loadStatus()
    loadLog()
  }, [])

  const handleSync = async (direction: 'sheet_to_db' | 'db_to_sheet') => {
    setPendingSync(null)
    setSyncing(direction)
    setSyncMsg(null)
    try {
      const fn = direction === 'sheet_to_db' ? syncSheetToDb : syncDbToSheet
      const result = await fn()
      setSyncMsg({ ok: true, text: `✓ Synced ${result.rows_synced} rows successfully` })
      loadLog()
      loadStatus()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Sync failed. Check configuration.'
      setSyncMsg({ ok: false, text: msg })
    } finally {
      setSyncing(null)
    }
  }

  const handleCredentialFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!e.target.files) return
    // reset so same file can be re-selected
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const result = await uploadCredentials(file)
      setUploadMsg({ ok: true, text: `✓ Credentials loaded (${result.client_email})` })
      loadStatus()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Upload failed. Ensure the file is a valid service-account JSON.'
      setUploadMsg({ ok: false, text: msg })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Confirm dialog */}
      {pendingSync && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Confirm Sync</h2>
            <p className="text-sm text-gray-600">
              {pendingSync === 'sheet_to_db'
                ? 'This will overwrite ALL purchase records in PostgreSQL with data from Google Sheet. Continue?'
                : 'This will overwrite the Google Sheet with ALL purchase records from PostgreSQL. Continue?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPendingSync(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-gray-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSync(pendingSync)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors ${
                  pendingSync === 'sheet_to_db'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                Yes, Sync
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">System Status</p>
            <p className="text-xs text-gray-500">Connections &amp; sync</p>
          </div>
        </div>
        <button
          onClick={() => { loadStatus(); loadLog() }}
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

            {/* Google Credentials */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Google Credentials</p>
                  <p className="text-xs text-gray-400">Required for DB → Sheet sync</p>
                </div>
                <StatusBadge
                  ok={status.checks.google_credentials.ok}
                  message={status.checks.google_credentials.message as string}
                />
              </div>
              {/* Upload section */}
              <div className="ml-8">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleCredentialFile}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 active:scale-95 transition-all disabled:opacity-50"
                >
                  {uploading
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? 'Uploading…' : 'Upload service-account JSON'}
                </button>
                {uploadMsg && (
                  <p className={`mt-1.5 text-xs font-medium ${uploadMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                    {uploadMsg.text}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sync actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Data Sync</p>
        </div>
        <div className="p-4 space-y-3">
          {syncMsg && (
            <div
              className={`text-xs font-medium rounded-lg px-3 py-2 ${
                syncMsg.ok
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {syncMsg.text}
            </div>
          )}

          {/* Sheet → DB */}
          <button
            onClick={() => setPendingSync('sheet_to_db')}
            disabled={syncing !== null}
            className="w-full flex items-center justify-between gap-3 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 border border-indigo-200 rounded-xl px-4 py-3 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                <ArrowDownToLine className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-indigo-900">Sheet → Database</p>
                <p className="text-xs text-indigo-500">Pull from Google Sheet, save to PostgreSQL</p>
              </div>
            </div>
            {syncing === 'sheet_to_db' && (
              <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
            )}
          </button>

          {/* DB → Sheet */}
          <button
            onClick={() => setPendingSync('db_to_sheet')}
            disabled={syncing !== null}
            className="w-full flex items-center justify-between gap-3 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 border border-amber-200 rounded-xl px-4 py-3 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
                <ArrowUpFromLine className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">Database → Sheet</p>
                <p className="text-xs text-amber-600">Push from PostgreSQL back to Google Sheet (requires credentials)</p>
              </div>
            </div>
            {syncing === 'db_to_sheet' && (
              <RefreshCw className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* Sync log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Sync History</p>
          <span className="text-xs text-gray-400">Last 20</span>
        </div>
        {logLoading ? (
          <div className="p-6 flex items-center justify-center animate-pulse">
            <span className="text-gray-400 text-sm">Loading…</span>
          </div>
        ) : syncLog.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No sync events yet</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {syncLog.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                <span
                  className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                    entry.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800">
                    {entry.direction === 'sheet_to_db' ? 'Sheet → DB' : 'DB → Sheet'}{' '}
                    <span className="text-gray-400 font-normal">· {entry.rows_synced} rows</span>
                  </p>
                  {entry.message && (
                    <p className="text-xs text-red-500 truncate">{entry.message}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(entry.synced_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
