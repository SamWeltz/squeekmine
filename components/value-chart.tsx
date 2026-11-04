'use client'

import { useState } from 'react'
import { Skeleton } from '@/components/kit'
import { useSnapshots } from '@/lib/hooks'
import { formatNumber } from '@/lib/squeek/format'

const W = 320
const H = 120
const PAD = 6

export function ValueChart({ address, range }: { address: string; range: string }) {
  const { data, isLoading } = useSnapshots(address, range)
  const [hover, setHover] = useState<number | null>(null)

  if (isLoading) return <Skeleton className="mt-4 h-[120px]" />

  const points = data?.points ?? []
  if (!data?.configured || points.length < 2) {
    return (
      <div className="mt-4 flex h-[120px] items-center justify-center rounded-xl border border-dashed border-border px-6 text-center text-xs leading-relaxed text-muted-foreground">
        {data?.configured === false
          ? 'History needs the database integration. Balances above are live from the chain.'
          : 'History builds up as you visit, one snapshot per hour. Check back soon.'}
      </div>
    )
  }

  const t0 = points[0].t
  const t1 = points[points.length - 1].t
  const vs = points.map((p) => p.v)
  const min = Math.min(...vs)
  const max = Math.max(...vs)
  const span = max - min || 1
  const x = (t: number) => PAD + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD * 2)
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const active = hover !== null ? points[hover] : null
  const change = points[points.length - 1].v - points[0].v

  return (
    <div className="mt-4">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">
          {active ? new Date(active.t * 1000).toLocaleString() : `${range} change`}
        </span>
        <span className={change >= 0 ? 'font-semibold text-up' : 'font-semibold text-down'}>
          {active ? `${formatNumber(active.v, 2)} SQK` : `${change >= 0 ? '+' : ''}${formatNumber(change, 2)} SQK`}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[120px] w-full touch-none"
        role="img"
        aria-label={`SQK total over ${range}, changed by ${formatNumber(change, 2)}`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const t = t0 + ((e.clientX - rect.left) / rect.width) * (t1 - t0)
          let best = 0
          points.forEach((p, i) => {
            if (Math.abs(p.t - t) < Math.abs(points[best].t - t)) best = i
          })
          setHover(best)
        }}
      >
        <path d={path} fill="none" stroke="#c8ff3d" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {active && <circle cx={x(active.t)} cy={y(active.v)} r="4" fill="#c8ff3d" />}
      </svg>
    </div>
  )
}
