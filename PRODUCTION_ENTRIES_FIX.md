# Production Entries Fix

## Goal
Production Entries must show/export the real production values submitted by the Android Kiosk App:
- Number of shots
- Actual weight
- OK/output quantity
- Rejected quantity
- Downtime minutes and reason
- Remarks

## Fix
- Legacy demo/seed production rows (`client_ref` beginning with `seed-`) are removed automatically on server schema initialization.
- Future demo seeding no longer creates production-entry rows.
- Dashboard production history excludes legacy seed rows.
- Excel/CSV production-entry exports exclude legacy seed rows.
- Full JSON backup excludes legacy seed rows from `production_entries`.
- Real Kiosk submissions are preserved.

## Verification
`npm run typecheck` passes.
`npm run build` could not complete in this environment because Next.js attempted to download the SWC package from npm and outbound network access was unavailable. This is an environment limitation, not a TypeScript error.
