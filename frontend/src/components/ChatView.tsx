import { useEffect, useRef, useState } from 'react'
import { Bot, ChevronDown, ChevronUp, MessageCircle, Send, Sparkles } from 'lucide-react'
import { chatQuery, getChatModels } from '../api'
import type { ChatMessage } from '../types'

const CHIPS = [
  'Most bought items',
  'Most expensive items',
  'Total spending this month',
  'Last 7 days spending',
  'Items bought most frequently',
]

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] bg-indigo-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
        {text}
      </div>
    </div>
  )
}

function AssistantBubble({ text, sql, rowsFound }: { text: string; sql?: string; rowsFound?: number }) {
  const [showSql, setShowSql] = useState(false)

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="bg-white border border-slate-200 text-sm text-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm whitespace-pre-wrap">
            {text}
          </div>
        </div>
        {sql && (
          <div className="ml-9">
            <button
              onClick={() => setShowSql((s) => !s)}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showSql ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {rowsFound ?? 0} row{rowsFound !== 1 ? 's' : ''} · {showSql ? 'hide' : 'show'} SQL
            </button>
            {showSql && (
              <pre className="mt-1.5 text-xs bg-slate-900 text-green-400 rounded-lg p-3 overflow-x-auto leading-relaxed">
                {sql}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    getChatModels()
      .then(({ models: list, default: def }) => {
        setModels(list)
        setSelectedModel(def)
      })
      .catch(() => {/* silently ignore — model selector will be empty */})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const result = await chatQuery(q, selectedModel || undefined)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: result.answer, sql: result.sql, rowsFound: result.rows_found },
      ])
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Something went wrong. Check that OPENAI_API_KEY and PostgreSQL are configured.'
      setMessages((prev) => [...prev, { role: 'assistant', text: `⚠️ ${msg}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask(input)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] min-h-[400px]">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3 mb-4 shrink-0">
        <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">AI Purchase Assistant</p>
          <p className="text-xs text-gray-500">Ask questions about your purchases in plain English</p>
        </div>
        {models.length > 0 && (
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 shrink-0 max-w-[160px]"
            title="Select AI model"
          >
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Ask anything about your purchases</p>
              <p className="text-xs text-gray-400 mt-1">Powered by OpenAI · queries your live database</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => ask(chip)}
                  className="text-xs px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-95 transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) =>
          msg.role === 'user'
            ? <UserBubble key={i} text={msg.text} />
            : <AssistantBubble key={i} text={msg.text} sql={msg.sql} rowsFound={msg.rowsFound} />
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 mt-3">
        {/* Quick chips (after first message) */}
        {messages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => ask(chip)}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white text-gray-600 hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-40 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 bg-white border border-slate-200 rounded-xl p-2 shadow-sm">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Which items did I buy most this month?"
            rows={1}
            className="flex-1 resize-none text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none px-2 py-1.5 max-h-32"
            style={{ height: 'auto' }}
            disabled={loading}
          />
          <button
            onClick={() => ask(input)}
            disabled={loading || !input.trim()}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 active:scale-95 transition-all shrink-0"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-300 mt-1.5">
          AI can make mistakes · always verify important queries
        </p>
      </div>
    </div>
  )
}
