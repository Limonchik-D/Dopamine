# Operations: Go-live, Monitoring, Rollback

## 1) Pre-release checklist

- [ ] `npm ci` and `npm --prefix ./web ci`
- [ ] `npm run build:all`
- [ ] `npm run db:migrate:local`
- [ ] `npm run db:seed:local`
- [ ] Local smoke:
  - [ ] `GET /health` returns `status: ok`
  - [ ] auth flow (register/login/logout)
  - [ ] create workout + add sets
  - [ ] upload custom exercise photo

## 2) Release flow

Staging:

1. Push to `develop`
2. CI runs verify + migrate + deploy
3. Smoke test step runs if `STAGING_BASE_URL` is set

Production:

1. Merge to `main`
2. CI runs verify + migrate + deploy
3. Smoke test step runs if `PRODUCTION_BASE_URL` is set

## 3) Required GitHub secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `STAGING_BASE_URL` (optional, enables smoke)
- `PRODUCTION_BASE_URL` (optional, enables smoke)

## 4) Runtime monitoring (first 24h)

- Track 5xx rate and error codes (`INTERNAL_ERROR`, `INVALID_TOKEN`, `RATE_LIMITED`)
- Track auth failures and rate limiting spikes
- Track latency on:
  - `GET /api/workouts`
  - `GET /api/stats/*`
  - `GET /api/exercises`
- Verify R2 media reads and upload error rates

## 5) Rollback playbook

1. **App rollback first** (safe):
   - Roll back Worker deployment to previous stable version from Cloudflare dashboard/CLI.
2. **DB rollback caution**:
   - Prefer forward-fix migration over destructive rollback.
   - Keep D1 export snapshot before production migrations.
3. Re-run smoke checks on rolled back version.

## 6) Emergency commands

```bash
# Local type/build safety
npm run build:all

# Deploy manually if needed
npm run deploy:staging
npm run deploy:prod

# Manual smoke against URL
node ./scripts/smoke.mjs https://your-app.example.com
```
