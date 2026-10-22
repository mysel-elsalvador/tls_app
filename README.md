# hub web

Next.js (App Router, TypeScript) exported as a static site (`output: "export"`), hosted on S3 + CloudFront by the `../api` stack. There is no server: the browser signs in with Cognito (Amplify, SRP) and calls the web API with the access token. The UI is in Spanish.

| Route              | What                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `/login/`          | email + password; on first sign-in, asks for a new password (users get a temporary one)    |
| `/`                | stations (one per console) of the user's active organizations: agent/console status, tanks, active alarms |
| `/station/?id=N`   | one station: status, active alarms, and per tank the latest volume, fill, height, water and temperature |

- **Refresh:** data refreshes every 30 s while the tab is visible.
- **Query-string station URL:** a static export cannot have dynamic routes for stations created after the build.
- **Alarm names:** only the codes documented in the TLS2 manual have a name (`src/lib/format.ts`). Every other code is shown raw, marked "sin documentar".
- **Units:** shown only when the agent reported them (`units`), never guessed.
- **Installable app (PWA):** `src/app/manifest.ts`, the iOS tags in `layout.tsx`, and `public/sw.js`. The service worker caches nothing (data must be live); it exists for installation and to show push notifications. Icons are generated from `scripts/icon.svg` by `scripts/icons.sh`.
- **API contract:** `src/lib/types.ts` is a copy of `../api/src/types.ts`; keep the two in sync.

## Develop

```sh
npm ci
cp env.example .env.local       # fill in with the hub-web-dev outputs
npm run dev                     # http://localhost:3000 (allowed by CORS in dev)
npm run lint && npm run typecheck && npm run build
```

## Deploy

```sh
npm run deploy                  # dev: build with the hub-web-dev outputs, s3 sync, CloudFront invalidation
bash scripts/deploy.sh prod
```
