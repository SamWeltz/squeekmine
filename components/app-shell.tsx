'use client'

import { Bot, GitMerge, Home, LineChart, Rat, TriangleAlert, User } from 'lucide-react'
import { AuthSheet } from '@/components/sheets/auth-sheet'
import { ProfileSheet, ReceiveSheet } from '@/components/sheets/profile-sheet'
import { TxSheet } from '@/components/sheets/tx-sheet'
import { WithdrawSheet } from '@/components/sheets/withdraw-sheet'
import { AiTab } from '@/components/tabs/ai-tab'
import { HomeTab } from '@/components/tabs/home-tab'
import { MergeTab } from '@/components/tabs/merge-tab'
import { PlanTab } from '@/components/tabs/plan-tab'
import { SqueeksTab } from '@/components/tabs/squeeks-tab'
import { TestnetBadge } from '@/components/kit'
import { useAuth } from '@/lib/auth'
import { useUI, type TabId } from '@/lib/ui-context'
import { useSwitchChain } from 'wagmi'
import { ACTIVE_CHAIN, NETWORK_LABEL } from '@/lib/squeek/config'
import { cn } from '@/lib/utils'

const TABS: { id: TabId; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'squeeks', label: 'Squeeks', Icon: Rat },
  { id: 'merge', label: 'Merge', Icon: GitMerge },
  { id: 'plan', label: 'Plan', Icon: LineChart },
  { id: 'ai', label: 'Ask', Icon: Bot },
]

function Header() {
  const auth = useAuth()
  const { openSheet } = useUI()
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold tracking-tight">Squeekchain</span>
        <TestnetBadge />
      </div>
      {auth.connected ? (
        <button
          type="button"
          onClick={() => openSheet({ type: 'profile' })}
          className="flex h-9 items-center gap-2 rounded-full border border-border bg-secondary pl-3 pr-1.5 text-xs font-medium"
        >
          <span className="max-w-[120px] truncate">{auth.label}</span>
          <span className="flex size-6 items-center justify-center rounded-full bg-muted">
            <User className="size-3.5" aria-hidden />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => openSheet({ type: 'auth' })}
          disabled={!auth.ready}
          className="h-9 rounded-full bg-lime px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          Sign in
        </button>
      )}
    </header>
  )
}

function WrongNetworkBanner() {
  const auth = useAuth()
  const { switchChain, isPending } = useSwitchChain()
  if (!auth.wrongChain) return null
  return (
    <div role="alert" className="flex items-center gap-3 border-b border-warn/40 bg-warn/10 px-5 py-2.5 text-xs text-warn">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">Your wallet is on the wrong network. This app only works on {NETWORK_LABEL}.</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => switchChain({ chainId: ACTIVE_CHAIN.id })}
        className="rounded-full bg-warn px-3 py-1 font-semibold text-primary-foreground"
      >
        Switch
      </button>
    </div>
  )
}

function Sheets() {
  const { sheet } = useUI()
  if (!sheet) return null
  switch (sheet.type) {
    case 'auth':
      return <AuthSheet />
    case 'profile':
      return <ProfileSheet />
    case 'receive':
      return <ReceiveSheet />
    case 'withdraw':
      return <WithdrawSheet />
    case 'tx':
      return <TxSheet tx={sheet.tx} />
  }
}

export function AppShell() {
  const { tab, setTab } = useUI()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <Header />
      <WrongNetworkBanner />
      <main className="flex-1 px-5 pb-32 pt-5">
        {tab === 'home' && <HomeTab />}
        {tab === 'squeeks' && <SqueeksTab />}
        {tab === 'merge' && <MergeTab />}
        {tab === 'plan' && <PlanTab />}
        {tab === 'ai' && <AiTab />}
      </main>
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t border-border bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={cn(
              'flex min-w-14 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium',
              tab === id ? 'text-lime' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        ))}
      </nav>
      <Sheets />
    </div>
  )
}
