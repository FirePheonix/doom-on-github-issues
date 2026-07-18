# Documentation

- This folder is a plain static Vercel site.
- The homepage is self-contained HTML and CSS. It does not fetch Markdown files at runtime.
- Recommended deployment: point the Vercel project root at `documentation/`.
- If you deploy the repo root instead, the top-level `vercel.json` redirects `/` to `/documentation/`.
- Deep release notes are linked directly from the homepage.
- [V1 release notes](./v1-release-notes/README.md)
- [V2 release notes](./v2-release-notes/README.md)
- [V2.5 release notes](./v2.5-release-notes/README.md)
- [V3 release notes](./v3-release-notes/README.md)
- [V3.5 release notes](./v3.5-release-notes/README.md)
- [V4 release notes](./v4-release-notes/README.md)

V4 is the current release documentation set. It covers the low-latency GitHub Issues gameplay loop, cached menu frames, S3 frame delivery, and the persistent DoomGeneric worker design.
