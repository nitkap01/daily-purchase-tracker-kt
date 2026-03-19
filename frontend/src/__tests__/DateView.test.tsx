import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DateView from '../components/DateView'
import * as api from '../api'

vi.mock('../api')

const today = new Date().toISOString().split('T')[0]

describe('DateView', () => {
  beforeEach(() => {
    vi.mocked(api.getDateItems).mockResolvedValue({
      date: today,
      items: [
        { item: 'Apple', quantity: 2, price: 10, amount: 20 },
        { item: 'Banana', quantity: 1, price: 5, amount: 5 },
      ],
      total: 25,
    })
  })

  it('renders a date input defaulting to today', () => {
    render(<DateView />)
    const input = document.getElementById('date-picker') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.type).toBe('date')
  })

  it('shows items after data loads', async () => {
    render(<DateView />)
    await waitFor(() => {
      expect(screen.getByText('Apple')).toBeInTheDocument()
      expect(screen.getByText('Banana')).toBeInTheDocument()
    })
  })

  it('shows total amount', async () => {
    render(<DateView />)
    await waitFor(() => {
      expect(screen.getByText(/25\.00/)).toBeInTheDocument()
    })
  })

  it('shows empty state when no items', async () => {
    vi.mocked(api.getDateItems).mockResolvedValue({ date: today, items: [], total: 0 })
    render(<DateView />)
    await waitFor(() => {
      expect(screen.getByText(/No purchases found/i)).toBeInTheDocument()
    })
  })

  it('shows error state on API failure', async () => {
    vi.mocked(api.getDateItems).mockRejectedValue(new Error('Network error'))
    render(<DateView />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
