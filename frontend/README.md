# CivicWatch Frontend

React (Vite) dashboard UI for exploring legislators’ posts by time, topic, geography, and party mix.

## Run

```bash
npm install
npm run dev
```

Defaults:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8500` (see `src/utils/api`)

## Key UI pieces

- `src/components/Sidebar.jsx`: filters (party/state/topics) + topic list behavior/icons
- `src/components/TimelineContext.jsx`: top-level overview KPIs + metadata panels
- `src/components/TopVisualization.jsx`: treemap + grid-map toggle (state grid heatmap)

## Data contract (what the UI expects)

- The UI calls backend endpoints under `/api/*`.
- `TopVisualization` calls `/api/topics/breakdown` and expects `party_breakdown`, `state_breakdown`, and `state_party_breakdown`.
