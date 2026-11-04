import { sqkToNumber } from './format'
import type { NetworkStats, SqueekPosition } from './types'

export type MergeState = 'ready' | 'activating' | 'cooldown' | 'max'

export function mergeState(
  p: SqueekPosition,
  completedBlocks: string,
  maximumLevel: number,
): { state: MergeState; blocksLeft: number } {
  if (BigInt(p.pendingWeight) > 0n) return { state: 'activating', blocksLeft: 0 }
  if (p.level >= maximumLevel) return { state: 'max', blocksLeft: 0 }
  const left = BigInt(p.nextMergeBlock) - BigInt(completedBlocks)
  if (left > 0n) return { state: 'cooldown', blocksLeft: Number(left) }
  return { state: 'ready', blocksLeft: 0 }
}

export function miningLabel(p: SqueekPosition): { label: string; tone: 'up' | 'warn' | 'muted' } {
  const active = BigInt(p.activeWeight) > 0n
  const pending = BigInt(p.pendingWeight) > 0n
  if (active && pending) return { label: 'Earning, new power pending', tone: 'warn' }
  if (active) return { label: 'Earning', tone: 'up' }
  if (pending) return { label: 'Activating', tone: 'warn' }
  return { label: 'Not earning', tone: 'muted' }
}

export function weightOf(network: NetworkStats, level: number): number {
  const l = network.levels.find((x) => x.level === level)
  return l ? Number(l.weight) : 0
}

export type LevelCounts = Record<number, number>

export function countsFromSqueeks(squeeks: SqueekPosition[]): LevelCounts {
  const counts: LevelCounts = {}
  for (const s of squeeks) counts[s.level] = (counts[s.level] ?? 0) + 1
  return counts
}

export type PlanResult = {
  id: string
  name: string
  description: string
  squeeks: number
  merges: number
  power: number
  sharePct: number
  sqkPerDay: number
  deltaPerDay: number
  counts: LevelCounts
}

/** Merge pairs bottom-up, never above targetLevel. Returns the new counts and merge count. */
export function applyMerges(
  counts: LevelCounts,
  targetLevel: number,
  maximumLevel: number,
  cascade: boolean,
): { counts: LevelCounts; merges: number } {
  const next: LevelCounts = { ...counts }
  let merges = 0
  const cap = Math.min(targetLevel, maximumLevel)
  for (let level = 1; level < cap; level++) {
    const have = next[level] ?? 0
    const pairs = Math.floor(have / 2)
    if (pairs === 0) continue
    next[level] = have - pairs * 2
    next[level + 1] = (next[level + 1] ?? 0) + pairs
    merges += pairs
    if (!cascade) {
      // One pass: Squeeks produced by this pass must not merge again in the same pass.
      // Track by deferring: handled by caller using snapshot of counts.
    }
  }
  return { counts: next, merges }
}

/** Single pass: every pair at each level merges once, using the starting counts only. */
export function mergeOnePass(
  counts: LevelCounts,
  maximumLevel: number,
): { counts: LevelCounts; merges: number } {
  const next: LevelCounts = { ...counts }
  let merges = 0
  for (let level = 1; level < maximumLevel; level++) {
    const have = counts[level] ?? 0
    const pairs = Math.floor(have / 2)
    if (pairs === 0) continue
    next[level] = (next[level] ?? 0) - pairs * 2
    next[level + 1] = (next[level + 1] ?? 0) + pairs
    merges += pairs
  }
  return { counts: next, merges }
}

export function totalPower(counts: LevelCounts, network: NetworkStats): number {
  return Object.entries(counts).reduce((t, [lvl, n]) => t + weightOf(network, Number(lvl)) * n, 0)
}

export function totalCount(counts: LevelCounts): number {
  return Object.values(counts).reduce((t, n) => t + n, 0)
}

/**
 * estimated SQK/day = REWARD_PER_BLOCK x blocksPerDay x myPower / (othersPower + myPower)
 * othersPower = totalPower on chain minus the user's current active power.
 */
export function estimatePerDay(
  network: NetworkStats,
  myPower: number,
  othersPower: number,
): number {
  const reward = sqkToNumber(network.rewardPerBlock)
  const denom = othersPower + myPower
  if (denom <= 0) return 0
  return reward * network.blocksPerDay * (myPower / denom)
}

export function buildPlans(
  network: NetworkStats,
  counts: LevelCounts,
  currentActivePower: number,
  targetLevel: number,
): PlanResult[] {
  const totalWeight = Number(network.totalWeight)
  const others = Math.max(0, totalWeight - currentActivePower)
  const holdPower = totalPower(counts, network)
  const holdPerDay = estimatePerDay(network, holdPower, others)

  const make = (
    id: string,
    name: string,
    description: string,
    next: LevelCounts,
    merges: number,
  ): PlanResult => {
    const power = totalPower(next, network)
    const perDay = estimatePerDay(network, power, others)
    return {
      id,
      name,
      description,
      squeeks: totalCount(next),
      merges,
      power,
      sharePct: power + others > 0 ? (power / (power + others)) * 100 : 0,
      sqkPerDay: perDay,
      deltaPerDay: perDay - holdPerDay,
      counts: next,
    }
  }

  const once = mergeOnePass(counts, network.maximumLevel)
  const toTarget = applyMerges(counts, targetLevel, network.maximumLevel, true)

  return [
    make('hold', 'Hold', 'Keep every Squeek as it is.', counts, 0),
    make('once', 'Merge once', 'Merge every available pair one level up, one pass.', once.counts, once.merges),
    make(
      'target',
      `Merge up to level ${targetLevel}`,
      `Keep merging pairs bottom-up until nothing can reach above level ${targetLevel}.`,
      toTarget.counts,
      toTarget.merges,
    ),
  ]
}
