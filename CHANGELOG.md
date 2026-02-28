# Changelog

## Unreleased

### Added
- Vite + React + TypeScript web app scaffold in `apps/web`.
- Signature-auth UX (login/logout/session timer) and interactive map reporting flow.
- Backend support for heatmap query filters: `category`, `timeWindow`, `minRisk`, `maxRisk`.
- New API endpoints:
  - `GET /api/hazards`
  - `GET /api/stats`
  - `GET /api/activity`
  - `POST /api/hazards/:id/close`
- Dockerized `indexer` service in `docker-compose.yml`.
- Cross-platform local deploy script: `npm run deploy:local`.
- Playwright smoke test setup (`e2e/smoke.spec.ts`) and scripts (`playwright:install`, `test:smoke`).
- Demo utility scripts:
  - `demo:init`
  - `health:demo`
  - `verify:demo`
  - `reset:demo`
  - `seed:demo`
- API integration tests using Vitest + Supertest.
- CI smoke test for web preview.

### Changed
- API CORS now uses whitelist via `CORS_ORIGINS`.
- `server.ts` now exports `app` and `startServer` and skips auto-listen in test mode.
- Demo setup docs rewritten for quick hackathon execution.
- `docker-compose.yml` indexer command switched to safe multi-line form to avoid YAML parsing failures.
- `health:demo` now handles both JSON and NDJSON compose output formats and prints concise service health summary.
- Web UI upgraded to full dashboard mode with hazard feed table, row vote/close actions, live metrics, and activity timeline.
- Web bundle split improved with lazy-loaded app/map/modal and Vite manual chunk strategy.

### Notes
- `ENABLE_ONCHAIN_MUTATIONS` remains `false` by default for safer demo behavior.
