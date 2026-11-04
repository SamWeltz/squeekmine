'use client'

import { Btn, EmptyState } from '@/components/kit'
import { useUI } from '@/lib/ui-context'

export function ConnectPrompt({ what }: { what: string }) {
  const { openSheet } = useUI()
  return (
    <EmptyState
      title="Sign in to continue"
      body={`Connect a wallet on Sepolia testnet to ${what}.`}
      action={<Btn size="sm" onClick={() => openSheet({ type: 'auth' })}>Sign in</Btn>}
    />
  )
}
