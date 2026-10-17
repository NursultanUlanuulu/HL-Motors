# Production deployment

The initial catalogue is intentionally empty. Migrations only seed dictionaries and
manager contacts. Do not run demo-preview, import fixtures or upload a local catalogue.

## Before deployment

- Create the agreed DigitalOcean Ubuntu 24.04 server (Singapore, Basic Regular,
  2 vCPU / 4 GB / 80 GB). Final billing activation is performed by the owner.
- Install Docker Engine and the Compose plugin from Docker's official repository.
  Permit SSH, HTTP and HTTPS in the host/cloud firewall. Database and app ports
  are not published. Verify SSH key access before changing SSH settings.
- Activate R2. Create a media bucket and connect `media.firstseven-auto.com`.
  Set its CORS from `r2-cors.json`. Scope the app's object read/write token to
  that bucket. Do not place database backups in the public media bucket.
- Copy `production.env.example` to root `.env.production.local`. Use two distinct
  random 32-byte hex database passwords, a strong admin password and a random
  session secret. This ignored file must have mode 600 and must not enter Git,
  screenshots, command output or Docker build context.
- Preserve all existing mail/DKIM/verification DNS records. Point root and `www`
  at the server only after the application is healthy. Start DNS-only: Caddy
  terminates HTTPS and overwrites the app's trusted client IP header. Enabling a
  Cloudflare proxy later requires separately configuring trusted proxy IPs.

## Deploy

For a Windows source release, run `deploy/package-release.ps1`. The explicit
allowlist includes both root CSS files and excludes private configuration,
local demo data and Git. Copy the archive to `/opt/hl-motors`, extract there,
and maintain the private environment files separately.

Run from the repository root on the server:

```sh
docker compose --env-file .env.production.local build migrate
docker compose --env-file .env.production.local up -d
docker compose --env-file .env.production.local ps
```

The migration service waits for PostgreSQL and creates the restricted `hl_app`
login; the web app never receives the database owner's password. A failed
migration prevents app startup. Migration checksums protect applied SQL files.

`MEDIA_PUBLIC_URL` is also a build argument. Rebuild the image if the media origin
changes. Set `APP_VERSION` to the deployed Git commit so earlier images remain
available for rollback. Never use `docker compose down -v` on production.

## Required acceptance checks

- Verify HTTPS on root and `www`, all three languages and an empty catalogue.
- Sign in, create a temporary test car, upload a photo and MP4, edit and delete
  that test car. Verify a real browser PUT to R2 (CORS and signature), image
  optimization, gallery and logout. Confirm public admin writes are denied.
- Restart the app and verify contacts and login remain functional.
- Check the website and uploads from the administrator's actual connection in
  China. A server-side connectivity check is not a substitute.

`deploy/smoke.cjs` is an opt-in launch check for an **empty** catalogue. Run it
inside the application container, where the existing credentials are available.
It logs in through the public HTTPS site, creates/edits/deletes its own temporary
test car, uploads/removes a PNG, checks CORS and revokes its session. Set
`CHECK_PUBLIC_MEDIA=true` to also check public media and image optimization.
It never prints passwords, session cookies or signed URLs. Do not substitute it
for the browser editor/MP4/China checks listed above.

## Backups and recovery — deferred by owner

On 17 October 2026 the owner explicitly asked not to upload backups yet.
No backup dump, upload, timer or restoration has been executed. The private R2
bucket and its separate limited credential are prepared but unused. Enable this
only after the owner authorizes it again; until then PostgreSQL has no off-server
recovery copy.

Create daily custom-format `pg_dump` backups, encrypt them and transfer them to a
**separate private bucket** using a dedicated limited credential. Keep an
independent protected copy of `.env.production.local` and the SSH private key.
Do not store backups on the same server only. Set retention and monitor failures.

Example manual dump on the server (no passwords printed):

```sh
umask 077
mkdir -p deploy/backups
docker compose --env-file .env.production.local exec -T db \
  pg_dump -U postgres -d hl_motors -Fc > deploy/backups/hl-motors.dump
```

Restore into a **separate disposable database**, bootstrap required roles first,
and check vehicle/contact counts and constraints. A successful dump alone is not
a verified backup. Scheduling, off-server upload and a real restore test are still
deployment tasks; they are not activated by this repository configuration.
