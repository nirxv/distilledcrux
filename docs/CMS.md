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

## The six views

These read the app's own tables, not Payload collections, so they are custom
views rather than collections. They are server components that query Supabase
with the service client; Payload's auth already gates everything under `/cms`.

| View | Reads | Shows |
|---|---|---|
| Overview | all of the below | headline counts, users and paying users by optional, topics edited by subject |
| Subscribers | `subscriptions` | who is paying, on what plan, expiring when |
| Usage | `usage_tracking` | chat and evaluation counts per identity, signed in vs anonymous |
| Sessions | `user_sessions` | session lengths, distinct visitors, most visited pages |
| Content | `note_overrides` + `lib/notes` | every syllabus topic and whether its body comes from the CMS, the bundle, or nowhere yet |
| Operations | env + a one-row probe per table | whether this deploy is actually configured and reachable |

Add a view: write it under `app/(payload)/views/`, register it in
`payload.config.ts` under `admin.components.views`, add its link to
`views/NavLinks.tsx`, then run `npx payload generate:importmap`. The panel will
404 on the path until the import map is regenerated.

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

The pool is capped at 8 connections: the build prerenders 137 note pages, each
able to open one, and the pooler allows 15 clients in total.

## First run

Not done yet. `DATABASE_URL` in `.env.local` still carries a placeholder
password, so Payload cannot reach Postgres and `/cms` will not load.

```
npx payload migrate:create      # generates the DDL for the payload schema
npx payload migrate             # applies it
```

Then open `/cms` and create the first user. `cms_users` is the auth collection;
it is separate from the app's Firebase users on purpose, since a student
account should never be a CMS account.
