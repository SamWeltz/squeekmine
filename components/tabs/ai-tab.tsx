'use client'

import { SendHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSWRConfig } from 'swr'
import { Btn, Card } from '@/components/kit'
import { useAuth } from '@/lib/auth'
import { useAccountData } from '@/lib/hooks'
import { checkpointRequest, claimRequest, mergeRequest } from '@/lib/squeek/actions'
import type { Proposal } from '@/lib/squeek/types'
import { useUI } from '@/lib/ui-context'
import { cn } from '@/lib/utils'

type Msg = { role: 'user' | 'assistant'; content: string; proposals?: Proposal[] }

const SUGGESTIONS = [
  'What should I do right now?',
  'How much can I claim?',
  'Which Squeeks can I merge?',
  'How does earning work here?',
]

export function AiTab() {
  const auth = useAuth()
  const { openSheet } = useUI()
  const { data: account } = useAccountData(auth.address)
  const { mutate } = useSWRConfig()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  async function ask(text: string) {
    const q = text.trim()
    if (!q || busy) return
    const next: Msg[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: auth.address,
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Request failed')
      setMessages([...next, { role: 'assistant', content: json.text, proposals: json.proposals }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function review(p: Proposal) {
    if (p.action === 'checkpoint') return openSheet({ type: 'tx', tx: checkpointRequest() })
    if (!account) return
    void mutate(`/api/account?address=${auth.address}`)
    if (p.action === 'claim') return openSheet({ type: 'tx', tx: claimRequest(p.tokenIds, account.squeeks) })
    const s = account.squeeks.find((x) => x.tokenId === p.survivorId)
    const d = account.squeeks.find((x) => x.tokenId === p.donorId)
    if (s && d) openSheet({ type: 'tx', tx: mergeRequest(s, d, account.network) })
  }

  const describe = (p: Proposal) =>
    p.action === 'claim'
      ? `Claim from ${p.tokenIds.length} Squeek${p.tokenIds.length === 1 ? '' : 's'}`
      : p.action === 'checkpoint'
        ? 'Run checkpoint'
        : `Merge #${p.donorId} into #${p.survivorId}`

  return (
    <div className="flex min-h-[60dvh] flex-col gap-3">
      {messages.length === 0 && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Ask about your Squeeks</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The assistant reads your live testnet position and can suggest actions. It can never sign anything: you review and sign
            in your own wallet.
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        </Card>
      )}

      <ul className="flex flex-col gap-3" aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={cn('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                m.role === 'user' ? 'bg-lime text-primary-foreground' : 'bg-card border border-border',
              )}
            >
              {m.content}
            </div>
            {m.proposals?.map((p, j) => (
              <Card key={j} className="flex max-w-[88%] flex-col gap-2 border-lime/40">
                <p className="text-sm font-semibold">{describe(p)}</p>
                <p className="text-xs text-muted-foreground">{p.rationale}</p>
                <Btn size="sm" onClick={() => review(p)}>
                  Review and sign
                </Btn>
              </Card>
            ))}
          </li>
        ))}
        {busy && <li className="text-xs text-muted-foreground">Thinking...</li>}
      </ul>

      {error && (
        <p role="alert" className="rounded-xl bg-down/10 p-3 text-xs text-down">
          {error}
        </p>
      )}
      <div ref={endRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
        className="sticky bottom-24 mt-auto flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault()
          }}
          placeholder={auth.connected ? 'Ask anything...' : 'Sign in for personal answers, or ask in general'}
          aria-label="Message"
          maxLength={500}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="flex size-10 items-center justify-center rounded-full bg-lime text-primary-foreground disabled:opacity-40"
        >
          <SendHorizontal className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  )
}
