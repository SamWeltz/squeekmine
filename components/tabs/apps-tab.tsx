'use client'

import { ArrowUpRight, BookOpen, Code2, Gamepad2, Handshake, Layers, Rat, ShieldAlert, Wrench } from 'lucide-react'
import { Badge, Card, SectionTitle } from '@/components/kit'

type AppLink = { label: string; href: string }

type EcosystemApp = {
  name: string
  kind: string
  summary: string
  Icon: React.ComponentType<{ className?: string }>
  needsWallet: boolean
  links: AppLink[]
}

const APPS: EcosystemApp[] = [
  {
    name: 'SqueekMatch',
    kind: 'Merge partners and P2P market',
    summary:
      'Finds the missing partner for your next merge. Shows your single Squeeks, plans the cheapest purchases that unlock merges, and trades through an ownerless, fee-free escrow contract.',
    Icon: Handshake,
    needsWallet: true,
    links: [
      { label: 'Open app', href: 'https://squeekmatch.xyz' },
      { label: 'Source', href: 'https://github.com/Eldermajestic/squeekmatch' },
    ],
  },
  {
    name: 'Squeek Keeper Console',
    kind: 'Checkpoints and staking',
    summary:
      'A transaction-first companion for keeper duties: running mining checkpoints and managing SQK and Squeek NFT staking from a browser wallet. Every main action is a wallet transaction.',
    Icon: Wrench,
    needsWallet: true,
    links: [
      {
        label: 'Source',
        href: 'https://github.com/identity-md-launches/launch-2764-squeek-keeper-console-transaction-first',
      },
    ],
  },
  {
    name: 'Squeek Runner',
    kind: 'Arcade game',
    summary:
      'A lane-crossing arcade game whose pace comes from the hamster\u2019s settled work, read straight from SqueekCore on Sepolia. No wallet needed to play.',
    Icon: Gamepad2,
    needsWallet: false,
    links: [{ label: 'Source', href: 'https://github.com/zalana28/squeek-runner' }],
  },
  {
    name: 'Hamster Companion',
    kind: 'Virtual pet',
    summary:
      'A 3D virtual hamster you can feed, care for and play with. It reacts to Squeekchain\u2019s public wheel telemetry. Bilingual, and it never asks for a wallet or a transaction.',
    Icon: Rat,
    needsWallet: false,
    links: [
      { label: 'Open app', href: 'https://hamster.imdember.com/' },
      { label: 'Source', href: 'https://github.com/tungweb3/squeekchain-hamster-companion' },
    ],
  },
]

const OFFICIAL: { label: string; note: string; href: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  {
    label: 'SqueekFi',
    note: 'Ideas for onchain finance built on the work record',
    href: 'https://docs.squeekchain.com/rewards/squeekfi',
    Icon: Layers,
  },
  {
    label: 'Developer docs',
    note: 'Contracts, ABIs and integration rules',
    href: 'https://docs.squeekchain.com/developers',
    Icon: BookOpen,
  },
  {
    label: 'Public API',
    note: 'Read-only JSON, for display only',
    href: 'https://docs.squeekchain.com/developers/api',
    Icon: Code2,
  },
]

function ExternalLink({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  const isGithub = href.startsWith('https://github.com')
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        primary
          ? 'inline-flex h-9 items-center gap-1.5 rounded-full bg-lime px-4 text-xs font-semibold text-primary-foreground hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime'
          : 'inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-secondary px-4 text-xs font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime'
      }
    >
      {isGithub && <Code2 className="size-3.5" aria-hidden />}
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

export function AppsTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-balance">Ecosystem</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Community apps built on Squeekchain. Squeekchain is permissionless, so anyone can build on it.
        </p>
      </div>

      <Card className="flex gap-3 border-warn/40 bg-warn/5">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-warn">Unofficial, unreviewed, testnet only</p>
          <p className="mt-1">
            These apps are fan-made and are not endorsed or audited by Squeekchain or this app. Use Sepolia faucet ETH
            only. Never enter a seed phrase or private key. Before you sign anything in another app, check that the
            contract addresses match the{' '}
            <a
              href="https://docs.squeekchain.com/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              official deployment record
            </a>
            .
          </p>
        </div>
      </Card>

      <section aria-labelledby="community-apps">
        <SectionTitle>
          <span id="community-apps">Community apps</span>
        </SectionTitle>
        <ul className="flex flex-col gap-3">
          {APPS.map((app) => (
            <li key={app.name}>
              <Card className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-lime">
                    <app.Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">{app.name}</h3>
                    <p className="text-xs text-muted-foreground">{app.kind}</p>
                  </div>
                  <Badge tone={app.needsWallet ? 'warn' : 'up'}>{app.needsWallet ? 'Wallet txs' : 'No wallet'}</Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{app.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {app.links.map((l, i) => (
                    <ExternalLink key={l.href} href={l.href} primary={i === 0 && l.label === 'Open app'}>
                      {l.label}
                    </ExternalLink>
                  ))}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="official-resources">
        <SectionTitle>
          <span id="official-resources">Build your own</span>
        </SectionTitle>
        <ul className="flex flex-col gap-2">
          {OFFICIAL.map((r) => (
            <li key={r.href}>
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
              >
                <r.Icon className="size-5 shrink-0 text-lime" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">{r.note}</span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
