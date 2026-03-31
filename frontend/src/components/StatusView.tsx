import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  CloudOff,
  Database,
  Download,
  FileSpreadsheet,
  FolderUp,
  HardDrive,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react'
import { downloadBackup, getAppStatus, uploadRestore } from '../api'
import type { AppStatus } from '../types'

const GOOGLE_CLIENT_ID =
  (window as any).__ENV__?.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined
const GOOGLE_API_KEY =
  (window as any).__ENV__?.VITE_GOOGLE_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || undefined

const SCOPES = 'https://www.googleapis.com/auth/drive.file'

/* ── helpers ──────────────────────────────────────────────────────────── */

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

type DriveStep =
  | 'idle'
  | 'downloading-backup'
  | 'google-auth'
  | 'picking-folder'
  | 'uploading-drive'
  | 'done'
  | 'error'

type RestoreStep =
  | 'idle'
  | 'google-auth'
  | 'picking-file'
  | 'downloading-drive'
  | 'restoring'
  | 'done'
  | 'error'

/* ── Google auth helper ───────────────────────────────────────────────── */

function useGoogleAuth() {
  const tokenRef = useRef<string | null>(null)

  const requestToken = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.google) {
        reject(new Error('Google Identity Services not loaded'))
        return
      }
      if (!GOOGLE_CLIENT_ID) {
        reject(new Error('VITE_GOOGLE_CLIENT_ID not configured'))
        return
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(resp.error))
            return
          }
          tokenRef.current = resp.access_token
          resolve(resp.access_token)
        },
      })
      client.requestAccessToken({ prompt: '' })
    })
  }, [])

  return { tokenRef, requestToken }
}

/* ── Google Picker helper ─────────────────────────────────────────────── */

function loadPickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error('gapi not loaded'))
      return
    }
    window.gapi.load('picker', () => resolve())
  })
}

function pickFolder(token: string): Promise<{ id: string; name: string }> {
  return new Promise((resolve, reject) => {
    loadPickerApi().then(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const google = (window as any).google
      const picker = new google.picker.PickerBuilder()
        .setTitle('Select a folder for backup')
        .addView(
          new google.picker.DocsView()
            .setIncludeFolders(true)
            .setSelectFolderEnabled(true)
            .setMimeTypes('application/vnd.google-apps.folder'),
        )
        .setOAuthToken(token)
        .setDeveloperKey(GOOGLE_API_KEY || '')
        .setCallback((data: any) => {
          if (data.action === 'picked' && data.docs?.[0]) {
            resolve({ id: data.docs[0].id, name: data.docs[0].name })
          } else if (data.action === 'cancel') {
            reject(new Error('Picker cancelled'))
          }
        })
        .build()
      picker.setVisible(true)
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }).catch(reject)
  })
}

function pickFile(token: string): Promise<{ id: string; name: string }> {
  return new Promise((resolve, reject) => {
    loadPickerApi().then(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const google = (window as any).google
      const picker = new google.picker.PickerBuilder()
        .setTitle('Select a backup zip to restore')
        .addView(
          new google.picker.DocsView()
            .setMimeTypes('application/zip')
            .setQuery('kapoortraders_backup'),
        )
        .setOAuthToken(token)
        .setDeveloperKey(GOOGLE_API_KEY || '')
        .setCallback((data: any) => {
          if (data.action === 'picked' && data.docs?.[0]) {
            resolve({ id: data.docs[0].id, name: data.docs[0].name })
          } else if (data.action === 'cancel') {
            reject(new Error('Picker cancelled'))
          }
        })
        .build()
      picker.setVisible(true)
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }).catch(reject)
  })
}

/* ── Drive API helpers ────────────────────────────────────────────────── */

