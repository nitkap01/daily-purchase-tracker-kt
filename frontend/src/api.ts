import axios from 'axios'
import type { AddCashPayload, AddItemPayload, AppStatus, CashEntry, DateData, HealthData, InventoryItem, ItemHistory, SyncLogEntry } from './types'

const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
})

export const getHealth = (): Promise<HealthData> =>
  api.get('/health').then((r) => r.data)

export const getDates = (): Promise<{ dates: string[] }> =>
  api.get('/dates').then((r) => r.data)

export const getDateItems = (date: string): Promise<DateData> =>
  api.get(`/date/${encodeURIComponent(date)}`).then((r) => r.data)

export const getSearchSuggestions = (
  q: string,
): Promise<{ suggestions: string[] }> =>
  api.get('/search/suggestions', { params: { q } }).then((r) => r.data)

export const getItemHistory = (item: string): Promise<ItemHistory> =>
  api.get('/search/history', { params: { item } }).then((r) => r.data)

export const refreshData = (): Promise<{
  status: string
  rows: number
  refreshed_at: string
}> => api.post('/refresh').then((r) => r.data)

export const getInventory = (): Promise<{ items: InventoryItem[] }> =>
  api.get('/inventory').then((r) => r.data)

export const addItem = (payload: AddItemPayload): Promise<{ status: string; amount: number }> =>
  api.post('/add', payload).then((r) => r.data)

export const getCashEntries = (): Promise<{ entries: CashEntry[]; total: number }> =>
  api.get('/cash').then((r) => r.data)

export const addCashEntry = (payload: AddCashPayload): Promise<{ status: string }> =>
  api.post('/cash', payload).then((r) => r.data)

export const getAppStatus = (): Promise<AppStatus> =>
  api.get('/status').then((r) => r.data)

export const syncSheetToDb = (): Promise<{ status: string; rows_synced: number }> =>
  api.post('/sync/sheet-to-db').then((r) => r.data)

export const syncDbToSheet = (): Promise<{ status: string; rows_synced: number }> =>
  api.post('/sync/db-to-sheet').then((r) => r.data)

export const getSyncLog = (): Promise<{ log: SyncLogEntry[] }> =>
  api.get('/sync/log').then((r) => r.data)
