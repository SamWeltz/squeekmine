'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useEffect } from 'react'
import { useConnect } from 'wagmi'
import { Btn, TestnetBadge } from '@/components/kit'
import { Sheet } from '@/components/sheet'
import { PRIVY_ENABLED, useAuth } from '@/lib/auth'
import { useUI } from '@/lib/ui-context'

function CloseWhenConnected() {
  const { connected } = useAuth()
  const { closeSheet } = useUI()
  useEffect(() => {
    if (connected) closeSheet()
  }, [connected, closeSheet])
  return null
}

function PrivyOptions() {
  const { login } = usePrivy()
  return (
    <div className="flex flex-col gap-3">
      <Btn onClick={() => login({ loginMethods: ['email', 'google', 'twitter'] })}>Continue with email, Google or X</Btn>
      <Btn variant="secondary" onClick={() => login({ loginMethods: ['wallet'] })}>
        Connect a wallet
      </Btn>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Social sign-in creates an embedded wallet for you. Connecting an existing wallet keeps your keys with that wallet.
      </p>
    </div>
  )
}

function InjectedOptions() {
  const { connectors, connect, isPending, error } = useConnect()
  return (
    <div className="flex flex-col gap-3">
      {connectors.map((c) => (
        <Btn key={c.uid} onClick={() => connect({ connector: c })} loading={isPending}>
          Connect {c.name}
        </Btn>
      ))}
      {error && <p role="alert" className="text-xs text-down">{error.message.slice(0, 160)}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Email and social sign-in turns on when a Privy app ID is added to this project. Until then, connect a browser wallet
        such as MetaMask on Sepolia.
      </p>
    </div>
  )
}

export function AuthSheet() {
  const { closeSheet } = useUI()
  return (
    <Sheet title="Sign in" onClose={closeSheet}>
      <CloseWhenConnected />
      <div className="mb-4 flex items-center gap-2">
        <TestnetBadge />
        <span className="text-xs text-muted-foreground">Sepolia testnet only. Use faucet ETH.</span>
      </div>
      {PRIVY_ENABLED ? <PrivyOptions /> : <InjectedOptions />}
    </Sheet>
  )
}
