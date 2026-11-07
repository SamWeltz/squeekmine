import { parseAbi } from 'viem'

/**
 * Minimal ABIs written from the official Squeekchain docs for release core-sepolia-20261103
 * (docs.squeekchain.com/developers/). Only the functions and events this app uses.
 * The full published ABIs live at docs.squeekchain.com/assets/abi/*.json if more is needed.
 */

export const coreAbi = parseAbi([
  'function state() view returns ((uint64 settledThroughRound, uint64 cumulativeWork, uint96 cumulativeBlockUnits, uint64 blockHeight, uint96 blockProgress, uint32 workPerThousandBlocks, uint256 authorizationNonce, bool paused))',
])

export const nftAbi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function level(uint256 tokenId) view returns (uint8)',
  'function nextMergeHeight(uint256 tokenId) view returns (uint64)',
  'function cooldownBlocks(uint8 tokenLevel) view returns (uint64)',
  'function mergesOpen() view returns (bool)',
  'function MAXIMUM_LEVEL() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)',
  'function merge(uint256 survivor, uint256 donor)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Merged(uint256 indexed survivor, uint256 indexed donor, uint8 level, uint64 nextMergeHeight)',
])

export const stakingAbi = parseAbi([
  'function deposit(address collection, uint256[] tokenIds)',
  'function withdraw(address collection, uint256[] tokenIds)',
  'function mergeDeposited(address collection, uint256 survivor, uint256 donor)',
  'function claim(address account) returns (uint256 amount)',
  'function claimable(address account) view returns (uint256)',
  'function accountPower(address account) view returns (uint256 nftPower, uint256 sqkPower)',
  'function stakeOf(address account) view returns (uint256 principal, uint256 freshPrincipal, uint64 freshUntilRound)',
  'function depositor(address collection, uint256 tokenId) view returns (address)',
  'function basePower(address collection, uint8 level) view returns (uint64)',
  'function rewardState() view returns ((uint256 funded, uint256 paid, uint256 compounded, uint256 rewardIndex, uint256 remaining, uint128 totalNftPower, uint128 totalSqkPower, uint256 streamRate, uint64 lastAccruedAt, uint64 streamEndsAt))',
  'function paused() view returns (bool)',
  'event RewardClaimed(address indexed account, address indexed recipient, uint256 amount)',
])

export const miningAbi = parseAbi([
  'function checkpoint()',
  'function SUPPLY_CAP() view returns (uint256)',
  'function state() view returns ((uint256 minted, uint64 processedThroughRound, uint64 startRound, uint64 startHeight, uint64 fundedBlocks, address guardian, bool bootstrapped, bool startCaptured, bool paused, bool active))',
  'function issuanceSchedule() view returns ((uint256 allowance, uint256 launchBonus, uint64 bonusBlocks, uint64 halvingBlocks, uint256 firstPeriodRate, uint64 startHeight))',
  'function checkpointStatus() view returns (bool corePaused, uint64 nextRound, bool roundSettled)',
])
