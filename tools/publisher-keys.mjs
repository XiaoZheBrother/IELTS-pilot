#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fingerprint, parseArgs } from './lib/publisher-crypto.mjs'

const args = parseArgs(process.argv)
const outDir = resolve(args.get('--out-dir') ?? '.')
await mkdir(outDir, { recursive: true })
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const privateJwk = { ...privateKey.export({ format: 'jwk' }), alg: 'ES256', use: 'sig' }
const publicJwk = { ...publicKey.export({ format: 'jwk' }), alg: 'ES256', use: 'sig' }
await writeFile(resolve(outDir, 'publisher-private.jwk'), `${JSON.stringify(privateJwk, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
await writeFile(resolve(outDir, 'publisher-public.jwk'), `${JSON.stringify(publicJwk, null, 2)}\n`, { flag: 'wx' })
const value = fingerprint(publicJwk)
await writeFile(resolve(outDir, 'publisher-fingerprint.txt'), `${value}\n`, { flag: 'wx' })
process.stdout.write(`${JSON.stringify({ event: 'generated', fingerprint: value, publicKey: resolve(outDir, 'publisher-public.jwk') })}\n`)
