import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('desktop packaging configuration', () => {
  it('targets a Windows NSIS installer with matching app versions', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string; scripts: Record<string, string> }
    const config = JSON.parse(readFileSync(resolve('src-tauri/tauri.conf.json'), 'utf8')) as {
      version: string
      build: { frontendDist: string; beforeBuildCommand: string; devUrl: string }
      bundle: { targets: string[] }
    }
    expect(pkg.version).toBe('0.5.0')
    expect(config.version).toBe(pkg.version)
    expect(config.bundle.targets).toContain('nsis')
    expect(config.build.frontendDist).toBe('../dist')
    expect(pkg.scripts['desktop:build']).toContain('tauri build')
    expect(existsSync(resolve('src-tauri/src/main.rs'))).toBe(true)
    expect(existsSync(resolve('.github/workflows/windows-release.yml'))).toBe(true)
  })
})
