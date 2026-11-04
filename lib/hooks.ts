'use client'

import useSWR from 'swr'
import type { AccountData, NetworkStats } from '@/lib/squeek/types'

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Request failed')
  return json as T
}

export const accountKey = (address?: string) => (address ? `/api/account?address=${address}` : null)

export function useAccountData(address?: string) {
  return useSWR<AccountData>(accountKey(address), fetcher, {
    refreshInterval: 45_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  })
}

export function useNetwork() {
  return useSWR<NetworkStats>('/api/network', fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  })
}

export type SnapshotResponse = {
  configured: boolean
  points: { t: number; v: number; squeeks: number }[]
}

export function useSnapshots(address: string | undefined, range: string) {
  return useSWR<SnapshotResponse>(
    address ? `/api/snapshots?address=${address}&range=${range}` : null,
    fetcher,
    { revalidateOnFocus: false },
  )
}
