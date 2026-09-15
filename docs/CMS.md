# CMS

Payload 3 runs inside this Next app, against the Supabase Postgres the app
already uses. There is no second service and no second datastore.

## Where things are

```
payload.config.ts              collections, admin routes, db adapter
app/(payload)/
  layout.tsx                   Payload's chrome; only the config import is ours
  cms/[[...segments]]/         the admin panel itself
  cms/importMap.js             generated; regenerate after changing views
  cms-api/                     Payload's REST and GraphQL
  views/                       our six operational screens
  uui/                         Untitled UI components, isolated Tailwind
```

## Routes

| What | Path | Why not the default |
|---|---|---|
| Admin panel | `/cms` | keeps `/admin` free |
| Payload API | `/cms-api` | `/api` is the app's own namespace |

## Schema separation

Payload's tables live in a dedicated `payload` Postgres schema
(`schemaName: 'payload'`). This is not tidiness. Payload introspects primary
keys at boot and that introspection fails on tables it does not expect to own,
so a dedicated schema means it never looks at the app's tables at all.

Payload never touches `note_overrides`, `user_profiles`, `subscriptions`,
`usage_tracking`, `user_sessions`, `book_chunks` or `rate_limits`.

## Getting in

`/cms` and `/cms-api` return a bare 404 unless the request carries
`?key=<ADMIN_SECRET_KEY>`, so the panel is not discoverable. Passing the gate
drops an 8-hour `cms_gate` cookie, and that cookie is load-bearing rather than
a convenience: the key can only ever appear on the first request, because
Payload's client navigations and its `/cms-api` fetches carry no query string,
so gating on `?key=` alone would 404 the panel's own traffic and it could never
log in.

The gate is obscurity, not access control. Payload's login is what protects the
data.

## The six views

These read the app's own tables, not Payload collections, so they are custom
views rather than collections. They are server components that query Supabase
with the service client, which bypasses RLS.

**Every one of them must be wrapped in `cmsView()` from `views/guard.tsx`.**
Payload does not gate a custom view's server component the way it gates its own
screens: on a signed-out request it renders the login chrome but still renders
the custom view and streams its RSC payload with the page. Measured here before
the guard existed, `/cms/subscribers` with no session returned a live
subscriber's email address inside the flight data. A new view that forgets the
wrapper is a data leak, not a cosmetic bug.

| View | Reads | Shows |
|---|---|---|
| Overview | all of the below | headline counts, users and paying users by optional, topics edited by subject |
| Subscribers | `subscriptions` | who is paying, on what plan, expiring when |
| Usage | `usage_tracking` | chat and evaluation counts per identity, signed in vs anonymous |
| Sessions | `user_sessions` | session lengths, distinct visitors, most visited pages |
| Content | `note_overrides` + `lib/notes` | every syllabus topic and whether its body comes from the CMS, the bundle, or nowhere yet |
| Operations | env + a one-row probe per table | whether this deploy is actually configured and reachable |

Add a view: write it under `app/(payload)/views/` **wrapped in `cmsView()`**,
register it in `payload.config.ts` under `admin.components.views`, add its link
to `views/NavLinks.tsx`, then run `npx payload generate:importmap`. The panel
will 404 on the path until the import map is regenerated.

To check a new view does not leak, request it with the gate cookie but no
session and confirm none of its own text comes back:

```
curl -s -H 'Cookie: cms_gate=1' localhost:3000/cms/<path> | grep -c '<a string only that view renders>'
```

## Styling

The views are Untitled UI on Tailwind 4, isolated inside a `.uui` wrapper.
`views/uui.css` imports `theme.css` and `utilities.css` and deliberately never
imports `preflight.css`, which would restyle Payload's own DOM. The `@source`
directives in that file are load-bearing: importing `utilities.css` directly
skips Tailwind's automatic source detection, and without them Tailwind scans
nothing and generates none of the classes the views use.

The panel is pinned to `theme: 'light'`. The Untitled UI dark token block is
not imported, so following an OS dark preference would render half-themed.

## Environment

| Variable | Used for |
|---|---|
| `DATABASE_URL` | Postgres for Payload. Supabase transaction pooler, port 6543. |
| `PAYLOAD_SECRET` | Signs CMS sessions. Any 32 random bytes. |
| `ADMIN_SECRET_KEY` | The `?key=` that opens the gate. |

The pool is capped at 8 connections: the build prerenders 137 note pages, each
able to open one, and the pooler allows 15 clients in total.

## First run

Put the real database password into `DATABASE_URL` in `.env.local`, then:

```
./scripts/db-setup.sh
```

That applies every file in `supabase/migrations`, then Payload's own migration,
then prints the tables and whether RLS is on for each. Each migration runs in a
single transaction with `ON_ERROR_STOP`, so a half-applied one never survives,
and all of them are safe to re-run.

The password is at Supabase > Project Settings > Database. Supabase shows it
only when the project is created, so if it was not saved it has to be reset
there. URL-encode special characters in it: `#` becomes `%23`, `@` becomes
`%40`.

Then open `/cms` and create the first user. `cms_users` is the auth collection;
it is separate from the app's Firebase users on purpose, since a student
account should never be a CMS account.

## Storage

The `pyq-answers` bucket holds community answer PDFs. It is public, capped at
5MB per object and restricted to `application/pdf`, so the bucket enforces the
same two limits the route does even if something reached it another way.
