'use client'

import { CheckCircle2, ExternalLink, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { formatEther } from 'viem'
import { useAccount, usePublicClient, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { Btn, TestnetBadge } from '@/components/kit'
import { Sheet } from '@/components/sheet'
import { ACTIVE_CHAIN, NETWORK_LABEL, txUrl } from '@/lib/squeek/config'
import type { TxRequest } from '@/lib/squeek/types'
import { useUI } from '@/lib/ui-context'

type Sim = { ok: true; gas: bigint; fee: bigint } | { ok: false; reason: string }

function reasonOf(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string; cause?: { data?: { errorName?: string } } }
  const name = err.cause?.data?.errorName
  if (name) return `Contract rejected this: ${name}`
  return (err.shortMessage ?? err.message ?? 'Simulation failed').slice(0, 200)
}

export function TxSheet({ tx }: { tx: TxRequest }) {
  const { closeSheet } = useUI()
  const { mutate } = useSWRConfig()
  const { address, chainId } = useAccount()
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN.id })
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync, isPending, error: writeError, reset } = useWriteContract()
  const [hash, setHash] = useState<`0x${string}` | undefined>()
  const receipt = useWaitForTransactionReceipt({ hash, chainId: ACTIVE_CHAIN.id })

  const simKey = address ? ['sim', address, tx.contract.address, tx.functionName, JSON.stringify(tx.args, (_, v) => (typeof v === 'bigint' ? v.toString() : v))] : null
  const { data: sim } = useSWR<Sim>(
    simKey,
    async () => {
      if (!publicClient || !address) return { ok: false, reason: 'Wallet not ready' }
      try {
        const { request } = await publicClient.simulateContract({
          account: address,
          address: tx.contract.address,
          abi: tx.abi,
          functionName: tx.functionName,
          args: tx.args,
        } as never)
        const [gas, fees] = await Promise.all([
          publicClient.estimateContractGas({
            account: address,
            address: tx.contract.address,
            abi: tx.abi,
            functionName: tx.functionName,
            args: tx.args,
          } as never),
          publicClient.estimateFeesPerGas(),
        ])
        void request
        return { ok: true, gas, fee: gas * (fees.maxFeePerGas ?? fees.gasPrice ?? 0n) }
      } catch (e) {
        return { ok: false, reason: reasonOf(e) }
      }
    },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )

  const wrongChain = chainId !== ACTIVE_CHAIN.id
  const confirmed = receipt.isSuccess && receipt.data?.status === 'success'
  const reverted = receipt.isSuccess && receipt.data?.status === 'reverted'

  async function send() {
    reset()
    try {
      if (wrongChain) await switchChainAsync({ chainId: ACTIVE_CHAIN.id })
      const h = await writeContractAsync({
        chainId: ACTIVE_CHAIN.id,
        address: tx.contract.address,
        abi: tx.abi,
        functionName: tx.functionName,
        args: tx.args,
      } as never)
      setHash(h)
    } catch {
      /* surfaced through writeError */
    }
  }

  async function done() {
    if (tx.refresh) await mutate((key) => typeof key === 'string' && key.startsWith('/api/'))
    closeSheet()
  }

  return (
    <Sheet title={tx.title} onClose={closeSheet}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TestnetBadge />
          <span className="text-xs text-muted-foreground">{NETWORK_LABEL}. No real value.</span>
        </div>

        <p className="text-sm leading-relaxed">{tx.summary}</p>

        <dl className="divide-y divide-border rounded-xl border border-border text-xs">
          <div className="flex justify-between gap-4 px-3 py-2.5">
            <dt className="text-muted-foreground">Contract</dt>
            <dd className="font-medium">{tx.contract.name}</dd>
          </div>
          <div className="flex justify-between gap-4 px-3 py-2.5">
            <dt className="text-muted-foreground">Function</dt>
            <dd className="font-mono">{tx.functionName}</dd>
          </div>
          {tx.details.map((d) => (
            <div key={d.label} className="flex justify-between gap-4 px-3 py-2.5">
              <dt className="shrink-0 text-muted-foreground">{d.label}</dt>
              <dd className="break-all text-right font-medium">{d.value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 px-3 py-2.5">
            <dt className="text-muted-foreground">Est. network fee</dt>
            <dd className="font-medium">
              {sim === undefined ? 'Estimating...' : sim.ok ? `${Number(formatEther(sim.fee)).toFixed(6)} ETH` : 'n/a'}
            </dd>
          </div>
        </dl>

        {tx.warnings?.map((w) => (
          <p key={w} className="flex gap-2 rounded-xl bg-warn/10 p-3 text-xs leading-relaxed text-warn">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {w}
          </p>
        ))}

        {sim && !sim.ok && (
          <p role="alert" className="rounded-xl bg-down/10 p-3 text-xs leading-relaxed text-down">
            Simulation failed, so this would revert. {sim.reason}
          </p>
        )}
        {writeError && (
          <p role="alert" className="rounded-xl bg-down/10 p-3 text-xs leading-relaxed text-down">
            {reasonOf(writeError)}
          </p>
        )}
        {reverted && (
          <p role="alert" className="rounded-xl bg-down/10 p-3 text-xs text-down">
            The transaction was mined but reverted.
          </p>
        )}

        {confirmed ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-up">
              <CheckCircle2 className="size-5" aria-hidden /> Confirmed on {NETWORK_LABEL}
            </p>
            {hash && (
              <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground underline">
                View on explorer <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
            <Btn onClick={done}>Done</Btn>
          </div>
        ) : hash ? (
          <div className="flex flex-col gap-2">
            <Btn loading disabled>
              Confirming on-chain
            </Btn>
            <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="text-center text-xs text-muted-foreground underline">
              View pending transaction
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Btn onClick={send} loading={isPending} disabled={!sim || !sim.ok}>
              {wrongChain ? 'Switch to Sepolia and sign' : 'Sign in wallet'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={closeSheet}>
              Cancel
            </Btn>
          </div>
        )}
        <p className="text-center text-[11px] text-muted-foreground">
          You always sign in your own wallet. This app never holds your keys.
        </p>
      </div>
    </Sheet>
  )
}
