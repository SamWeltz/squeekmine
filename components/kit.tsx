'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4', className)} {...props}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</h2>
      {right}
    </div>
  )
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  loading?: boolean
}

export function Btn({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: BtnProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50',
        size === 'md' ? 'h-12 px-6 text-sm' : 'h-9 px-4 text-xs',
        variant === 'primary' && 'bg-lime text-primary-foreground hover:brightness-110',
        variant === 'secondary' && 'border border-border bg-secondary text-foreground hover:bg-muted',
        variant === 'ghost' && 'text-muted-foreground hover:text-foreground',
        variant === 'danger' && 'bg-down text-white hover:brightness-110',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function Badge({
  tone = 'muted',
  children,
  className,
}: {
  tone?: 'up' | 'warn' | 'down' | 'muted' | 'lime'
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        tone === 'up' && 'bg-up/15 text-up',
        tone === 'warn' && 'bg-warn/15 text-warn',
        tone === 'down' && 'bg-down/15 text-down',
        tone === 'lime' && 'bg-lime/15 text-lime',
        tone === 'muted' && 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function TestnetBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-warn',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-warn" aria-hidden />
      Testnet
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted', className)} aria-hidden />
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-down/40" role="alert">
      <p className="text-sm font-semibold text-down">Could not load chain data</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{message}</p>
      {onRetry && (
        <Btn variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Btn>
      )}
    </Card>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-[28ch] text-xs leading-relaxed text-muted-foreground">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Deterministic decorative face per token ID. Not the on-chain artwork. */
export function SqueekAvatar({ tokenId, className }: { tokenId: string; className?: string }) {
  const n = Number(BigInt(tokenId) % 360n)
  const hue = (n * 47) % 360
  return (
    <svg viewBox="0 0 40 40" className={cn('size-12 shrink-0 rounded-xl', className)} role="img" aria-label={`Squeek ${tokenId} avatar`}>
      <rect width="40" height="40" fill={`hsl(${hue} 60% 22%)`} />
      <circle cx="20" cy="21" r="12" fill={`hsl(${hue} 85% 62%)`} />
      <circle cx="15.5" cy="19" r="2" fill="#0b0b0c" />
      <circle cx="24.5" cy="19" r="2" fill="#0b0b0c" />
      <path d="M15 25 Q20 29 25 25" stroke="#0b0b0c" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}
