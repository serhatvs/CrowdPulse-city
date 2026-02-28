# Security Upgrade Plan

## Scope

Current `npm audit` findings (dev dependency tree) are primarily tied to the Hardhat 2.x + toolbox 6.x ecosystem.
The fix path requires a major upgrade to Hardhat 3.x and related plugins.

## Targets

1. Move to `hardhat@^3`.
2. Move to `@nomicfoundation/hardhat-toolbox@^7`.
3. Remove deprecated/legacy plugin chains pulling vulnerable transitive packages.
4. Keep contract compile/test/deploy workflow stable after migration.

## Execution Plan

1. Create migration branch:
   - `git checkout -b chore/hardhat3-security-upgrade`

2. Upgrade core packages in `packages/contracts/package.json`:
   - `hardhat`
   - `@nomicfoundation/hardhat-toolbox`
   - any direct `@nomicfoundation/*` plugin pins if present

3. Reinstall and regenerate lockfile:
   - `npm install --workspaces --include-workspace-root`

4. Adjust config and scripts for Hardhat 3:
   - update `packages/contracts/hardhat.config.ts`
   - verify network config shape and plugin imports
   - verify `packages/contracts/deploy.ts`

5. Validate contract pipeline:
   - `npm run test:contracts`
   - `npm run build`
   - `npm run demo:init`

6. Validate API/indexer integration:
   - check deploy address output consumed by `.env`
   - verify on-chain optional mutation path still works when enabled

7. Run security checks:
   - `npm audit`
   - `npm audit --omit=dev`

8. Finalize:
   - update README + CHANGELOG
   - merge after full regression pass

## Risk Notes

1. Hardhat 3 may introduce plugin/runtime behavior differences in tests and scripts.
2. Any local scripts assuming Hardhat 2 task behavior may need small changes.
3. This is a planned post-demo maintenance upgrade unless security policy requires immediate action.
