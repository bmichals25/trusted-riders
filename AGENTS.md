# TrustedRiders Agent Notes

These notes are for future Codex/agent chats working in this repository.

## ClickUp

ClickUp is available for this project through the ClickUp REST API.

Do not store API tokens in repo files. Ask the user to provide or export a
fresh token when needed:

```bash
export CLICKUP_API_TOKEN="..."
```

Workspace and list details:

- Workspace/team id: `90141225613`
- Space: `TrustedRiders`
- Space id: `90145498093`
- Primary app task list: `TR_App`
- Primary app task list id: `901416188602`
- User-facing ClickUp table URL: `https://app.clickup.com/90141225613/v/l/2kydbwmd-314`

Create a task in `TR_App`:

```bash
curl -sS -X POST "https://api.clickup.com/api/v2/list/901416188602/task" \
  -H "Authorization: $CLICKUP_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "Task title",
    "description": "Task details",
    "priority": 3
  }'
```

Priority values used by ClickUp API:

- `1`: urgent
- `2`: high
- `3`: normal
- `4`: low

Check existing tasks before creating likely duplicates:

```bash
curl -sS \
  -H "Authorization: $CLICKUP_API_TOKEN" \
  "https://api.clickup.com/api/v2/list/901416188602/task?archived=false&include_closed=true&subtasks=true"
```

Current limitation:

- Suresh is not yet a ClickUp member on this workspace/list, so tasks cannot be
  assigned to him through ClickUp until he is invited. If the user asks for a
  Suresh task before that, include `Assignee: Suresh` in the description.

Known backend/API tasks already created in ClickUp:

- `86b9tu9dg`: Backend: Add driver ride accept/decline endpoints
- `86b9tu9du`: Backend: Add admin-driver chat endpoints
- `86b9tu9e4`: Backend: Add Expo push token registration endpoint
- `86b9tu9er`: Backend: Enrich ride detail payload for mobile UI
- `86b9tu9eu`: Backend: Require auth and driver scoping on driver rides endpoint
- `86b9tu9ey`: Backend: Publish OpenAPI docs from deployed backend
- `86b9tupug`: Backend: Add backend-owned planned route geometry for rides
- `86b9tv6fa`: Backend: Add authenticated driver profile endpoint for mobile
- `86b9tva47`: Dispatch Frontend: Build editable driver profile screen

## Backend

The canonical TrustedRiders backend is Suresh's Flask API:

```text
https://pretyphoid-electrovalently-zena.ngrok-free.dev
```

See `docs/suresh-fleet-api-inventory.md` for the latest discovered API routes
and mobile app contract notes.
