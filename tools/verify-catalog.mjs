#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { fingerprint, parseArgs, verifyCatalog } from './lib/publisher-crypto.mjs'

const args = parseArgs(process.argv)
if (!args.get('--catalog')) throw new Error('Usage: verify-catalog --catalog catalog.json [--package-root directory]')
const catalogPath = resolve(args.get('--catalog'))
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
if (!verifyCatalog(catalog)) throw new Error('catalog signature verification failed')
if (args.get('--package-root')) {
  const root = resolve(args.get('--package-root'))
  for (const item of catalog.packages) {
    const file = resolve(root, basename(new URL(item.url).pathname))
    const bytes = await readFile(file)
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (digest !== item.sha256) throw new Error(`package digest mismatch: ${item.packageId}`)
    if (bytes.length !== item.size) throw new Error(`package size mismatch: ${item.packageId}`)
  }
}
process.stdout.write(`${JSON.stringify({ event: 'verified', catalogId: catalog.catalogId, fingerprint: fingerprint(catalog.publisher.publicKey), packages: catalog.packages.length })}\n`)
