'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { TxRequest } from '@/lib/squeek/types'

export type TabId = 'home' | 'squeeks' | 'apps' | 'merge' | 'plan'

export type SheetState =
  | { type: 'auth' }
  | { type: 'profile' }
  | { type: 'withdraw' }
  | { type: 'receive' }
  | { type: 'tx'; tx: TxRequest }
  | null

type UI = {
  tab: TabId
  setTab: (t: TabId) => void
  sheet: SheetState
  openSheet: (s: NonNullable<SheetState>) => void
  closeSheet: () => void
}

const Ctx = createContext<UI | null>(null)

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<TabId>('home')
  const [sheet, setSheet] = useState<SheetState>(null)
  const openSheet = useCallback((s: NonNullable<SheetState>) => setSheet(s), [])
  const closeSheet = useCallback(() => setSheet(null), [])
  const value = useMemo(
    () => ({ tab, setTab, sheet, openSheet, closeSheet }),
    [tab, sheet, openSheet, closeSheet],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useUI(): UI {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useUI must be used inside UIProvider')
  return ctx
}
