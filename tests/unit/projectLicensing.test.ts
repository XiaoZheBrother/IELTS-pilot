import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function read(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('project licensing and signing readiness', () => {
  it('publishes code under MIT with synchronized package metadata', () => {
    const pkg = JSON.parse(read('package.json')) as { license?: string }
    const cargo = read('src-tauri/Cargo.toml')
    const license = read('LICENSE')

    expect(pkg.license).toBe('MIT')
    expect(cargo).toContain('license = "MIT"')
    expect(license).toContain('MIT License')
    expect(license).toContain('Copyright (c) 2026 XiaoZheBrother')
  })

  it('keeps original learning content under CC BY 4.0 and excludes imported material', () => {
    const contentLicense = read('CONTENT-LICENSE.md')

    expect(contentLicense).toContain('CC BY 4.0')
    expect(contentLicense).toContain('src/data/')
    expect(contentLicense).toContain('用户导入')
    expect(contentLicense).toContain('IELTS-practice')
  })

  it('documents privacy boundaries and a truthful SignPath signing policy', () => {
    const privacy = read('PRIVACY.md')
    const signing = read('CODE_SIGNING_POLICY.md')
    const readme = read('README.md')

    expect(privacy).toContain('默认不收集遥测')
    expect(privacy).toContain('用户主动')
    expect(privacy).toContain('API Key')
    expect(signing).toContain('Free code signing provided by SignPath.io, certificate by SignPath Foundation')
    expect(signing).toContain('尚未启用 Authenticode')
    expect(signing).toContain('XiaoZheBrother')
    expect(readme).toContain('[MIT](LICENSE)')
    expect(readme).toContain('[CC BY 4.0](CONTENT-LICENSE.md)')
    expect(readme).toContain('[隐私政策](PRIVACY.md)')
    expect(readme).toContain('[代码签名政策](CODE_SIGNING_POLICY.md)')
  })
})
