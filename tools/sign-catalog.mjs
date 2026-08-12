#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs, publicJwkFrom, signCatalog } from './lib/publisher-crypto.mjs'

const args = parseArgs(process.argv)
const catalogPath = resolve(args.get('--catalog') ?? '')
const privatePath = resolve(args.get('--private-key') ?? '')
const outputPath = resolve(args.get('--out') ?? '')
if (!args.get('--catalog') || !args.get('--private-key') || !args.get('--out')) throw new Error('Usage: sign-catalog --catalog unsigned.json --private-key publisher-private.jwk --out catalog.json')
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const privateJwk = JSON.parse(await readFile(privatePath, 'utf8'))
if (!privateJwk.d || catalog?.schemaVersion !== 1 || !catalog?.publisher || !Array.isArray(catalog?.packages)) throw new Error('Invalid catalog or private key.')
catalog.publisher.publicKey = publicJwkFrom(privateJwk)
delete catalog.signature
catalog.signature = { algorithm: 'ECDSA-P256-SHA256', value: signCatalog(catalog, privateJwk) }
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, { flag: 'w' })
process.stdout.write(`${JSON.stringify({ event: 'signed', catalog: outputPath })}\n`)
