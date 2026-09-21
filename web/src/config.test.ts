import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRuntimeConfig } from './config'

afterEach(() => vi.unstubAllGlobals())
describe('runtime deployment loader', () => {
  it('loads addresses and ABIs from the exported manifest', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ version: 1, chainId: 11155111, contracts: [{ name: 'Wager', address: '0xc4780c45097a850ea3880dd6062efe447ac295fb', abiPath: 'abi/Wager.json', abiHash: 'hash' }], assets: [] }) }).mockResolvedValueOnce({ ok: true, json: async () => ([{ type: 'function', name: 'balanceOf' }]) })
    vi.stubGlobal('fetch', fetch)
    const config = await loadRuntimeConfig()
    expect(config.contracts[0].address).toBe('0xc4780c45097a850ea3880dd6062efe447ac295fb')
    expect(config.abis.Wager[0]).toMatchObject({ name: 'balanceOf' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('rejects unsafe ABI traversal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 1, chainId: 11155111, contracts: [{ name: 'Bad', abiPath: '../secret' }], assets: [] }) }))
    await expect(loadRuntimeConfig()).rejects.toThrow('Unsafe ABI path')
  })
  it('rejects the wrong network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 1, chainId: 1, contracts: [], assets: [] }) }))
    await expect(loadRuntimeConfig()).rejects.toThrow('Unsupported deployment')
  })
})
