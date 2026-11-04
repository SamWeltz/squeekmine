'use client'

import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Btn, TestnetBadge } from '@/components/kit'
import { Sheet } from '@/components/sheet'
import { useAuth } from '@/lib/auth'
import { NETWORK_LABEL, addressUrl } from '@/lib/squeek/config'
import { useUI } from '@/lib/ui-context'

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-secondary p-3 text-left"
    >
      <span className="break-all font-mono text-xs">{address}</span>
      {copied ? <Check className="size-4 shrink-0 text-up" aria-hidden /> : <Copy className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
      <span className="sr-only">{copied ? 'Copied' : 'Copy address'}</span>
    </button>
  )
}

export function ProfileSheet() {
  const { closeSheet } = useUI()
  const auth = useAuth()
  return (
    <Sheet title="Account" onClose={closeSheet}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TestnetBadge />
          <span className="text-xs text-muted-foreground">{NETWORK_LABEL}</span>
        </div>
        {auth.label && <p className="text-sm font-medium">{auth.label}</p>}
        {auth.address && (
          <>
            <CopyAddress address={auth.address} />
            <a href={addressUrl(auth.address)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground underline">
              View on explorer <ExternalLink className="size-3" aria-hidden />
            </a>
          </>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Non-custodial. Keys never touch this app&apos;s code or servers, and every transaction is signed in your wallet.
        </p>
        <Btn
          variant="secondary"
          onClick={async () => {
            await auth.logout()
            closeSheet()
          }}
        >
          Sign out
        </Btn>
      </div>
    </Sheet>
  )
}

export function ReceiveSheet() {
  const { closeSheet } = useUI()
  const auth = useAuth()
  return (
    <Sheet title="Receive" onClose={closeSheet}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TestnetBadge />
          <span className="text-xs text-muted-foreground">Only send Sepolia testnet assets here.</span>
        </div>
        {auth.address ? <CopyAddress address={auth.address} /> : <p className="text-sm text-muted-foreground">Sign in to see your address.</p>}
        <p className="text-xs leading-relaxed text-muted-foreground">
          You need a little Sepolia faucet ETH to pay network fees for claims and merges. Never send mainnet funds to this address.
        </p>
      </div>
    </Sheet>
  )
}
