import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { WagmiProvider, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { defineChain, http } from 'viem'
import '@rainbow-me/rainbowkit/styles.css'
import './styles.css'
import App from './App'
import { EXPLORER_URL, PUBLIC_RPC_URL, loadRuntimeConfig } from './config'

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<main className="boot">Loading verified deployment…</main>)

loadRuntimeConfig().then(runtime => {
  const sepolia = defineChain({ id: runtime.chainId, name: 'Sepolia', nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [PUBLIC_RPC_URL] } }, blockExplorers: { default: { name: 'Etherscan', url: EXPLORER_URL } }, testnet: true })
  const wagmiConfig = createConfig({ chains: [sepolia], connectors: [injected()], transports: { [sepolia.id]: http(PUBLIC_RPC_URL) } })
  root.render(<React.StrictMode><WagmiProvider config={wagmiConfig}><QueryClientProvider client={new QueryClient()}><RainbowKitProvider><App runtime={runtime} /></RainbowKitProvider></QueryClientProvider></WagmiProvider></React.StrictMode>)
}).catch(error => root.render(<main className="boot error"><h1>Wager could not start</h1><p>{error instanceof Error ? error.message : 'Invalid deployment configuration'}</p></main>))
