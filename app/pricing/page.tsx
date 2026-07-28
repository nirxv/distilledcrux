import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing — PrepPandit',
  description: 'Simple, transparent pricing for UPSC Optional preparation. Daily, 6-month and yearly plans.',
  alternates: { canonical: 'https://preppandit.com/pricing' },
};

const plans = [
  {
    id: 'daily',
    label: 'Daily',
    price: 49,
    period: 'day',
    tag: null,
    desc: 'Perfect for exam-day sprints and last-minute revision.',
    color: '#2dd4bf',
    dim: 'rgba(45,212,191,0.06)',
    border: 'rgba(45,212,191,0.18)',
    glow: 'rgba(45,212,191,0.12)',
    features: [
      'Full platform access for 24 hours',
      'AI Answer Evaluation (unlimited)',
      'AI Chat — ask anything',
      'PYQ Bank access',
      'Syllabus-Mapped Notes',
      'Topper Answer Copies',
      'Map Practice',
    ],
  },
  {
    id: 'sixmonth',
    label: '6 Months',
    price: 3999,
    period: '6 months',
    tag: 'Most Popular',
    desc: 'Best for focused preparation cycles leading up to Mains.',
    color: '#4361ee',
    dim: 'rgba(67,97,238,0.07)',
    border: 'rgba(67,97,238,0.25)',
    glow: 'rgba(67,97,238,0.18)',
    features: [
      'Full platform access for 6 months',
      'AI Answer Evaluation (unlimited)',
      'AI Chat — ask anything',
      'PYQ Bank — 1500+ questions',
      'Syllabus-Mapped Notes',
      'Topper Answer Copies',
      'Map Practice',
      'Performance analytics',
    ],
  },
  {
    id: 'yearly',
    label: 'Yearly',
    price: 5999,
    period: 'year',
    tag: 'Best Value',
    desc: 'Full-year coverage — from Prelims to Mains interview prep.',
    color: '#e8b86d',
    dim: 'rgba(232,184,109,0.06)',
    border: 'rgba(232,184,109,0.2)',
    glow: 'rgba(232,184,109,0.14)',
    features: [
      'Full platform access for 12 months',
      'AI Answer Evaluation (unlimited)',
      'AI Chat — ask anything',
      'PYQ Bank — 1500+ questions',
      'Syllabus-Mapped Notes',
      'Topper Answer Copies',
      'Map Practice',
      'Performance analytics',
      'Priority support',
      'Early access to new features',
    ],
  },
];

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="8" cy="8" r="8" fill={color} fillOpacity="0.15" />
      <path d="M4.5 8l2.5 2.5 4.5-5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <>
      <style>{`
        .pr-wrap {
          min-height: 100vh;
          padding: 100px 2rem 5rem;
          position: relative;
          overflow: hidden;
        }
        .pr-orb1 {
          position: absolute; border-radius: 50%;
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(67,97,238,0.11) 0%, transparent 65%);
          top: -200px; left: -150px;
          filter: blur(80px); pointer-events: none; z-index: 0;
          animation: float 10s ease-in-out infinite;
        }
        .pr-orb2 {
          position: absolute; border-radius: 50%;
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(232,184,109,0.08) 0%, transparent 65%);
          bottom: 100px; right: -100px;
          filter: blur(80px); pointer-events: none; z-index: 0;
          animation: float 14s ease-in-out infinite reverse;
        }
        .pr-inner {
          max-width: 1100px;
          margin: 0 auto;
          position: relative; z-index: 1;
        }
        .pr-head {
          text-align: center;
          margin-bottom: 4rem;
        }
        .pr-tag {
          display: inline-block;
          font-family: var(--font-ui);
          font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 1rem;
        }
        .pr-title {
          font-family: var(--font-body);
          font-size: clamp(2rem, 4.5vw, 3.2rem);
          font-weight: 700; letter-spacing: -0.03em;
          color: var(--text); line-height: 1.1;
          margin-bottom: 1rem;
        }
        .pr-title em { font-style: normal; color: var(--accent); }
        .pr-sub {
          font-family: var(--font-ui);
          font-size: 1rem; color: var(--text2);
          max-width: 480px; margin: 0 auto; line-height: 1.7;
        }
        .pr-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
          align-items: start;
        }
        .pr-card {
          border-radius: 20px;
          padding: 2rem;
          border: 1px solid var(--glass-border);
          background: var(--glass-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          position: relative;
          transition: transform 0.22s, box-shadow 0.22s;
        }
        .pr-card:hover {
          transform: translateY(-6px);
        }
        .pr-card-featured {
          border-width: 1.5px;
        }
        .pr-card-tag {
          position: absolute;
          top: -13px; left: 50%; transform: translateX(-50%);
          font-family: var(--font-ui);
          font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          padding: 4px 16px; border-radius: 999px;
          white-space: nowrap;
        }
        .pr-plan-label {
          font-family: var(--font-ui);
          font-size: 0.75rem; font-weight: 600;
          letter-spacing: 0.09em; text-transform: uppercase;
          margin-bottom: 0.75rem;
        }
        .pr-price-row {
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin-bottom: 0.25rem;
        }
        .pr-currency {
          font-family: var(--font-ui);
          font-size: 1.4rem; font-weight: 600;
          color: var(--text);
          line-height: 1;
        }
        .pr-price {
          font-family: var(--font-body);
          font-size: 3rem; font-weight: 700;
          letter-spacing: -0.04em;
          color: var(--text);
          line-height: 1;
        }
        .pr-period {
          font-family: var(--font-ui);
          font-size: 0.82rem;
          color: var(--text3);
          margin-bottom: 0.85rem;
        }
        .pr-desc {
          font-family: var(--font-ui);
          font-size: 0.82rem;
          color: var(--text2);
          line-height: 1.6;
          margin-bottom: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--border);
        }
        .pr-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          margin-bottom: 1.75rem;
        }
        .pr-feature {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-family: var(--font-ui);
          font-size: 0.83rem;
          color: var(--text2);
          line-height: 1.4;
        }
        .pr-btn {
          display: block;
          width: 100%;
          padding: 0.8rem 1rem;
          border-radius: 10px;
          font-family: var(--font-ui);
          font-size: 0.88rem;
          font-weight: 600;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
          border: none;
          transition: opacity 0.15s, transform 0.15s;
        }
        .pr-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .pr-btn-outline {
          background: transparent;
          border: 1.5px solid var(--border2);
          color: var(--text);
        }
        .pr-faq {
          max-width: 640px;
          margin: 4.5rem auto 0;
          text-align: center;
        }
        .pr-faq-title {
          font-family: var(--font-body);
          font-size: 1.5rem; font-weight: 700;
          color: var(--text); margin-bottom: 2rem;
        }
        .pr-faq-list {
          display: flex; flex-direction: column; gap: 1px;
          text-align: left;
          border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden;
        }
        .pr-faq-item {
          background: var(--bg2);
          padding: 1.1rem 1.4rem;
          border-bottom: 1px solid var(--border);
        }
        .pr-faq-item:last-child { border-bottom: none; }
        .pr-faq-q {
          font-family: var(--font-ui);
          font-size: 0.88rem; font-weight: 600;
          color: var(--text); margin-bottom: 0.35rem;
        }
        .pr-faq-a {
          font-family: var(--font-ui);
          font-size: 0.82rem; color: var(--text3);
          line-height: 1.6;
        }
        @media (max-width: 900px) {
          .pr-grid { grid-template-columns: 1fr; max-width: 440px; margin: 0 auto; }
        }
      `}</style>

      <div className="pr-wrap">
        <div className="pr-orb1" />
        <div className="pr-orb2" />

        <div className="pr-inner">
          {/* Header */}
          <div className="pr-head">
            <span className="pr-tag">Pricing</span>
            <h1 className="pr-title">
              Simple, Transparent <em>Pricing</em>
            </h1>
            <p className="pr-sub">
              Choose a plan that fits your preparation timeline. No hidden fees, no auto-renewals.
            </p>
          </div>

          {/* Plans */}
          <div className="pr-grid">
            {plans.map((plan) => {
              const isFeatured = plan.tag !== null;
              return (
                <div
                  key={plan.id}
                  className={`pr-card${isFeatured ? ' pr-card-featured' : ''}`}
                  style={{
                    borderColor: isFeatured ? plan.border : undefined,
                    background: isFeatured ? plan.dim : undefined,
                    boxShadow: isFeatured ? `0 0 48px ${plan.glow}` : undefined,
                  }}
                >
                  {plan.tag && (
                    <div
                      className="pr-card-tag"
                      style={{
                        background: plan.color,
                        color: plan.id === 'sixmonth' ? '#fff' : '#000',
                      }}
                    >
                      {plan.tag}
                    </div>
                  )}

                  <div className="pr-plan-label" style={{ color: plan.color }}>
                    {plan.label}
                  </div>

                  <div className="pr-price-row">
                    <span className="pr-currency">₹</span>
                    <span className="pr-price">{plan.price.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="pr-period">per {plan.period}</div>

                  <p className="pr-desc">{plan.desc}</p>

                  <ul className="pr-features">
                    {plan.features.map((f) => (
                      <li key={f} className="pr-feature">
                        <CheckIcon color={plan.color} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/login"
                    className={isFeatured ? 'pr-btn' : 'pr-btn pr-btn-outline'}
                    style={
                      isFeatured
                        ? { background: plan.color, color: plan.id === 'sixmonth' ? '#fff' : '#000' }
                        : undefined
                    }
                  >
                    Get Started →
                  </Link>
                </div>
              );
            })}
          </div>

          {/* FAQ */}
          <div className="pr-faq">
            <h2 className="pr-faq-title">Common questions</h2>
            <div className="pr-faq-list">
              {[
                {
                  q: 'Is there a free tier?',
                  a: 'Yes — you can sign up and explore limited features for free. No card required.',
                },
                {
                  q: 'Can I switch plans?',
                  a: 'Yes. After your current plan expires you can pick any plan. Plans are non-auto-renewing.',
                },
                {
                  q: 'Which optionals are supported?',
                  a: 'Sociology, Anthropology, Political Science, Geography, Public Administration — and History Optional at historyoptional.xyz.',
                },
                {
                  q: 'What payment methods are accepted?',
                  a: 'UPI, debit/credit cards, net banking — via Razorpay.',
                },
                {
                  q: 'Is there a refund policy?',
                  a: 'Yes. Check our refund policy page for full details.',
                },
              ].map((item) => (
                <div key={item.q} className="pr-faq-item">
                  <div className="pr-faq-q">{item.q}</div>
                  <div className="pr-faq-a">{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
