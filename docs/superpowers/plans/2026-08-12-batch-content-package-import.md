# Batch Content Package Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users select several JSON content packages, preview conflicts as one batch, and install every valid package with a single confirmation.

**Architecture:** Add a focused domain module that sequentially previews and installs normalized packages against staged state, so conflicts inside one selection are detected before persistence. `PackageManagerView` remains responsible for file reading and rendering, but stores a list of typed batch entries and writes the final installed package collection once.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils, Playwright, existing content-package validator and lifecycle functions.

---

### Task 1: Add deterministic batch preview and installation

**Files:**
- Create: `src/domain/packageBatch.ts`
- Create: `tests/unit/packageBatch.test.ts`

- [ ] **Step 1: Write failing domain tests**

Create two valid normalized packages with distinct IDs, plus a third package reusing the first package's set ID. Assert that `previewPackageBatch` marks the first two `ready`, marks the conflicting third `blocked`, and that `installPackageBatch` returns both successful packages without writing storage.

```ts
const previewed = await previewPackageBatch([
  { fileName: 'one.json', content: packageOne },
  { fileName: 'two.json', content: packageTwo },
  { fileName: 'conflict.json', content: conflictPackage },
], [], [])
expect(previewed.map(({ status }) => status)).toEqual(['ready', 'ready', 'blocked'])
expect(previewed[2]).toMatchObject({ error: expect.stringContaining('shared-set') })

const result = await installPackageBatch(previewed, [], [])
expect(result.packages.map(({ packageId }) => packageId)).toEqual(['one', 'two'])
expect(result.installedCount).toBe(2)
expect(result.failures).toEqual([])
```

- [ ] **Step 2: Verify the tests fail because the module is missing**

Run: `npm run test:unit -- --run tests/unit/packageBatch.test.ts`

Expected: FAIL resolving `../../src/domain/packageBatch`.

- [ ] **Step 3: Implement the minimal domain module**

Export these types and functions:

```ts
export interface PackageBatchCandidate {
  fileName: string
  content: NormalizedContentPackage
}

export type PackageBatchEntry =
  | { fileName: string; status: 'ready'; content: NormalizedContentPackage; preview: PackagePreview }
  | { fileName: string; status: 'blocked'; content: NormalizedContentPackage; preview: PackagePreview; error: string }

export async function previewPackageBatch(
  candidates: PackageBatchCandidate[],
  installed: InstalledContentPackage[],
  bundledSetIds: string[],
): Promise<PackageBatchEntry[]>

export async function installPackageBatch(
  entries: PackageBatchEntry[],
  installed: InstalledContentPackage[],
  bundledSetIds: string[],
): Promise<{ packages: InstalledContentPackage[]; installedCount: number; failures: Array<{ fileName: string; error: string }> }>
```

Preview candidates in order. Call `createPackagePreview`; for every non-blocked preview, call `installPackage` against staged packages to prove integrity and reserve its package/set IDs for later entries. Convert any failed simulated install into a blocked entry. During installation, skip blocked entries and continue after unexpected per-item failures.

- [ ] **Step 4: Run the domain tests**

Run: `npm run test:unit -- --run tests/unit/packageBatch.test.ts`

Expected: 2 tests PASS with no warnings.

- [ ] **Step 5: Commit the domain behavior**

```bash
git add src/domain/packageBatch.ts tests/unit/packageBatch.test.ts
git commit -m "feat: AI add batch package lifecycle"
```

### Task 2: Replace the single-file view state with a batch

**Files:**
- Modify: `src/views/PackageManagerView.vue`
- Modify: `tests/unit/PackageManagerView.test.ts`

- [ ] **Step 1: Write failing component tests**

Add tests that assert the file input has `multiple`, then call an exposed `loadPackageFiles` with two valid `File` objects and one invalid JSON file. Assert the view shows `3 个文件`, `2 个可安装`, the invalid file name, and a single `安装全部可用内容包` button. Click once and assert both packages exist in `createBrowserPracticeRepository()`.

```ts
expect(wrapper.get('input[type="file"]').attributes('multiple')).toBeDefined()
await vm.loadPackageFiles([
  new File([JSON.stringify(packageOne)], 'one.json', { type: 'application/json' }),
  new File(['{broken'], 'broken.json', { type: 'application/json' }),
  new File([JSON.stringify(packageTwo)], 'two.json', { type: 'application/json' }),
])
expect(wrapper.text()).toContain('3 个文件')
expect(wrapper.text()).toContain('2 个可安装')
expect(wrapper.text()).toContain('broken.json')
await wrapper.get('[data-testid="confirm-package-batch-install"]').trigger('click')
expect(repository.listInstalledPackages()).toHaveLength(2)
```

Retain the existing single-package preview/install/uninstall test.

- [ ] **Step 2: Verify the component tests fail on the current single-file behavior**

Run: `npm run test:unit -- --run tests/unit/PackageManagerView.test.ts`

Expected: FAIL because the input lacks `multiple`, `loadPackageFiles` does not exist, and the batch button is absent.

- [ ] **Step 3: Implement batch file parsing and state**

