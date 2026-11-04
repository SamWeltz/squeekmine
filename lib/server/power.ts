import type { SqueekPosition } from '@/lib/squeek/types'

export function squeekPower(squeeks: SqueekPosition[]): string {
  return squeeks.reduce((t, s) => t + BigInt(s.activeWeight), 0n).toString()
}
