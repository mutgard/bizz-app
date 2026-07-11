import { useState, useEffect } from 'react';
import type { ClientBrief } from '../types';
import { api } from '../api';
import { T } from '../tokens';
import { t } from '../config';

export function BriefPage({ token }: { token: string }) {
  const [brief, setBrief] = useState<ClientBrief | null | 'loading'>('loading');

  useEffect(() => {
    api.getBrief(token)
      .then(setBrief)
      .catch(() => setBrief(null));
  }, [token]);

  if (brief === 'loading') {
    return <div style={{ minHeight: '100dvh', background: T.paper }} />;
  }

  if (brief === null) {
    return (
      <div style={{
        minHeight: '100dvh', background: T.paper,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.mono, fontSize: 11, letterSpacing: 1.2,
        textTransform: 'uppercase' as const, color: T.ink3,
      }}>
        {t('brief.invalid')}
      </div>
    );
  }

  const rows: [string, string][] = [
    [t('common.venue'), brief.venue],
    [t('common.garment'), brief.garment],
    [t('common.style'), brief.style],
    [t('nav.fabrics'), brief.fabric_notes],
  ];

  return (
    <div style={{ minHeight: '100dvh', background: T.paper, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 28px 80px' }}>

        {/* Atelier header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, lineHeight: 1 }}>Juliette</span>
            <span style={{ fontFamily: T.serif, fontSize: 22, fontStyle: 'italic', color: T.gold, lineHeight: 1 }}>Atelier</span>
          </div>
          <div style={{ height: 1, background: T.hairline, marginTop: 16 }} />
        </div>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{
            fontFamily: T.serif, fontSize: 44, fontStyle: 'italic',
            lineHeight: 1.1, letterSpacing: -0.5, color: T.ink,
          }}>
            {brief.client_name}
          </div>
          <div style={{
            fontFamily: T.mono, fontSize: 11, letterSpacing: 1.2,
            textTransform: 'uppercase' as const, color: T.ink3, marginTop: 12,
          }}>
            {t('brief.proposal')} · {brief.wedding_date}
          </div>
        </div>

        {/* Brief rows */}
        <div>
          {rows.map(([label, value]) => (
            <div key={label} style={{ padding: '20px 0', borderTop: `1px solid ${T.hairline}` }}>
              <div style={{
                fontFamily: T.mono, fontSize: 9, letterSpacing: 1.2,
                textTransform: 'uppercase' as const, color: T.ink3, marginBottom: 8,
              }}>
                {label}
              </div>
              <div style={{ fontFamily: T.sans, fontSize: 15, color: T.ink, lineHeight: 1.65 }}>
                {value}
              </div>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${T.hairline}` }} />
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 56 }}>
          <div style={{
            fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8,
            textTransform: 'uppercase' as const, color: T.ink3,
          }}>
            Juliette Atelier
          </div>
        </div>

      </div>
    </div>
  );
}
