/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CASH_START_DAY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
