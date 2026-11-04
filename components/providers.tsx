'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider as PrivyWagmiProvider, createConfig as createPrivyConfig } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { PRIVY_APP_ID } from '@/lib/auth'
import { ACTIVE_CHAIN } from '@/lib/squeek/config'
import { UIProvider } from '@/lib/ui-context'

// Client transport uses the wallet/public RPC only. Provider-keyed RPC stays on the server.
const transports = { [ACTIVE_CHAIN.id]: http() } as const

const privyWagmiConfig = PRIVY_APP_ID
  ? createPrivyConfig({ chains: [ACTIVE_CHAIN], transports })
  : null

const injectedWagmiConfig = createConfig({
  chains: [ACTIVE_CHAIN],
  connectors: [injected()],
  transports,
  ssr: true,
})

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  if (PRIVY_APP_ID && privyWagmiConfig) {
    return (
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ['email', 'google', 'twitter', 'wallet'],
          defaultChain: ACTIVE_CHAIN,
          supportedChains: [ACTIVE_CHAIN],
          embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
          appearance: { theme: 'dark', accentColor: '#c8ff3d' },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <PrivyWagmiProvider config={privyWagmiConfig}>
            <UIProvider>{children}</UIProvider>
          </PrivyWagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={injectedWagmiConfig}>
        <UIProvider>{children}</UIProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
