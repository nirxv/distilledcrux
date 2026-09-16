import path from 'path';
import { fileURLToPath } from 'url';
import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Payload runs inside this Next app and against the Supabase Postgres the app
 * already uses, so there is no second service and no second datastore.
 *
 * Two routes are moved off their defaults deliberately:
 *   admin  /cms       keeps /admin free
 *   api    /cms-api   because a catch-all at /api would sit in the same URL
 *                     space as the app's own routes
 *
 * Payload owns the tables it creates, in its own `payload` schema. It never
 * touches note_overrides, user_profiles, subscriptions, usage_tracking,
 * user_sessions, book_chunks or rate_limits.
 */

const SUBJECTS = [
  { label: 'Sociology', value: 'sociology' },
  { label: 'Anthropology', value: 'anthropology' },
  { label: 'PSIR', value: 'polsci' },
  { label: 'Geography', value: 'geography' },
  { label: 'Public Administration', value: 'pub-admin' },
];

export default buildConfig({
  admin: {
    user: 'cms_users',
    meta: { titleSuffix: ' · Distilled Crux' },
    // Light only. The views are built on Untitled UI, whose dark token block is
    // not imported, so letting the panel follow an OS dark preference would
    // render half-themed.
    theme: 'light',
    components: {
      // These screens read tables the app owns rather than Payload collections,
      // so they are custom views. They are server components that query
      // Supabase directly; Payload's own auth already gates everything
      // under /cms.
      afterNavLinks: ['/app/(payload)/views/NavLinks.tsx#default'],
      views: {
        overview:      { Component: '/app/(payload)/views/Overview.tsx#default',      path: '/overview' },
        users:         { Component: '/app/(payload)/views/Users.tsx#default',         path: '/users' },
        subscribers:   { Component: '/app/(payload)/views/Subscribers.tsx#default',   path: '/subscribers' },
        usage:         { Component: '/app/(payload)/views/Usage.tsx#default',         path: '/usage' },
        sessions:      { Component: '/app/(payload)/views/Sessions.tsx#default',      path: '/sessions' },
        content:       { Component: '/app/(payload)/views/Content.tsx#default',       path: '/content' },
        operations:    { Component: '/app/(payload)/views/Operations.tsx#default',    path: '/operations' },
      },
    },
  },
  routes: {
    admin: '/cms',
    api: '/cms-api',
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'set-PAYLOAD_SECRET-in-env-local',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    // Payload lives in its own Postgres schema. This is not tidiness: Payload
    // introspects primary keys at boot, and that introspection fails on tables
    // it does not expect to own. A dedicated schema means it never looks at
    // the app's tables at all.
    schemaName: 'payload',
    pool: {
      connectionString: process.env.DATABASE_URL || '',
      // The build prerenders 137 note pages, each able to open a connection.
      // Capped so a build cannot exhaust the pooler, which allows 15 clients.
      max: 8,
    },
  }),
  collections: [
    {
      slug: 'cms_users',
      auth: true,
      admin: { useAsTitle: 'email', group: 'System' },
      fields: [{ name: 'name', type: 'text' }],
    },
    {
      slug: 'notes',
      labels: { singular: 'Note', plural: 'Notes' },
      admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'subject', 'paper', 'topic', 'updatedAt'],
        group: 'Syllabus',
      },
      versions: { drafts: true },
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'slug', type: 'text', required: true, unique: true,
          admin: { description: 'Must match the slug in lib/notes so the site can find it.' },
        },
        { name: 'subject', type: 'select', required: true, options: SUBJECTS },
        {
          name: 'paper', type: 'select', required: true,
          options: [{ label: 'Paper 1', value: '1' }, { label: 'Paper 2', value: '2' }],
        },
        { name: 'section', type: 'text' },
        { name: 'topic', type: 'number', admin: { description: 'Ordinal within the syllabus.' } },
        { name: 'description', type: 'textarea' },
        { name: 'subtopics', type: 'array', fields: [{ name: 'label', type: 'text', required: true }] },
        { name: 'content', type: 'richText' },
      ],
    },
    {
      slug: 'announcements',
      labels: { singular: 'Announcement', plural: 'Announcements' },
      admin: { useAsTitle: 'title', defaultColumns: ['title', 'kind', 'createdAt'], group: 'Editorial' },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'link', type: 'text' },
        {
          name: 'kind', type: 'select', required: true, defaultValue: 'announcement',
          options: [
            { label: 'Announcement', value: 'announcement' },
            { label: 'Note', value: 'note' },
            { label: 'Current affairs', value: 'current_affairs' },
          ],
        },
      ],
    },
  ],
});
