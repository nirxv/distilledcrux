'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const OPTIONAL_TO_ROUTE: Record<string, string> = {
  sociology: 'sociology',
  anthropology: 'anthropology',
  geography: 'geography',
  'political-science': 'polsci',
  'public-administration': 'pub-admin',
  history: 'history',
};

const PYQS_ENABLED = new Set(['sociology', 'anthropology', 'political-science']);

export default function HomeToolsList() {
  const [route, setRoute] = useState<string | null>(null);
  const [hasPyqs, setHasPyqs] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setRoute(null); return; }
      try {
        const token = await u.getIdToken();
        const r = await fetch('/api/user-profile', { headers: { 'x-user-token': token } });
        if (!r.ok) return;
        const d = await r.json();
        const raw = d.optional as string | null;
        if (!raw) return;
        setRoute(OPTIONAL_TO_ROUTE[raw] ?? raw);
        setHasPyqs(PYQS_ENABLED.has(raw));
      } catch { /* ignore */ }
    });
    return unsub;
  }, []);

  const notesHref  = route ? `/notes/${route}`    : '/login';
  const pyqHref    = route ? (hasPyqs ? `/${route}/pyqs` : `/notes/${route}`) : '/login';

  const tools = [
    { label: 'AI Answer Evaluation', desc: 'Upload handwritten answers. Get marks, section feedback and a model answer calibrated to the UPSC rubric.', num: '01', href: '/evaluate' },
    { label: 'Syllabus-Mapped Notes', desc: 'Every topic, thinker, and debate structured for Mains written to be read before the exam.', num: '02', href: notesHref },
    { label: 'PYQ Bank', desc: '1500+ previous year questions, topic-wise. Model answers written the way toppers actually write.', num: '03', href: pyqHref },
    { label: 'AI Chat', desc: 'Ask anything from your syllabus. Structured answers with thinkers, arguments, and exam-ready language.', num: '04', href: '/chat' },
  ];

  return (
    <div className="lp-tools-list">
      {tools.map((t) => (
        <Link key={t.label} href={t.href} className="lp-tool-item" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <span className="lp-tool-num">{t.num}</span>
          <div>
            <div className="lp-tool-label">{t.label}</div>
            <div className="lp-tool-desc">{t.desc}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
