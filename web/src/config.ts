import type { Abi, Address } from 'viem'

export const PUBLIC_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'
export const EXPLORER_URL = 'https://sepolia.etherscan.io'

export type DeploymentContract = { name: string; address: Address; abiHash: string; abiPath: string }
export type Deployment = {
  version: 1; launchId: string; chainId: number; sourceCommit: string; attestationHash: string
  contracts: DeploymentContract[]; assets: { path: string; sha256: string }[]
}
export type RuntimeConfig = Deployment & { abis: Record<string, Abi> }

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const manifestUrl = new URL('./imd-deployment.json', window.location.href)
  const response = await fetch(manifestUrl)
  if (!response.ok) throw new Error(`Deployment configuration failed to load (${response.status})`)
  const deployment = await response.json() as Deployment
  if (deployment.version !== 1 || deployment.chainId !== 11155111) throw new Error('Unsupported deployment configuration')
  const abis: Record<string, Abi> = {}
  await Promise.all(deployment.contracts.map(async contract => {
    if (!contract.abiPath.startsWith('abi/') || contract.abiPath.includes('..')) throw new Error('Unsafe ABI path')
    const abiResponse = await fetch(new URL(contract.abiPath, manifestUrl))
    if (!abiResponse.ok) throw new Error(`${contract.name} ABI failed to load`)
    abis[contract.name] = await abiResponse.json() as Abi
  }))
  return { ...deployment, abis }
}

export function contract(config: RuntimeConfig, name: string) {
  const found = config.contracts.find(item => item.name === name)
  if (!found || !config.abis[name]) throw new Error(`Missing ${name} deployment`)
  return { address: found.address, abi: config.abis[name] }
}
