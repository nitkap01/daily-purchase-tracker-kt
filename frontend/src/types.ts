export interface PurchaseItem {
  item: string
  quantity: number
  price: number
  amount: number
  bill_type?: string       // 'W' = With Bill (18% GST), 'WB' = Without Bill
  seller?: string
  selling_price?: number
  unit?: string
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
  bill_type?: string
  seller?: string
  selling_price?: number
  unit?: string
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
  latest_price?: number
  selling_price?: number
}

export interface AddItemPayload {
  date: string
  item: string
  quantity: number
  price: number
}

export interface CashEntry {
  id?: number
  date: string
  amount: number
  note: string
  type: 'credit' | 'debit'
}

export interface AddCashPayload {
  date: string
  amount: number
  note: string
  type: 'credit' | 'debit'
}

// ── Seller / Buyer Analytics ────────────────────────────────────────────────
export interface SellerPurchaseRow {
  item: string
  quantity: number
  price: number
  amount: number
  bill_type?: string
  selling_price?: number
}

export interface SellerDayHistory {
  date: string
  items: SellerPurchaseRow[]
  day_total: number
}

export interface SellerItemSummary {
  item: string
  qty: number
  spent: number
  count: number
}

export interface SellerAnalytics {
  seller: string
  total_spent: number
  total_purchases: number
  unique_items: number
  item_summary: SellerItemSummary[]
  purchase_history: SellerDayHistory[]
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

// ── Payments ────────────────────────────────────────────────────────────────
export interface Payment {
  id: number
  party_name: string
  amount: number
  purchase_date: string
  notes: string
  status: 'pending' | 'received'
  received_at: string | null
  created_at: string | null
  days_to_pay: number | null
}

export interface PaymentsData {
  pending: Payment[]
  received: Payment[]
}

export interface CreatePaymentPayload {
  party_name: string
  amount: number
  purchase_date: string
  notes: string
}
