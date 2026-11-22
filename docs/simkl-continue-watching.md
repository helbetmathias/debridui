# SIMKL Continue Watching and hero sources

## What this adds

- An adaptive dashboard hero: the original full-size banner when SIMKL is disconnected, and a shorter banner on desktop and phone when it is connected. Choose **up to two** sources using the **Hero** checkboxes beside existing catalogue visibility controls in **Addons → Dashboard Catalogs**. Popular movies and series from Cinemeta are the defaults. Sources alternate, with duplicate titles removed. Uncheck both to hide the hero.
- Hero selection is independent of whether the catalogue row is visible, and is saved to your DebridUI account alongside catalogue preferences. Disabled addons cannot supply hero items. An unavailable source is skipped rather than blocking other sources.
- Hero artwork stays still on desktop and phone: no slow zoom. Carousel slide changes and navigation remain unchanged.
- On startup, DebridUI reads the connection and last saved playback from its own database. Saved cards are shown immediately when available, and the hero loads at its final height without waiting for a fresh SIMKL response.
- A **Continue Watching** row between the hero and catalogues, populated from your account's real saved SIMKL playbacks. Landscape cards show the saved percentage and episode. Movie time remaining is an estimate based on TMDB runtime, not a measured player position.
- On phones, the Resume play button sits on the artwork to keep cards short; the full Resume button remains on desktop. Navigation arrows disappear when the row does not overflow. Normal playback does not add explanatory copy below the row; refresh failures still show a short stale-data notice.
- **Settings → Streaming → SIMKL** connects or disconnects the account. It is not a second DebridUI sign-in method.

## Server setup

Register a dedicated **AUTH V2 → Server apps & services** application in [SIMKL developer settings](https://simkl.com/settings/developer/). Do not reuse a desktop application's grant or secret.

Register these redirect URLs for this deployment:

```text
https://deb.mathy.li/api/simkl/callback
http://localhost:3000/api/simkl/callback
```

Add the following server environment variables. In Vercel, use Secret/sensitive values for the secret and encryption key. Do not prefix either with `NEXT_PUBLIC_`, put them in browser settings, or commit them to Git.

| Variable | Value |
| --- | --- |
| `SIMKL_CLIENT_ID` | The dedicated AUTH V2 application's public client ID |
| `SIMKL_CLIENT_SECRET` | Its private client secret |
| `SIMKL_TOKEN_ENCRYPTION_KEY` | A new, random **32-byte key encoded as base64** |
| `NEXT_PUBLIC_APP_URL` | `https://deb.mathy.li` in production; `http://localhost:3000` locally |

Generate the encryption key privately, for example with `openssl rand -base64 32` or `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` on your own machine. Keep a secure copy: changing it makes existing encrypted links unreadable. Do not send its value in chat.

Apply migration **`0007_simkl_connections.sql`** using the repository's normal migration workflow (`bun run db:migrate`), then redeploy after setting the environment variables. The new table has a per-user foreign key and is deleted with the DebridUI user. No existing watch history, addons or settings are deleted. Production database migration must be performed deliberately, not as a browser-preview step.

For an existing installation, run `node scripts/apply-simkl-migration.cjs` in its configured server environment to apply **only** the additive SIMKL migration, without replaying historical cleanup migrations. The script locks and verifies the table, checks the existing user foreign key, and rolls back on a schema mismatch. It advances the Drizzle journal only when its previous migration is already current; otherwise older history is left untouched. The SQL is idempotent so the normal migration runner can later reconcile its journal. For a release build, run this command before the normal build; do not copy production database credentials locally.

Use a separate SIMKL registration, encryption key, and database for preview/development deployments. Preview domains do not automatically become registered callbacks. Once configured, open **Settings → Streaming → Connect SIMKL** and approve the read-only grant.

## Resume behavior and limitations

DebridUI reads saved pause/stop progress; it does not infer viewing from clicking Play and does not write watch history, delete SIMKL playbacks, or auto-mark items watched. A rewatch may appear even if the title was previously completed. The row is not live second-by-second playback telemetry.

**Resume** requests fresh sources through the existing addon/player flow. The selected player's own SIMKL integration must restore the position. On Windows, use **MPV (SIMKL bridge)** plus your existing SIMKL MPS scrobbler with playback resume enabled. See [MPV bridge setup](mpv-simkl-bridge.md). Normal MPV links and other players are unchanged; account-based resume cannot be guaranteed for a player without that integration.

When DebridUI last launched a release for that exact movie or episode, **Resume** prefers an unambiguous match from freshly requested addon results, as long as it still meets your quality and cache preferences. If the addon doesn't provide enough file information, the match is missing, or more than one source matches, normal automatic selection applies. Only a file fingerprint is saved for matching, never the old stream URL. This memory is scoped to your DebridUI user in this browser and does not sync to other devices.

Use a Continue Watching card's **⋯ → Hide from this row** to hide that saved playback in this browser, or **Undo** to restore it. It doesn't delete SIMKL history or affect other devices. A newer playback can appear in the row again.

Items without an IMDb mapping cannot launch through the stream addons. Anime episodes without SIMKL's TVDB episode mapping display progress but require choosing the episode manually, avoiding an incorrect automatic season/episode selection. SIMKL's retention and saved-playback rules still apply.

## Privacy and synchronization

- OAuth uses a one-time, user-bound database state plus an HttpOnly cookie and PKCE S256. Consent requests only `media:read`.
- Access/refresh tokens are encrypted with AES-256-GCM, bound to the DebridUI user, and stored separately from settings. They are never returned by the API or included in settings backups or persistent browser query caches.
- Database row locks serialize refreshes and playback synchronization across server instances. This is important because refreshing a SIMKL grant invalidates its previous access token.
- On visits/window focus, the server checks at most once per minute. `/sync/activities` gates playback fetches; unchanged playback timestamps reuse the saved snapshot. A daily reconciliation also handles expiry. Transient errors preserve the last good snapshot and respect backoff/`Retry-After`.
- Disconnect removes this DebridUI link/cache and attempts to revoke its grant. It does not delete SIMKL history or affect the separate MPV scrobbler. If revocation fails, the UI asks you to remove DebridUI in SIMKL Connected Apps as well.

## Checks before release

Run `bun run verify` and `bun run build`. Regression tests cover hero limits/mixing, user-bound encryption, PKCE/state expiry/replay, account isolation, serialized refresh, activities gating, provider errors/backoff, and authenticated API origins. UI previews may use explicitly labelled sample progress; they do not prove a live OAuth grant works.

Complete live validation only after server setup: connect → play/pause with the scrobbler → return to DebridUI after its cache interval → verify the saved point → Resume through fresh source selection. Repeat with an episode and another device, then test disconnect/reconnect. Never use real tokens as committed test fixtures.

API references: [AUTH V2](https://api.simkl.org/api-reference/auth-v2), [refresh behavior](https://api.simkl.org/api-reference/oauth2-tokens), [playbacks](https://api.simkl.org/api-reference/simkl/get-playback-sessions-all), [activities](https://api.simkl.org/api-reference/simkl/get-activities).
