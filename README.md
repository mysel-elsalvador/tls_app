# hub web

Next.js (App Router, TypeScript) exported as a static site (`output: "export"`), hosted on S3 + CloudFront by the `../tls_aws_api` stack. There is no server: the browser signs in with Cognito (Amplify, SRP) and calls the web API with the access token. The UI is in Spanish.

| Route              | What                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `/login/`          | email + password; on first sign-in, asks for a new password (users get a temporary one). "¿Olvidó su contraseña?": Cognito emails a code (Spanish template in `tls_aws_api/template.yml`), the user enters it with a new password and is signed in. Not for users still on their temporary password |
| `/`                | stations (one per console) of the user's active organizations: agent/console/controller status, tanks, active alarms |
| `/station/?id=N`   | one station: status, active alarms, and per tank the latest volume, fill, height, water and temperature |
| `/station/?id=N&panel=vox` | the station's VOX controller: latest 50 sales, and shift (`Turnos`) or day (`Días`, `&cierre=dia`) closes, paged with "Cargar más". `Lista`: a row opens sales by product and pump, pump tests and volume totalizers. `Gráficas` (`&cierres=graficas`): one bar per loaded close, amount or gallons, with the average. With 2+ fuels the bars stack per fuel (products with a number add up: Power Plus 1 + 2), with a legend, and a `Todo` / per-fuel selector built from the products in the loaded closes; chart colors are the tank hues re-stepped for contrast (`fuelOf` in `src/lib/format.ts`) |

- **Tabs:** a station with a console and a VOX controller shows "Veeder-Root" (default) and "VOX"; with only one of them, just its view. Devices come from the API (`has_console`, `controller`). VOX data loads only on its tab.
- **VOX times** are shown as the controller sent them (no zone conversion; its clock is not reliable). Totalizer amounts are not shown (scale not verified).

- **Refresh:** data refreshes every 30 s while the tab is visible.
- **Query-string station URL:** a static export cannot have dynamic routes for stations created after the build.
- **Alarm names:** only the codes documented in the TLS2 manual have a name (`src/lib/format.ts`). Every other code is shown raw, marked "sin documentar".
- **Units:** shown only when the agent reported them (`units`), never guessed.
- **Installable app (PWA):** `src/app/manifest.ts`, the iOS tags in `layout.tsx`, and `public/sw.js`. The service worker caches nothing (data must be live); it exists for installation and to show push notifications. Icons are generated from `scripts/icon.svg` by `scripts/icons.sh`.
- **API contract:** `src/lib/types.ts` is a copy of `../tls_aws_api/src/types.ts`; keep the two in sync.

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
