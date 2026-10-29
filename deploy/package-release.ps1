$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$archivePath = 'output/marketplace-qa/hl-motors-release.tar.gz'
New-Item -ItemType Directory -Force -Path 'output/marketplace-qa' | Out-Null
# Explicit source allowlist: private env files, local catalogue and Git stay out.
$releaseFiles = @(
  'app', 'components', 'lib', 'public', 'styles.css', 'marketplace.css',
  'scripts/postgres-migrate.cjs', 'scripts/postgres-bootstrap.cjs',
  'scripts/video-worker.cjs',
  'supabase/migrations', 'deploy/Caddyfile', 'deploy/prepare-host.sh',
  'deploy/README.md', 'deploy/production.env.example', 'deploy/r2-cors.json',
  'deploy/smoke.cjs', 'Dockerfile', 'compose.yaml', '.dockerignore',
  'package.json', 'package-lock.json', 'next.config.ts', 'next-env.d.ts', 'tsconfig.json'
)
& tar -czf $archivePath @releaseFiles
if ($LASTEXITCODE -ne 0) { throw 'Release archive failed' }
Write-Output "Release created: $archivePath"