In `PackageManagerView.vue`, define:

```ts
type InvalidBatchEntry = { fileName: string; status: 'invalid'; error: string }
type ViewBatchEntry = PackageBatchEntry | InvalidBatchEntry
const batch = ref<ViewBatchEntry[]>([])
const isInstalling = ref(false)
const readyEntries = computed(() => batch.value.filter((entry): entry is Extract<PackageBatchEntry, { status: 'ready' }> => entry.status === 'ready'))
```

Implement `loadPackageFiles(files: File[])` by reading all files with `Promise.all`, validating each JSON independently, passing valid candidates to `previewPackageBatch`, and merging results back into original file order. `choosePackage` passes `Array.from(input.files ?? [])`. A new selection replaces the old batch.

- [ ] **Step 4: Implement one-click persistence**

Replace `confirmInstall` with `confirmBatchInstall`. Call `installPackageBatch`, invoke `repository.replaceInstalledPackages(result.packages)` once, refresh `installed`, clear successfully installed entries, keep blocked/invalid entries visible, and set feedback to `已安装 N 个内容包，跳过 M 个。` Disable the button while installing or when there are no ready entries.

- [ ] **Step 5: Render single and batch previews**

Add `multiple` to the input and change its label to `选择一个或多个 JSON 内容包`. For a one-item valid batch, keep rendering `PackagePreview` and its source/license confirmation. For multiple files, render a summary header and ordered rows containing file name, package name, version, set/question counts, status, source, license, and error. Use one button with `data-testid="confirm-package-batch-install"`.

- [ ] **Step 6: Run component and domain tests**

Run: `npm run test:unit -- --run tests/unit/packageBatch.test.ts tests/unit/PackageManagerView.test.ts`

Expected: all tests PASS.

- [ ] **Step 7: Commit the view behavior**

```bash
git add src/views/PackageManagerView.vue tests/unit/PackageManagerView.test.ts
git commit -m "feat: AI support multi-file package import"
```

### Task 3: Polish batch presentation and prove the real 11-package workflow

**Files:**
- Modify: `src/styles/library-tools.css`
- Modify: `tests/e2e/legacyPackageImport.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Change the complete-bank E2E test to a single selection and click**

Replace the loop that selects and confirms every file with:

```ts
await page.locator('input[type="file"]').setInputFiles(
  files.map((file) => resolve(packageDirectory!, file)),
)
await expect(page.getByText('11 个可安装')).toBeVisible()
await page.getByTestId('confirm-package-batch-install').click()
await expect(page.locator('.installed-package')).toHaveCount(11)
```

Run with `LEGACY_PACKAGE_DIRECTORY` set. Expected before the view change is fully wired: FAIL because only the first selected file is installed. Expected after implementation: PASS with one click.

- [ ] **Step 2: Add responsive batch styles**

Add focused `.package-batch-*` rules for a flat bordered list, status colors using existing signal/error variables, readable source/license metadata, and a mobile single-column layout. Do not add nested cards or change unrelated library styles.

- [ ] **Step 3: Document multi-file import**

Update the local migration section in `README.md` to say users can select all `private-atlas-*.json` files together, review the batch, and click once to install all available packages.

- [ ] **Step 4: Run the real 11-package E2E test**

Run:

```powershell
$env:LEGACY_PACKAGE_PATH='artifacts\import\ielts-practice-reading\private-atlas-p1-001.json'
$env:LEGACY_PACKAGE_DIRECTORY='artifacts\import\ielts-practice-reading'
npm.cmd run test:e2e -- tests/e2e/legacyPackageImport.spec.ts --project desktop-chromium
```

Expected: 2 tests PASS; the complete-bank test selects 11 files and clicks once.

- [ ] **Step 5: Commit UI proof and documentation**

```bash
git add src/styles/library-tools.css tests/e2e/legacyPackageImport.spec.ts README.md
git commit -m "test: AI verify one-click bank import"
```

### Task 4: Complete verification and integrate

**Files:**
- Verify only; no new production files expected.

- [ ] **Step 1: Run application verification**

Run: `npm run check`

Expected: typecheck passes, all unit tests pass, and Vite production build exits 0.

- [ ] **Step 2: Run process integration tests**

Run: `npm run test:integration`

Expected: all integration suites pass.

- [ ] **Step 3: Run all E2E tests**

Run: `npm run test:e2e`

Expected: all applicable desktop/mobile tests pass; environment-gated legacy tests may skip when their variables are not present.

- [ ] **Step 4: Inspect repository safety**

Run: `git diff --check`, `git status --short`, and `git check-ignore artifacts/import/ielts-practice-reading/private-atlas-p1-001.json`.

Expected: no whitespace errors, only intended commits on the feature branch, and third-party generated artifacts remain ignored.

- [ ] **Step 5: Fast-forward into local main and verify branch equality**

From the primary worktree, fast-forward `main` to `feature/batch-content-import`, rerun the targeted component test, and verify `git rev-parse main` equals the merged feature commit. Push only source, tests, and documentation; never force-add ignored题库 artifacts.
