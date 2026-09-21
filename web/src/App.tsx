import { useMemo, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { formatUnits, isAddress, parseUnits, stringToHex, hexToString, type Hash } from 'viem'
import { contract, EXPLORER_URL, type RuntimeConfig } from './config'

const STATE = ['Missing', 'Awaiting match', 'Matched', 'Resolved']
const OUTCOME = ['Not submitted', 'Statement is true', 'Statement is false']
const short = (value?: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—'
const message = (error: unknown) => error instanceof Error ? error.message.split('\n')[0] : 'Request failed'

function TxNotice({ hash, pending, success, error }: { hash?: Hash; pending: boolean; success: boolean; error?: Error | null }) {
  if (pending) return <p className="notice">Transaction pending…</p>
  if (success && hash) return <p className="notice success">Confirmed · <a href={`${EXPLORER_URL}/tx/${hash}`} target="_blank">View transaction ↗</a></p>
  if (error) return <p className="notice error" role="alert">{message(error)}</p>
  return null
}

export default function App({ runtime }: { runtime: RuntimeConfig }) {
  const wager = contract(runtime, 'Wager')
  const handshake = contract(runtime, 'HandshakeBet')
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const wrongChain = isConnected && chainId !== runtime.chainId
  const [counterparty, setCounterparty] = useState('')
  const [stake, setStake] = useState('10')
  const [deadline, setDeadline] = useState('')
  const [statement, setStatement] = useState('')
  const [actionId, setActionId] = useState('0')
  const [chosenOutcome, setChosenOutcome] = useState(1)
  const [localError, setLocalError] = useState('')
  const { writeContract, data: hash, isPending: walletPending, error: writeError, reset } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })

  const account = address ?? '0x0000000000000000000000000000000000000000'
  const reads = useReadContracts({ contracts: [
    { ...wager, functionName: 'balanceOf', args: [account] },
    { ...wager, functionName: 'allowance', args: [account, handshake.address] },
    { ...handshake, functionName: 'claimable', args: [account] },
    { ...handshake, functionName: 'nextBetId' }
  ], query: { enabled: isConnected, refetchInterval: 12_000 } })
  const [balance, allowance, claimable, nextId] = (reads.data ?? []).map(item => item.result as bigint | undefined)
  const betCount = Number(nextId ?? 0n)
  const betReads = useReadContracts({ contracts: Array.from({ length: betCount }, (_, id) => ({ ...handshake, functionName: 'bets', args: [BigInt(id)] })), query: { enabled: betCount > 0, refetchInterval: 12_000 } })
  const bets = useMemo(() => (betReads.data ?? []).map((result, id) => ({ id, value: result.result as readonly [string, string, bigint, bigint, `0x${string}`, number, number, number] | undefined })).filter(item => item.value), [betReads.data])
  const parsedStake = (() => { try { return parseUnits(stake || '0', 18) } catch { return 0n } })()

  const transact = (functionName: string, args: readonly unknown[] = []) => {
    setLocalError(''); reset()
    if (!isConnected) return setLocalError('Connect a wallet first.')
    if (wrongChain) return setLocalError('Switch your wallet to Sepolia first.')
    writeContract({ ...handshake, functionName, args } as Parameters<typeof writeContract>[0])
  }
  const approve = () => {
    setLocalError(''); reset()
    if (!isConnected) return setLocalError('Connect a wallet first.')
    if (wrongChain) return setLocalError('Switch your wallet to Sepolia first.')
    if (parsedStake <= 0n) return setLocalError('Enter a positive WGR stake.')
    writeContract({ ...wager, functionName: 'approve', args: [handshake.address, parsedStake] } as Parameters<typeof writeContract>[0])
  }
  const propose = () => {
    try {
      if (!isAddress(counterparty)) throw new Error('Enter a valid counterparty address.')
      if (parsedStake <= 0n) throw new Error('Enter a positive WGR stake.')
      const unix = BigInt(Math.floor(new Date(deadline).getTime() / 1000))
      if (unix <= BigInt(Math.floor(Date.now() / 1000))) throw new Error('Choose a future deadline.')
      const encoded = stringToHex(statement.trim(), { size: 32 })
      transact('propose', [counterparty, parsedStake, unix, encoded])
    } catch (error) { setLocalError(message(error)) }
  }

  return <>
    <header><a className="brand" href="./">WAGER<span>●</span></a><ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} /></header>
    <main>
      <section className="hero"><p className="eyebrow">Handshake protocol · Sepolia</p><h1>Put it on the<br/><em>handshake.</em></h1><p className="lede">Make a claim. Match stakes in WGR. After the deadline, agree on what happened—or everyone gets their stake back.</p><div className="contract-links">{runtime.contracts.map(c => <a key={c.name} href={`${EXPLORER_URL}/address/${c.address}`} target="_blank">{c.name} <span>{short(c.address)} ↗</span></a>)}</div></section>

      {wrongChain && <div className="banner" role="alert">Wrong network. Use the wallet menu to switch to Sepolia (chain {runtime.chainId}).</div>}
      {!isConnected && <div className="banner muted">Connect a wallet to see your WGR balance, allowances, claims, and live bet data.</div>}

      <section className="stats">
        <div><label>Your balance</label><strong>{balance === undefined ? '—' : formatUnits(balance, 18)}</strong><span>WGR</span></div>
        <div><label>Approved</label><strong>{allowance === undefined ? '—' : formatUnits(allowance, 18)}</strong><span>WGR</span></div>
        <div><label>Claimable</label><strong>{claimable === undefined ? '—' : formatUnits(claimable, 18)}</strong><span>WGR</span></div>
        <button className="claim" disabled={!isConnected || wrongChain || !claimable} onClick={() => transact('claim')}>Claim WGR</button>
      </section>

      <section className="workspace">
        <article className="panel create"><div className="step">01</div><h2>Propose a wager</h2><p>Your stake is escrowed when this transaction confirms.</p>
          <label>Statement<input value={statement} maxLength={32} onChange={e => setStatement(e.target.value)} placeholder="ETH closes above $5k"/><small>{new TextEncoder().encode(statement).length}/32 bytes</small></label>
          <label>Counterparty<input value={counterparty} onChange={e => setCounterparty(e.target.value)} placeholder="0x…"/></label>
          <div className="split"><label>Stake<input value={stake} onChange={e => setStake(e.target.value)} inputMode="decimal"/><small>WGR</small></label><label>Settlement deadline<input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}/></label></div>
          <div className="actions"><button className="secondary" onClick={approve}>1. Approve {stake || '0'} WGR</button><button onClick={propose} disabled={parsedStake > (allowance ?? 0n)}>2. Propose wager</button></div>
          {parsedStake > (allowance ?? 0n) && <small>Approval must confirm before proposing.</small>}
        </article>

        <article className="panel manage"><div className="step">02</div><h2>Manage a wager</h2><p>Enter a bet ID, then choose the action allowed by its state and timing.</p>
          <label>Bet ID<input value={actionId} inputMode="numeric" onChange={e => setActionId(e.target.value.replace(/\D/g, ''))}/></label>
          <div className="actions grid"><button onClick={() => transact('accept', [BigInt(actionId || 0)])}>Accept</button><button className="secondary" onClick={() => transact('cancel', [BigInt(actionId || 0)])}>Cancel unmatched</button><button className="secondary" onClick={() => transact('expire', [BigInt(actionId || 0)])}>Expire / refund</button></div>
          <label>Outcome<select value={chosenOutcome} onChange={e => setChosenOutcome(Number(e.target.value))}><option value={1}>Statement is true — proposer wins</option><option value={2}>Statement is false — counterparty wins</option></select></label>
          <button className="wide" onClick={() => transact('submitOutcome', [BigInt(actionId || 0), chosenOutcome])}>Submit final outcome</button>
          <p className="fine">Outcome submission opens at the deadline and lasts 7 days. Disagreement or timeout refunds both stakes.</p>
        </article>
      </section>

      {(localError || writeError || walletPending || receipt.isLoading || receipt.isSuccess) && <section className="transaction"><h3>Transaction status</h3>{localError && <p className="notice error" role="alert">{localError}</p>}<TxNotice hash={hash} pending={walletPending || receipt.isLoading} success={receipt.isSuccess} error={writeError || receipt.error}/></section>}

      <section className="ledger"><div className="ledger-head"><div><p className="eyebrow">Public ledger</p><h2>All wagers</h2></div><button className="text" onClick={() => { reads.refetch(); betReads.refetch() }}>Refresh ↻</button></div>
        {reads.isLoading ? <p>Reading Sepolia…</p> : betCount === 0 ? <div className="empty">No wagers have been proposed yet.</div> : <div className="cards">{bets.slice().reverse().map(({ id, value: b }) => b && <article className="bet" key={id}><div className="bet-top"><b>#{id}</b><span className={`state s${b[5]}`}>{STATE[b[5]]}</span></div><h3>{(() => { try { return hexToString(b[4], { size: 32 }) } catch { return b[4] } })()}</h3><dl><div><dt>Stake each</dt><dd>{formatUnits(b[2], 18)} WGR</dd></div><div><dt>Deadline</dt><dd>{new Date(Number(b[3]) * 1000).toLocaleString()}</dd></div><div><dt>Proposer</dt><dd title={b[0]}>{short(b[0])} · {OUTCOME[b[6]]}</dd></div><div><dt>Counterparty</dt><dd title={b[1]}>{short(b[1])} · {OUTCOME[b[7]]}</dd></div></dl><button className="text" onClick={() => { setActionId(String(id)); document.querySelector('.manage')?.scrollIntoView({ behavior: 'smooth' }) }}>Manage this wager →</button></article>)}</div>}
      </section>
    </main>
    <footer><span>Wager protocol · Sepolia testnet</span><span>Attested deployment {runtime.attestationHash.slice(0, 10)}…</span><span>No admins. No fees.</span></footer>
  </>
}
