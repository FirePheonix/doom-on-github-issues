# V2 to V2.5 Migration

## Behavioral Change

- before: inactivity exit was primarily enforced on the next comment
- now: session manager expires active sessions on an actual timer

## Code Movement

- worker transport remains in `src/engine.js`
- session ownership moved to `src/sessions/manager.js`
- lifecycle now calls `sessionManager` instead of `engine`

## Operational Value

- cleaner ownership boundary for future external session-manager service
- better debug visibility into active sessions
- exact inactivity expiry without waiting for another webhook
