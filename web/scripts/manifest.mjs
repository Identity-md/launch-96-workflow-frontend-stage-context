import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = new URL('../../dist/', import.meta.url)
const docs = new URL('../../docs/abi/', import.meta.url)
await mkdir(new URL('abi/', root), { recursive: true })
await Promise.all(['Wager.json', 'HandshakeBet.json'].map(name => copyFile(new URL(name, docs), new URL(`abi/${name}`, root))))
async function files(dir) { return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat() }
const diskRoot = root.pathname
const paths = (await files(diskRoot)).map(file => relative(diskRoot, file).replaceAll('\\', '/')).filter(path => path !== 'imd-deployment.json').sort()
if (paths.length > 128) throw new Error('Export has more than 128 assets')
const assets = await Promise.all(paths.map(async path => {
  const bytes = await readFile(join(diskRoot, path))
  if (bytes.length > 8 * 1024 * 1024) throw new Error(`${path} exceeds 8 MiB`)
  return { path, sha256: createHash('sha256').update(bytes).digest('hex') }
}))
const manifest = { version: 1, launchId: '3b9a04ef-dbbe-455e-bd77-4be18d60aa44', chainId: 11155111, sourceCommit: '62ce8cfb28058b393b04b3f1397a37a7a352565f', attestationHash: '28df7d6185724eec5eeda452a184893f32c898249e2ca6b395bd8493527ebb69', contracts: [
  { name: 'Wager', address: '0xc4780c45097a850ea3880dd6062efe447ac295fb', abiHash: 'f66e87bfe8899d7e8427ee2bde9eb7cb6c13775dd4edae0ed0426bff1a1e8a49', abiPath: 'abi/Wager.json' },
  { name: 'HandshakeBet', address: '0xcc4a829444f96b3526c1e4d6f1d781be17d3e86f', abiHash: '0b62a97160c03d029251593b6fd247b667f94ec36c582a142ac589639f24e1fc', abiPath: 'abi/HandshakeBet.json' }
], assets }
await writeFile(new URL('imd-deployment.json', root), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote manifest with ${assets.length} assets`)
