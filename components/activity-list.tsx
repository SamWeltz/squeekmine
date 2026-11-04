'use client'

import { ArrowDownLeft, ArrowUpRight, Coins, Flame, Sparkles } from 'lucide-react'
import { EmptyState } from '@/components/kit'
import { txUrl } from '@/lib/squeek/config'
import { formatSqk, timeAgo } from '@/lib/squeek/format'
import type { ActivityItem } from '@/lib/squeek/types'

const ICONS: Record<ActivityItem['kind'], React.ComponentType<{ className?: string }>> = {
  mint: Sparkles,
  received: ArrowDownLeft,
  sent: ArrowUpRight,
  burn: Flame,
  sqk_in: ArrowDownLeft,
  sqk_out: ArrowUpRight,
  claim: Coins,
}

export function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="No activity yet" body="Mints, claims, merges and transfers for this wallet will show up here." />
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((item) => {
        const Icon = ICONS[item.kind]
        const incoming = item.kind === 'sqk_in' || item.kind === 'claim'
        return (
          <li key={item.id}>
            <a href={txUrl(item.tx)} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.detail} · {timeAgo(item.timestamp)}
                </span>
              </span>
              {item.amount && (
                <span className={`text-sm font-semibold ${incoming ? 'text-up' : ''}`}>
                  {incoming ? '+' : '-'}
                  {formatSqk(item.amount, 2)}
                </span>
              )}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
