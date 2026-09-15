import React from 'react';
import { cmsView } from './guard';
import { NOTE_SUBJECTS, notesForSubject } from '@/lib/notes';
import { Shell, Stats, TableFrame, Row, Cell } from './Shell';
import { Badge } from '../uui/base/badges';
import { readTable, relative, SUBJECT_LABEL } from './data';

type Override = { slug: string; content: string | null; updated_at?: string | null };

/**
 * Every syllabus topic the site knows about, and whether its body has been
 * edited in the CMS. A topic with no override serves the bundled text from
 * lib/noteContent; pub-admin has metadata but no bundled bodies yet, so its
 * topics are shown as awaiting content rather than simply unedited.
 */
export default cmsView(async function ContentView() {
  const { rows, error } = await readTable<Override>(
    'note_overrides', 'slug, content, updated_at', { column: 'updated_at' }, 1000);

  const byslug = new Map(rows.map(o => [o.slug, o]));

  const notes = NOTE_SUBJECTS.flatMap(subject =>
    notesForSubject(subject).map(n => ({
      subject,
      slug: n.slug,
      title: n.title,
      paper: n.paper,
      override: byslug.get(n.slug) ?? null,
      // pub-admin is the one subject with no module in lib/noteContent.
      bundled: subject !== 'pub-admin',
    })));

  const edited = notes.filter(n => n.override?.content);
  const missing = notes.filter(n => !n.override?.content && !n.bundled);

  return (
    <Shell title="Content" count={`${notes.length} syllabus topics`} error={error}>
      <Stats items={[
        { label: 'Topics', value: notes.length },
        { label: 'Edited in CMS', value: edited.length },
        { label: 'Serving bundled text', value: notes.length - edited.length - missing.length },
        { label: 'No body yet', value: missing.length },
      ]} />

      <TableFrame
        min={820}
        empty={notes.length === 0}
        head={[
          { label: 'Topic' }, { label: 'Subject' }, { label: 'Paper', align: 'right' },
          { label: 'Size', align: 'right' }, { label: 'Edited', align: 'right' },
          { label: 'Source', align: 'right' },
        ]}
      >
        {notes.map(n => (
          <Row key={`${n.subject}/${n.slug}`}>
            <Cell strong wrap>{n.title}</Cell>
            <Cell dim>{SUBJECT_LABEL[n.subject] ?? n.subject}</Cell>
            <Cell align="right" mono dim>{n.paper}</Cell>
            <Cell align="right" mono dim>
              {n.override?.content ? `${Math.round(n.override.content.length / 1000)}k` : '—'}
            </Cell>
            <Cell align="right" dim>{relative(n.override?.updated_at)}</Cell>
            <Cell align="right">
              {n.override?.content
                ? <Badge type="pill-color" size="sm" color="success">CMS</Badge>
                : n.bundled
                  ? <Badge type="pill-color" size="sm" color="gray">Bundled</Badge>
                  : <Badge type="pill-color" size="sm" color="warning">Pending</Badge>}
            </Cell>
          </Row>
        ))}
      </TableFrame>
    </Shell>
  );
});