async function uploadToDrive(
  token: string,
  folderId: string,
  blob: Blob,
  filename: string,
): Promise<{ id: string; name: string }> {
  const metadata = {
    name: filename,
    mimeType: 'application/zip',
    parents: [folderId],
  }

  const form = new FormData()
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  )
  form.append('file', blob, filename)

  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  )

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Drive upload failed: ${err}`)
  }

  return resp.json()
}

async function downloadFromDrive(token: string, fileId: string): Promise<Blob> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Drive download failed: ${err}`)
  }
  return resp.blob()
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function StatusView() {
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  // Backup state
  const [driveStep, setDriveStep] = useState<DriveStep>('idle')
  const [driveMsg, setDriveMsg] = useState<string | null>(null)

  // Restore state
  const [restoreStep, setRestoreStep] = useState<RestoreStep>('idle')
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null)

  const { requestToken } = useGoogleAuth()

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

  const driveConfigured = !!(GOOGLE_CLIENT_ID && GOOGLE_API_KEY)

  /* ── Backup flow ──────────────────────────────────────────────────── */

  const handleBackup = useCallback(async () => {
    setDriveStep('downloading-backup')
    setDriveMsg('Downloading backup from server…')

    let blob: Blob
    try {
      blob = await downloadBackup()
    } catch {
      setDriveStep('error')
      setDriveMsg('Failed to create backup from server.')
      return
    }

    setDriveStep('google-auth')
    setDriveMsg('Signing in to Google…')

    let token: string
    try {
      token = await requestToken()
    } catch {
      setDriveStep('error')
      setDriveMsg('Google sign-in was cancelled or failed.')
      return
    }

    setDriveStep('picking-folder')
    setDriveMsg('Pick a Google Drive folder…')

    let folder: { id: string; name: string }
    try {
      folder = await pickFolder(token)
    } catch {
      setDriveStep('error')
      setDriveMsg('Folder selection cancelled.')
      return
    }

    setDriveStep('uploading-drive')
    setDriveMsg(`Uploading to "${folder.name}"…`)

    const filename = `kapoortraders_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.zip`

    try {
      await uploadToDrive(token, folder.id, blob, filename)
      setDriveStep('done')
      setDriveMsg(`Backup saved to "${folder.name}/${filename}" on Google Drive.`)
    } catch (err) {
      setDriveStep('error')
      setDriveMsg(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [requestToken])

  /* ── Restore flow ─────────────────────────────────────────────────── */

  const handleRestore = useCallback(async () => {
    setRestoreStep('google-auth')
    setRestoreMsg('Signing in to Google…')

    let token: string
    try {
      token = await requestToken()
    } catch {
      setRestoreStep('error')
      setRestoreMsg('Google sign-in was cancelled or failed.')
      return
    }

    setRestoreStep('picking-file')
    setRestoreMsg('Pick a backup zip from Google Drive…')

    let file: { id: string; name: string }
    try {
      file = await pickFile(token)
    } catch {
      setRestoreStep('error')
      setRestoreMsg('File selection cancelled.')
      return
    }

    setRestoreStep('downloading-drive')
    setRestoreMsg(`Downloading "${file.name}" from Drive…`)

    let blob: Blob
    try {
      blob = await downloadFromDrive(token, file.id)
    } catch (err) {
      setRestoreStep('error')
      setRestoreMsg(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      return
    }

    setRestoreStep('restoring')
    setRestoreMsg('Restoring database…')

    try {
      const zipFile = new File([blob], file.name, { type: 'application/zip' })
      const result = await uploadRestore(zipFile)
      setRestoreStep('done')
      setRestoreMsg(
        `Restored ${result.tables_restored.length} table(s), ${result.total_rows} rows from "${file.name}".`,
      )
    } catch (err) {
      setRestoreStep('error')
      setRestoreMsg(`Restore failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [requestToken])

  const busyBackup = driveStep !== 'idle' && driveStep !== 'done' && driveStep !== 'error'
  const busyRestore = restoreStep !== 'idle' && restoreStep !== 'done' && restoreStep !== 'error'

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

      {/* ── Backup & Restore ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Backup &amp; Restore
          </p>
        </div>

        <div className="p-4 space-y-4">
          {!driveConfigured && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2.5 text-xs">
              <CloudOff className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Google Drive integration requires{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> and{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">VITE_GOOGLE_API_KEY</code>{' '}
                environment variables. Set them in Portainer (container env) or <code className="font-mono bg-amber-100 px-1 rounded">.env</code> and restart.
              </p>
            </div>
          )}

          {/* Backup to Drive */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                <FolderUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">Backup to Google Drive</p>
                <p className="text-xs text-gray-400">
                  Export all tables to a zip and upload to Drive
                </p>
              </div>
            </div>
            <button
              onClick={handleBackup}
              disabled={busyBackup || !driveConfigured}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 active:scale-95 shrink-0"
            >
              {busyBackup ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Backup
            </button>
          </div>

          {driveMsg && (
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs ${
                driveStep === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-600'
                  : driveStep === 'done'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-blue-50 border border-blue-200 text-blue-700'
              }`}
            >
              {driveStep === 'done' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : driveStep === 'error' ? (
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
              )}
              <p>{driveMsg}</p>
            </div>
          )}

          <hr className="border-slate-100" />

          {/* Restore from Drive */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5 text-violet-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">Restore from Google Drive</p>
                <p className="text-xs text-gray-400">
                  Pick a backup zip from Drive and restore tables
                </p>
              </div>
            </div>
            <button
              onClick={handleRestore}
              disabled={busyRestore || !driveConfigured}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 active:scale-95 shrink-0"
            >
              {busyRestore ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Restore
            </button>
          </div>

          {restoreMsg && (
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs ${
                restoreStep === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-600'
                  : restoreStep === 'done'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-violet-50 border border-violet-200 text-violet-700'
              }`}
            >
              {restoreStep === 'done' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : restoreStep === 'error' ? (
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
              )}
              <p>{restoreMsg}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
