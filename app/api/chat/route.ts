import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { describeAccountForAi, parseAddress, readAccount } from '@/lib/server/chain'
import { mergeState } from '@/lib/squeek/planner'
import type { AccountData, Proposal } from '@/lib/squeek/types'

export const maxDuration = 60

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'

const SYSTEM = `You are the assistant inside a Squeekchain mining companion app. Everything runs on the Sepolia TESTNET and SQK has no monetary value.
Facts about the deployment you must respect:
- There is no staking or unstaking. A Squeek earns automatically once its power is active; new power starts earning from the round after a mint or merge.
- Owners can claim SQK, merge two Squeeks of the same level (the donor is burned permanently), and anyone can run a checkpoint to process settled rounds.
- A merge needs both Squeeks at the same level below the maximum, with no pending power and merge cooldown elapsed.
- You can never sign or send transactions. To suggest an action, call the propose_action tool; the user reviews a simulation and signs in their own wallet.
- Never ask for or mention private keys or seed phrases. Never invent numbers; use only the account data below. Reward estimates are estimates.
Keep answers short, plain and specific. Always say "testnet" when discussing value.`

const tools: Anthropic.Tool[] = [
  {
    name: 'propose_action',
    description:
      'Propose one on-chain action for the user to review and sign. Use claim for unclaimed SQK, checkpoint to process settled rounds, merge to combine two same-level Squeeks.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['claim', 'checkpoint', 'merge'] },
        token_ids: { type: 'array', items: { type: 'string' }, description: 'For claim: Squeek IDs to claim.' },
        survivor_id: { type: 'string', description: 'For merge: the Squeek that is kept.' },
        donor_id: { type: 'string', description: 'For merge: the Squeek that is burned.' },
        rationale: { type: 'string', description: 'One short sentence on why.' },
      },
      required: ['action', 'rationale'],
    },
  },
]

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function validate(
  input: Record<string, unknown>,
  account: AccountData | null,
): Proposal | null {
  const action = input.action
  const rationale = String(input.rationale ?? '').slice(0, 300)
  if (action === 'checkpoint') return { action, rationale }
  if (!account) return null
  const byId = new Map(account.squeeks.map((s) => [s.tokenId, s]))
  const max = account.network.maximumLevel

  if (action === 'claim') {
    const ids = Array.isArray(input.token_ids) ? input.token_ids.map(String) : []
    const owned = [...new Set(ids)].filter((id) => byId.has(id) && BigInt(byId.get(id)!.claimable) > 0n)
    if (owned.length === 0) return null
    owned.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))
    return { action, tokenIds: owned.slice(0, 32), rationale }
  }

  if (action === 'merge') {
    const survivor = byId.get(String(input.survivor_id))
    const donor = byId.get(String(input.donor_id))
    if (!survivor || !donor || survivor.tokenId === donor.tokenId) return null
    if (survivor.level !== donor.level) return null
    const a = mergeState(survivor, account.network.completedBlocks, max)
    const b = mergeState(donor, account.network.completedBlocks, max)
    if (a.state !== 'ready' || b.state !== 'ready') return null
    return { action, survivorId: survivor.tokenId, donorId: donor.tokenId, rationale }
  }
  return null
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'The assistant needs ANTHROPIC_API_KEY to be configured on the server.' },
      { status: 503 },
    )
  }

  let body: { address?: string; messages?: ChatMessage[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const messages = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'No question provided' }, { status: 400 })
  }

  const address = parseAddress(body.address ?? null)
  let account: AccountData | null = null
  let context = 'The user has not connected a wallet yet. You cannot propose claim or merge actions.'
  if (address) {
    try {
      account = await readAccount(address)
      context = describeAccountForAi(account)
    } catch {
      context = 'Live account data could not be loaded right now. Say so if the user asks about their holdings.'
    }
  }

  const anthropic = new Anthropic()
  const system = `${SYSTEM}\n\nLIVE ACCOUNT DATA:\n${context}`
  const proposals: Proposal[] = []

  try {
    let convo: Anthropic.MessageParam[] = messages
    let text = ''
    for (let turn = 0; turn < 3; turn++) {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 900,
        system,
        tools,
        messages: convo,
      })
      text += res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
      const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      if (res.stop_reason !== 'tool_use' || toolUses.length === 0) break

      const results: Anthropic.ToolResultBlockParam[] = toolUses.map((tu) => {
        const proposal = validate(tu.input as Record<string, unknown>, account)
        if (proposal) proposals.push(proposal)
        return {
          type: 'tool_result',
          tool_use_id: tu.id,
          content: proposal
            ? 'Shown to the user as a card. They must review the simulation and sign in their own wallet.'
            : 'Rejected: invalid or not currently possible for this wallet. Do not retry the same input.',
          is_error: !proposal,
        }
      })
      convo = [...convo, { role: 'assistant', content: res.content }, { role: 'user', content: results }]
    }
    return NextResponse.json({ text: text.trim() || 'Done.', proposals: proposals.slice(0, 3) })
  } catch (e) {
    console.log('[v0] chat error:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'The assistant is unavailable right now.' }, { status: 502 })
  }
}
