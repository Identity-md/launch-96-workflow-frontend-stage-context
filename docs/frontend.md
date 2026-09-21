# Wager frontend

This directory accompanies the React/Vite source in `web/` and the committed static export in `dist/`. The application is a Sepolia-only interface for the deployed Wager token and HandshakeBet protocol.

## Runtime configuration

The app first loads `dist/imd-deployment.json`, then loads each ABI named by that file. It does not embed a second address or ABI map. The public Sepolia RPC and Etherscan URL are in `web/src/config.ts`; neither requires credentials. Wallet signing remains in the visitor's injected browser wallet. A WalletConnect project ID was not supplied, so the build intentionally enables browser-injected wallets and does not ship a placeholder remote-wallet credential.

The ABI files were preserved from `docs/abi/` at source commit `62ce8cfb28058b393b04b3f1397a37a7a352565f`. Their recursively key-sorted, compact JSON Keccak-256 hashes were checked against the deployment handoff:

- Wager: `f66e87bfe8899d7e8427ee2bde9eb7cb6c13775dd4edae0ed0426bff1a1e8a49`
- HandshakeBet: `0b62a97160c03d029251593b6fd247b667f94ec36c582a142ac589639f24e1fc`

## Install, develop, and rebuild

From `web/`:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run manifest
```

`npm run build` empties and recreates the repository-root `dist/` with Vite's relative base. Always run `npm run manifest` afterward: it copies the pinned ABI exports and generates `dist/imd-deployment.json` from the final exported bytes. Run it again after any export change.

To preview the same static files a publisher will host:

```sh
npx vite preview --outDir ../dist
```

## Validation evidence

Validated on 2026-09-21:

- `npm run typecheck`: passed with TypeScript strict mode.
- `npm test`: 3 tests passed. Tests cover runtime manifest/ABI loading, unsafe ABI path rejection, and wrong-chain configuration rejection.
- `npm run build`: passed; Vite emitted a relative-base production export.
- `npm run manifest`: passed with 75 declared assets (plus the self-excluded manifest), 2.7 MiB total, and no file near the 8 MiB limit.
- ABI canonical hashes: both matched the attested handoff values above.
- Public RPC check: `eth_chainId` returned `0xaa36a7` (11155111), Wager had 1,366 bytes of runtime code, and HandshakeBet had 5,008 bytes at the configured addresses.
- Static integrity: every manifest asset was re-hashed from disk and matched its lowercase SHA-256 declaration; every path was relative and traversal-free.
- Export smoke check: `index.html`, manifest, ABI files, CSS, and JavaScript were served over local HTTP with successful responses.

The UI exposes connect, token approval, propose, accept, cancel, expire/refund, outcome submission, and claim controls. Connected views poll WGR balance, allowance, claimable credit, bet count, and all bet records. It reports disconnected and wrong-chain states, wallet rejection/write errors, pending confirmation, and confirmed transaction links.

No real transaction was broadcast and no funded-wallet behavior was tested. Although chain identity and nonempty deployed code were checked, live application reads and injected-wallet prompts remain dependent on the user's RPC reachability, wallet, permissions, balance, allowance, contract state, and deadline timing. No publication, IPFS pin, named-site check, or control-plane verification was performed by this worker.
