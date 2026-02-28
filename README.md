# CrowdPulse-city

CrowdPulse-city is a monorepo for a hackathon-ready accessibility hazard demo:

- `apps/api`: Express API with wallet signature auth
- `apps/web`: Vite + React map UI
- `packages/contracts`: Hardhat contracts
- `packages/indexer`: event listener and risk/heatmap logic

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop

## One-command Demo Init

```bash
npm run setup
npm run demo:init
```

If `.env` is missing, create it from `.env.example` first.

`demo:init` does:

1. starts `postgres + hardhat`
2. deploys contract
3. updates `.env` with deployed contract address
4. starts/recreates `api + indexer`
5. runs migrations
6. resets and seeds demo data
7. verifies and health-checks demo stack

## Local Deploy (This Computer)

```bash
npm run deploy:local
```

This runs setup + build + test + demo init in order.

## Monad Testnet Deploy

Official Monad testnet values wired into this repo:

- chain ID: `10143`
- RPC: `https://testnet-rpc.monad.xyz`
- explorer: `https://testnet.monadvision.com`
- faucet: `https://faucet.monad.xyz`

Before deploying:

1. put a funded Monad testnet `PRIVATE_KEY` into `.env`
2. optionally set `CORS_ORIGINS` for your frontend domain
3. if frontend and API are on different domains, set `VITE_API_BASE_URL=https://your-api-host`

Deploy contract and update `.env` for Monad in one step:

```bash
npm run deploy:monad
```

This command deploys `CityPulse`, updates `RPC_URL`, `CONTRACT_ADDRESS`, enables on-chain mutations, disables demo wallet mode, and writes the frontend Monad network vars.

## Run Web UI

```bash
npm run dev:web
```

Open `http://localhost:5173`.

For a separate frontend host such as Vercel, set `VITE_API_BASE_URL` to your API origin before building.

## Vercel Frontend

The repo now includes [`vercel.json`](./vercel.json) for deploying the Vite frontend from the monorepo root.

Required Vercel env vars for Monad mode:

- `VITE_API_BASE_URL`
- `VITE_MONAD_REQUIRED=true`
- `VITE_MONAD_CHAIN_ID=10143`
- `VITE_MONAD_CHAIN_NAME=Monad Testnet`
- `VITE_MONAD_RPC_URL=https://testnet-rpc.monad.xyz`
- `VITE_MONAD_EXPLORER_URL=https://testnet.monadvision.com`
- `VITE_MONAD_CURRENCY_NAME=Monad`
- `VITE_MONAD_CURRENCY_SYMBOL=MON`
- `VITE_CONTRACT_ADDRESS=<deployed contract>`
- `VITE_DEMO_MODE=false`

## Demo Script (2 minutes)

1. Open web page.
2. Login (`MetaMask Login` or `Demo Wallet Login` in demo mode).
3. Click map and submit a hazard from modal.
4. Use `Hazard Feed` table to upvote/downvote directly from row actions.
5. Close a hazard as reporter after vote threshold is reached.
6. Adjust filters (`category`, `risk`, `time`, `includeClosed`, `sort`) and show map + table changes.
7. Open `Recent Activity` panel and show live events.
8. Show session countdown and logout flow.

## Useful Commands

- `npm run demo:up` start backend services
- `npm run demo:down` stop backend services
- `npm run reset:demo` truncate demo tables
- `npm run seed:demo` generate demo hazards/votes
- `npm run verify:demo` validate seeded counts
- `npm run health:demo` print service + API + DB health report
- `npm run migrate` run SQL migrations manually
- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run playwright:install` install Chromium for Playwright
- `npm run test:smoke` run UI smoke test (login + report flow)

## API Auth Flow

Protected routes require:

1. `GET /api/auth/nonce?address=0x...`
2. Sign returned message
3. `POST /api/auth/verify` with `{ address, signature }`
4. Send:
   - `Authorization: Bearer <token>`
   - `x-wallet-address: <same address>`

## Heatmap Filter Query

`GET /api/heatmap` supports:

- `bbox=minLat,minLon,maxLat,maxLon` (required)
- `category=<int>` (optional)
- `timeWindow=<hours>` (optional)
- `minRisk=<0-100>` (optional)
- `maxRisk=<0-100>` (optional)
- `includeClosed=<true|false>` (optional)

## Additional API Endpoints

- `GET /api/hazards`
  - query: `bbox` (required), `category`, `timeWindow`, `minRisk`, `maxRisk`, `includeClosed`, `limit`, `sort=recent|risk|votes`
  - returns enriched hazard rows with vote totals and risk.
- `GET /api/stats`
  - query: same filters as `/api/heatmap`
  - returns aggregate KPI metrics for dashboard cards.
- `GET /api/activity?limit=30`
  - returns recent audit log events.
- `POST /api/hazards/:id/close` (auth required)
  - reporter-only close action, requires minimum vote threshold (`HAZARD_CLOSE_MIN_VOTES`, default `10`).

## E2E Smoke

The smoke test lives in `e2e/smoke.spec.ts` and validates:

1. Demo wallet login.
2. Opening report modal.
3. Submitting hazard with `Other` category and required detail.
4. Seeing created status and feed update.

## Notes

- Default map bbox points to Kayseri center.
- `HEATMAP_GRID_SIZE_E6=900` is ~100m cell size.
- `ENABLE_ONCHAIN_MUTATIONS=false` is default for safe demo mode.
- CORS is restricted via `CORS_ORIGINS`.
