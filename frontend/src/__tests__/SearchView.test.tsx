import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchView from '../components/SearchView'
import * as api from '../api'

vi.mock('../api')

const mockHistory = {
  item: 'Apple',
  total_purchases: 3,
  total_spent: 60,
  avg_price: 10,
  history: [
    { date: '2026-01-03', quantity: 1, price: 10, amount: 10 },
    { date: '2026-01-02', quantity: 2, price: 10, amount: 20 },
    { date: '2026-01-01', quantity: 3, price: 10, amount: 30 },
  ],
}

describe('SearchView', () => {
  beforeEach(() => {
    vi.mocked(api.getSearchSuggestions).mockResolvedValue({ suggestions: ['Apple', 'Apricot'] })
    vi.mocked(api.getItemHistory).mockResolvedValue(mockHistory)
  })

  it('renders search input', () => {
    render(<SearchView showMargins={true} />)
    expect(screen.getByPlaceholderText(/Rice, Oil/i)).toBeInTheDocument()
  })

  it('shows empty state initially', () => {
    render(<SearchView showMargins={true} />)
    expect(screen.getByText(/Start typing/i)).toBeInTheDocument()
  })

  it('fetches suggestions as user types', async () => {
    const user = userEvent.setup()
    render(<SearchView showMargins={true} />)
    await user.type(screen.getByPlaceholderText(/Rice, Oil/i), 'app')
    await waitFor(() => {
      expect(api.getSearchSuggestions).toHaveBeenCalledWith('app')
    })
  })

  it('shows history after selecting a suggestion', async () => {
    const user = userEvent.setup()
    render(<SearchView showMargins={true} />)
    await user.type(screen.getByPlaceholderText(/Rice, Oil/i), 'app')
    await waitFor(() => expect(screen.getByText('Apple')).toBeInTheDocument())
    await user.click(screen.getByText('Apple'))
    await waitFor(() => {
      expect(api.getItemHistory).toHaveBeenCalledWith('Apple')
      expect(screen.getByText('3')).toBeInTheDocument() // total_purchases
    })
  })
})
