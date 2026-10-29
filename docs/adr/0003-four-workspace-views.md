# Four workspace views over shared workspace state

Status: accepted

Keyfocus will offer Operator Console (`operator`), Calm Workspace (`calm`), Immersive Focus (`immersive`) and Daily Overview (`overview`) as four presentations of one workspace. A shared `WorkspaceApp` owns frames, feature data, commands, persistence and the global keyboard model. Four adapters behind the `WorkspaceView` interface receive snapshots and route input back through shared actions; they do not own feature state or persistence. Switching views therefore cannot create, delete, duplicate or reset workspace data.

## Considered options

We rejected implementing each view as a separate feature stack. That would duplicate Todo, Habits, Reminders, Bookmarks, Notes, Pomodoro and Music behaviour, make fixes and tests diverge, and put data continuity at risk whenever a person changes views. Separate adapters preserve the approved visual and structural differences while keeping feature behaviour implemented once.

## Consequences

The selected view persists independently of theme in `localStorage`. Missing, unknown or damaged values fall back to `operator`, which is also the first-launch and existing-user default. Operator Console remains the regression baseline.

Only the selected view is needed at runtime. Non-default views will be lazy-loaded so their code stays out of the initial bundle; shared feature modules remain common. A view change may suspend while its adapter loads, but shared workspace state and playback remain owned by `WorkspaceApp` and continue uninterrupted.
