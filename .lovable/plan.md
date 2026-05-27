
## Goal

Rebuild `src/routes/_authenticated/attendance.tsx` so it is professional, useful, and matches the API contract — replacing the raw JSON dumps with structured UI, gating clock actions behind device geolocation, and adding a calendar to browse past attendance.

## Scope

Only `src/routes/_authenticated/attendance.tsx`. Minor token tweaks in `src/styles.css` if needed for status colors. No backend changes.

## Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ Attendance                                              │
│ Track your daily attendance.                            │
├─────────────────────────────────────────────────────────┤
│ ┌─── Status card ─────────┐  ┌─── Today summary ─────┐  │
│ │ Currently: Clocked In   │  │ Hours today: 6h 24m   │  │
│ │ Since: 09:15 AM         │  │ Sessions: 2           │  │
│ │ Location: 12.97, 77.59  │  │ Last clock-out: ...   │  │
│ │ [Clock in] [Clock out]  │  │                       │  │
│ └─────────────────────────┘  └───────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│ ┌─ Calendar (month) ──┐  ┌─ Selected day records ────┐  │
│ │ [<] November [>]    │  │ Mon, 24 Nov               │  │
│ │  M T W T F S S      │  │ ┌─────────────────────┐   │  │
│ │  · · · · ● · ·      │  │ │ 09:15 → 12:30 (3h15)│   │  │
│ │  ● ● ● ● ● · ·      │  │ │ 13:30 → 18:00 (4h30)│   │  │
│ │  ● ● · · · · ·      │  │ └─────────────────────┘   │  │
│ └─────────────────────┘  └───────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│ Recent activity (table: date · clock in · clock out ·   │
│ duration · email)                                       │
└─────────────────────────────────────────────────────────┘
```

## Behavior

**1. Geolocation-gated clock in/out**
- On click of Clock in/out: call `navigator.geolocation.getCurrentPosition` first.
- While waiting: button shows "Detecting location…" and is disabled.
- On success: POST `/attendance/clockin` (or `/clockout`) with `{ lat, lon, device: navigator.userAgent }`.
- On geo denial/error: toast error "Location permission required to clock in" and abort the API call.
- After success: invalidate `["attendance"]` queries, toast success.
- A small "Location" indicator in the status card shows current detected coords (or "Not detected yet") sourced from the last successful detection, plus a "Refresh location" link that re-runs `getCurrentPosition`.
- Current state (clocked in vs out) is derived from latest record: if `clock_in_at` exists and `clock_out_at` is null → clocked in; disable Clock in, enable Clock out (and vice versa).

**2. Latest attendance — structured display (no JSON)**
- Replace `<pre>{JSON.stringify(...)}</pre>` with a shadcn `Table`.
- Columns: Date, Clock in, Clock out, Duration (from `total_seconds`), Status badge (Completed / In progress).
- Fetched via existing `GET /attendance/latest?limit=30`.
- Empty state: "No attendance records yet."

**3. Calendar view of past attendance**
- shadcn `Calendar` (single-select, month view) on the left.
- Days that have any record get a dot marker (via `modifiers` + `modifiersClassNames`); today highlighted by default.
- Selecting a date filters the right-side panel to that day's sessions (date, in, out, duration). Compute by grouping the records from `/attendance/latest` by local date.
- Month navigation drives `limit` — fetch enough history (e.g. `limit=200`) so the visible month is covered; if user navigates to an older month with no data, show "No records for this month."

## Data & Queries

- `useQuery(["attendance","latest", { limit: 200 }])` → `GET /attendance/latest?limit=200`. Used by the status card, calendar markers, day-detail panel, and recent table.
- `useMutation` for clock in / clock out, invalidating `["attendance"]` on success.
- Drop the standalone `/attendance/my-location` query — location now comes from the browser (and is only used at click time). It was returning errors in the current UI anyway.

## Helpers (local to the file)

- `formatDuration(seconds)` → `"6h 24m"` / `"45m"` / `"30s"`.
- `formatTime(iso)` → locale time `"09:15 AM"`.
- `formatDate(iso)` → locale date.
- `groupByDay(records)` → `Map<YYYY-MM-DD, Record[]>` for the calendar/day panel.
- `getDayKey(date)` → local `YYYY-MM-DD` string.

## Design

- Cards use existing semantic tokens (`bg-card`, `text-muted-foreground`, etc.).
- Status badge: green for "Clocked in / In progress", muted for "Clocked out / Completed".
- Two-column responsive grid (`md:grid-cols-2` for status+summary; `lg:grid-cols-[auto,1fr]` for calendar+day panel). Stacks on mobile.
- Add a subtle "pulse" dot next to "Clocked in" status.

## Edge Cases

- User denies geolocation → clear error toast; do not call API.
- Browser without geolocation support → toast "Geolocation not supported by this browser."
- API returns 422 → surface server's `detail` message via the existing `ApiError` flow.
- Records with missing `clock_out_at` → duration shown as "—" and status = "In progress".

## Out of Scope

- Admin view of other employees' attendance (no `employee_id` selector).
- Manual time editing / corrections.
- Export of attendance CSV (can be a follow-up).
