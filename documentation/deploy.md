# Deploying on Vercel

This documentation set is designed to be hosted as a static Vercel site.

## Recommended Setup

1. Create a new Vercel project from this repository.
2. Set the project root to `documentation/`.
3. Use the static preset or "Other" framework preset.
4. Leave the build command empty.
5. Set the output directory to `.` if Vercel asks for one.

With that configuration, Vercel serves `documentation/index.html` directly as a self-contained documentation page.

## Alternate Setup

If you deploy the repository root instead of `documentation/`, the top-level `vercel.json` redirects `/` to `/documentation/`.
That keeps the docs site reachable, but the cleanest setup is still to deploy `documentation/` as the project root.

## What Gets Served

- `index.html` is the docs page.
- `index.css` styles the landing page.
- `v1-release-notes/` through `v4-release-notes/` remain in the repository as the underlying source docs.

## Validation

Before deploying, confirm that:

- `documentation/index.html` opens without a build step.
- The page loads without client-side fetch errors.
- The external release note links open correctly.
