import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('desktop packaging configuration', () => {
  it('targets a Windows NSIS installer with matching app versions', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string; scripts: Record<string, string> }
    const config = JSON.parse(readFileSync(resolve('src-tauri/tauri.conf.json'), 'utf8')) as {
      version: string
      build: { frontendDist: string; beforeBuildCommand: string; devUrl: string }
      bundle: { targets: string[]; createUpdaterArtifacts?: boolean }
      plugins?: { updater?: { pubkey?: string; endpoints?: string[]; windows?: { installMode?: string } } }
    }
    expect(pkg.version).toBe('0.9.1')
    expect(config.version).toBe(pkg.version)
    expect(config.bundle.targets).toContain('nsis')
    expect(config.build.frontendDist).toBe('../dist')
    expect(pkg.scripts['desktop:build']).toContain('tauri build')
    expect(existsSync(resolve('src-tauri/src/main.rs'))).toBe(true)
    expect(existsSync(resolve('.github/workflows/windows-release.yml'))).toBe(true)
  })

  it('uses signed updater artifacts only for release builds', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { scripts: Record<string, string> }
    const cargo = readFileSync(resolve('src-tauri/Cargo.toml'), 'utf8')
    const rust = readFileSync(resolve('src-tauri/src/lib.rs'), 'utf8')
    const capabilities = JSON.parse(readFileSync(resolve('src-tauri/capabilities/default.json'), 'utf8')) as { permissions: string[] }
    const base = JSON.parse(readFileSync(resolve('src-tauri/tauri.conf.json'), 'utf8')) as {
      bundle: { createUpdaterArtifacts?: boolean }
      plugins: { updater: { pubkey: string; endpoints: string[]; windows: { installMode: string } } }
    }
    const release = JSON.parse(readFileSync(resolve('src-tauri/tauri.release.conf.json'), 'utf8')) as { bundle: { createUpdaterArtifacts: boolean } }

    expect(cargo).toContain('tauri-plugin-updater')
    expect(cargo).toContain('tauri-plugin-process')
    expect(rust).toContain('tauri_plugin_updater')
    expect(rust).toContain('tauri_plugin_process')
    expect(capabilities.permissions).toContain('updater:default')
    expect(capabilities.permissions).toContain('process:allow-restart')
    expect(base.bundle.createUpdaterArtifacts).toBe(false)
    expect(base.plugins.updater.pubkey).toMatch(/^[A-Za-z0-9+/=]{100,}$/)
    expect(base.plugins.updater.endpoints).toEqual(['https://github.com/XiaoZheBrother/IELTS-pilot/releases/latest/download/latest.json'])
    expect(base.plugins.updater.windows.installMode).toBe('passive')
    expect(release.bundle.createUpdaterArtifacts).toBe(true)
    expect(pkg.scripts['desktop:release']).toContain('tauri.release.conf.json')
  })

  it('keeps updater and optional Authenticode secrets inside the release workflow', () => {
    const workflow = readFileSync(resolve('.github/workflows/windows-release.yml'), 'utf8')
    const readme = readFileSync(resolve('README.md'), 'utf8')
    expect(workflow).toContain('TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}')
    expect(workflow).toContain('TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}')
    expect(workflow).toContain('WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}')
    expect(workflow).toContain('WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}')
    expect(workflow).toContain('tauri.ci-signing.conf.json')
    expect(workflow).toContain('updaterJsonPreferNsis: true')
    expect(workflow).toContain('releaseDraft: false')
    expect(workflow).toContain('releaseAssetNamePattern: IELTS-Pilot-[version]-Windows-[arch]-Setup.[ext]')
    expect(workflow).toContain('src-tauri/tauri.release.conf.json')
    expect(readme).toContain('https://github.com/XiaoZheBrother/IELTS-pilot/releases/download/v0.9.1/IELTS-Pilot-0.9.1-Windows-x64-Setup.exe')
  })

  it('routes desktop writing assessment through a rustls HTTPS command without embedded credentials', () => {
    const cargo = readFileSync(resolve('src-tauri/Cargo.toml'), 'utf8')
    const rust = readFileSync(resolve('src-tauri/src/lib.rs'), 'utf8')
    const adapter = readFileSync(resolve('src-tauri/src/ai_writing.rs'), 'utf8')
    expect(cargo).toMatch(/reqwest\s*=.*rustls-tls/)
    expect(rust).toContain('mod ai_writing')
    expect(rust).toContain('ai_writing::evaluate_writing')
    expect(adapter).toContain('#[tauri::command]')
    expect(adapter).toContain('https')
    expect(adapter).toContain('"thinking": { "type": "disabled" }')
    expect(`${cargo}\n${rust}\n${adapter}`).not.toMatch(/ark-[a-z0-9]{20,}/i)
    expect(`${cargo}\n${rust}\n${adapter}`).not.toContain('D:\\Users\\yuqi.chen')
  })
})
