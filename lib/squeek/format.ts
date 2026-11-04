import { formatUnits } from 'viem'
import { TOKEN_DECIMALS } from './config'

export function sqkToNumber(wei: string | bigint): number {
  return Number(formatUnits(BigInt(wei), TOKEN_DECIMALS))
}

export function formatNumber(n: number, dp = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export function formatSqk(wei: string | bigint, dp = 2): string {
  return formatNumber(sqkToNumber(wei), dp)
}

export function formatCompact(n: number): string {
  return n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })
}

export function shortAddr(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address
}

export function timeAgo(unixSeconds: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function blocksToDuration(blocks: number, blocksPerDay: number): string {
  if (!blocksPerDay || blocksPerDay <= 0) return 'unknown'
  const hours = (blocks / blocksPerDay) * 24
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 48) return `${hours.toFixed(1)} h`
  return `${(hours / 24).toFixed(1)} days`
}
