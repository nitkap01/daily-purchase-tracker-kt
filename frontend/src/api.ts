import axios from 'axios'
import type { AddCashPayload, AddItemPayload, AppStatus, CashEntry, ChatMessage, CreatePaymentPayload, DateData, HealthData, InventoryItem, ItemHistory, Payment, PaymentsData, RenameItemPayload, SellerAnalytics } from './types'

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

export const updateCashEntry = (
  id: number,
  payload: AddCashPayload,
): Promise<{ status: string }> =>
  api.put(`/cash/${id}`, payload).then((r) => r.data)

export const deleteCashEntry = (id: number): Promise<{ status: string }> =>
  api.delete(`/cash/${id}`).then((r) => r.data)

export const getAppStatus = (): Promise<AppStatus> =>
  api.get('/status').then((r) => r.data)

export const getSellers = (): Promise<{ sellers: string[] }> =>
  api.get('/sellers').then((r) => r.data)

export const getSellerAnalytics = (seller: string): Promise<SellerAnalytics> =>
  api.get('/seller-analytics', { params: { seller } }).then((r) => r.data)

export const syncSheetToDb = (): Promise<{ status: string; rows_synced: number }> =>
  api.post('/sync/sheet-to-db').then((r) => r.data)

export const uploadCredentials = (
  file: File,
): Promise<{ status: string; project_id: string; client_email: string }> => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/credentials/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)
}

export const renameItem = (
  payload: RenameItemPayload,
): Promise<{ status: string; rows_renamed: number; db_rows: number; sheet_updated: boolean }> =>
  api.patch('/inventory/rename', payload).then((r) => r.data)

export const chatQuery = (
  question: string,
  model?: string,
): Promise<{ answer: string; sql: string; rows_found: number; data: Record<string, unknown>[] }> =>
  api.post('/chat', { question, model: model ?? '' }).then((r) => r.data)

export const getChatModels = (): Promise<{ models: string[]; default: string }> =>
  api.get('/chat/models').then((r) => r.data)

export const exportCsv = (): Promise<Blob> =>
  api.get('/export/csv', { responseType: 'blob', timeout: 30_000 }).then((r) => r.data)

// ── Payments ────────────────────────────────────────────────────────────────

export const getPayments = (): Promise<PaymentsData> =>
  api.get('/payments').then((r) => r.data)

export const createPayment = (payload: CreatePaymentPayload): Promise<{ status: string; id: number }> =>
  api.post('/payments', payload).then((r) => r.data)

export const markPaymentReceived = (id: number): Promise<{ status: string; received_at: string }> =>
  api.patch(`/payments/${id}/mark-received`).then((r) => r.data)

export const deletePayment = (id: number): Promise<{ status: string }> =>
  api.delete(`/payments/${id}`).then((r) => r.data)

// re-export ChatMessage so views can import from api if needed
export type { ChatMessage, Payment }
