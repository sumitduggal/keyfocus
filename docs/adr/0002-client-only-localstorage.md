# Client-only persistence in localStorage

The focus space has no backend. Frames, note bodies, and the pomodoro duration persist to `localStorage` under `focus-space-*` keys; nothing leaves the device.

This keeps the prototype a pure client-side Vite app — no server, auth, or database to run or deploy. The trade-off is deliberate: state is per browser and per device, so it never syncs and is lost when site data is cleared. If accounts or sync arrive, the three `localStorage` keys are the seam to replace.
