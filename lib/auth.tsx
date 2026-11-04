'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useAccount, useDisconnect } from 'wagmi'
import { ACTIVE_CHAIN } from '@/lib/squeek/config'
import { shortAddr } from '@/lib/squeek/format'

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID
export const PRIVY_ENABLED = Boolean(PRIVY_APP_ID)

export type AuthInfo = {
  ready: boolean
  connected: boolean
  address?: `0x${string}`
  label?: string
  method?: 'privy' | 'wallet'
  wrongChain: boolean
  logout: () => Promise<void> | void
}

function usePrivyAuth(): AuthInfo {
  const { ready, authenticated, logout, user } = usePrivy()
  const { address, isConnected, chainId } = useAccount()
  const connected = authenticated && isConnected && Boolean(address)
  const label =
    user?.email?.address ??
    user?.google?.email ??
    (user?.twitter?.username ? `@${user.twitter.username}` : undefined) ??
    (address ? shortAddr(address) : undefined)
  return {
    ready,
    connected,
    address: connected ? address : undefined,
    label,
    method: 'privy',
    wrongChain: connected && chainId !== ACTIVE_CHAIN.id,
    logout,
  }
}

function useInjectedAuth(): AuthInfo {
  const { address, isConnected, chainId, status } = useAccount()
  const { disconnect } = useDisconnect()
  return {
    ready: status !== 'reconnecting' && status !== 'connecting',
    connected: isConnected && Boolean(address),
    address: isConnected ? address : undefined,
    label: address ? shortAddr(address) : undefined,
    method: 'wallet',
    wrongChain: isConnected && chainId !== ACTIVE_CHAIN.id,
    logout: () => disconnect(),
  }
}

// PRIVY_ENABLED is a build-time constant, so the same hook runs on every render.
export const useAuth: () => AuthInfo = PRIVY_ENABLED ? usePrivyAuth : useInjectedAuth
