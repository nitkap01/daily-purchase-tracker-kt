/* eslint-disable @typescript-eslint/no-explicit-any */

/** Minimal type declarations for Google Identity Services & Picker API */

interface TokenClient {
  requestAccessToken: (config?: { prompt?: string }) => void
  callback: (response: TokenResponse) => void
}

interface TokenResponse {
  access_token: string
  error?: string
  expires_in: number
  scope: string
  token_type: string
}

interface Google {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (response: TokenResponse) => void
      }) => TokenClient
      revoke: (token: string, done?: () => void) => void
    }
  }
}

interface GapiClient {
  load: (api: string, callback: () => void) => void
  picker: any
}

interface Gapi {
  load: (api: string, callback: () => void) => void
  client: GapiClient
}

declare global {
  interface Window {
    google?: Google
    gapi?: Gapi
  }
}

export type { TokenResponse, TokenClient }
