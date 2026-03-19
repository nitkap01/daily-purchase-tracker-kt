export interface PurchaseItem {
  item: string
  quantity: number
  price: number
  amount: number
}

export interface DateData {
  date: string
  items: PurchaseItem[]
  total: number
}

export interface HistoryEntry {
  date: string
  quantity: number
  price: number
  amount: number
}

export interface ItemHistory {
  item: string
  total_purchases: number
  total_spent: number
  avg_price: number
  history: HistoryEntry[]
}

export interface HealthData {
  status: string
  data_loaded: boolean
  last_refreshed: string | null
}

export interface InventoryItem {
  item: string
  purchase_count: number
  total_quantity: number
  total_spent: number
  avg_price: number
}

export interface AddItemPayload {
  date: string
  item: string
  quantity: number
  price: number
}

export interface CashEntry {
  date: string
  amount: number
  note: string
}

export interface AddCashPayload {
  date: string
  amount: number
  note: string
}

// ── Status ──────────────────────────────────────────────────────────────────
export interface StatusCheck {
  ok: boolean
  message: string
  [key: string]: unknown
}

export interface AppStatus {
  ok: boolean
  checks: {
    google_sheet: StatusCheck
    postgres: StatusCheck
    google_credentials: StatusCheck
  }
}

export interface SyncLogEntry {
  direction: string
  rows_synced: number
  status: string
  message: string
  synced_at: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  sql?: string
  rowsFound?: number
}

export interface RenameItemPayload {
  old_name: string
  new_name: string
}
