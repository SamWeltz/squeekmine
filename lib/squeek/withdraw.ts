import { ACTIVE_CHAIN, NETWORK_LABEL } from './config'

export type WithdrawalRequest = {
  address: string
  to: string
  amount: string
  nonce: string
  expiresAt: number
}

/** The exact text the owner signs. The server rebuilds it from fields, never trusts client text. */
export function buildWithdrawalMessage(r: WithdrawalRequest): string {
  return [
    'Squeekchain testnet withdrawal request',
    `Network: ${NETWORK_LABEL} (${ACTIVE_CHAIN.id})`,
    'Token: SQK',
    `From: ${r.address.toLowerCase()}`,
    `To: ${r.to.toLowerCase()}`,
    `Amount: ${r.amount}`,
    `Nonce: ${r.nonce}`,
    `Expires: ${new Date(r.expiresAt).toISOString()}`,
  ].join('\n')
}
