import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from '../App'
import * as api from '../api'

vi.mock('../api')

const mockHealth = {
  status: 'ok',
  data_loaded: true,
  last_refreshed: '2026-01-01T00:00:00',
}

const mockDateData = {
  date: new Date().toISOString().split('T')[0],
  items: [],
  total: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getHealth).mockResolvedValue(mockHealth)
  vi.mocked(api.getDateItems).mockResolvedValue(mockDateData)
  vi.mocked(api.getDates).mockResolvedValue({ dates: [] })
})

describe('App', () => {
  it('renders header with brand title', () => {
    render(<App />)
    expect(screen.getByText('Kapoor Traders CMS')).toBeInTheDocument()
  })

  it('renders both tab buttons', () => {
    render(<App />)
    expect(screen.getByText('By Date')).toBeInTheDocument()
    expect(screen.getByText('Search')).toBeInTheDocument()
  })

  it('renders the refresh button', () => {
    render(<App />)
    expect(screen.getByTitle('Refresh data from Google Sheets')).toBeInTheDocument()
  })

  it('calls getHealth on mount', async () => {
    render(<App />)
    await waitFor(() => {
      expect(api.getHealth).toHaveBeenCalled()
    })
  })

  it('shows last updated time after health loads', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/Updated/i)).toBeInTheDocument()
    })
  })
})
