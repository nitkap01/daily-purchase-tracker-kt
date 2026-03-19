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
