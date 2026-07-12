import { useState, useEffect } from 'react';
import type { IntakeData, WhatsAppIntake, WebFormIntake, LeadIntake, IntakeBrief } from '../types';
import { api } from '../api';
import { T } from '../tokens';
import { Label, Mono, Rule } from './primitives';
import { formatEventDate } from '../lib/calendarHelpers';
import { t } from '../config';

/** Resolve an inbox channel label from the pack strings, falling back to the raw value. */
function channelLabel(channel: string): string {
  const key = `inbox.channel.${channel}`;
  const label = t(key);
  return label === key ? channel : label;
}

function BriefPanel({ brief }: { brief: IntakeBrief }) {
  const rows: [string, string][] = [
    [t('intake.weddingDateShort'), brief.wedding_date],
    [t('common.venue'), brief.venue],
    [t('common.garment'), brief.garment],
    [t('common.style'), brief.style],
    [t('intake.budget'), brief.budget_tier],
    [t('nav.fabrics'), brief.fabric_notes],
  ];
  return (
    <div>
      <Label style={{ marginBottom: 12 }}>{t('intake.summary')}</Label>
      {rows.map(([k, v]) => v ? (
        <div key={k} style={{ padding: '8px 0', borderBottom: `1px solid ${T.hairline}` }}>
          <Mono size={9} color={T.ink3} style={{ marginBottom: 3 }}>{k}</Mono>
          <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, lineHeight: 1.4 }}>{v}</div>
        </div>
      ) : null)}
      {brief.extra_notes && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: T.paper2, borderLeft: `2px solid ${T.gold}` }}>
          <Mono size={9} color={T.ink3} style={{ marginBottom: 4 }}>{t('common.notes')}</Mono>
          <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink2, lineHeight: 1.5 }}>{brief.extra_notes}</div>
        </div>
      )}
    </div>
  );
}

function WhatsAppView({ intake }: { intake: WhatsAppIntake }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#25D366' }} />
        <Mono size={10} color={T.ink3}>WhatsApp</Mono>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* key uses index — safe for static demo data; add id to WhatsAppMessage if thread becomes dynamic */}
        {intake.thread.map((msg, i) => {
          const isJulia = msg.role === 'julia';
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isJulia ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '78%',
                padding: '9px 12px',
                background: isJulia ? T.accent : T.paper2,
                color: isJulia ? T.paper : T.ink,
                borderRadius: isJulia ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                fontFamily: T.sans,
                fontSize: 13,
                lineHeight: 1.45,
              }}>
                {msg.text}
              </div>
              <Mono size={9} color={T.ink3} style={{ marginTop: 3 }}>{msg.time}</Mono>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WebFormView({ intake }: { intake: WebFormIntake }) {
  const FORM_LABELS: Record<string, string> = {
    name: t('intake.fieldName'),
    email: t('common.email'),
    phone: t('common.phone'),
    wedding_date: t('intake.weddingDateShort'),
    venue: t('common.venue'),
    style_notes: t('intake.styleNotes'),
    budget_range: t('intake.budget'),
    how_did_you_hear: t('intake.referral'),
  };
  const date = new Date(intake.submitted_at).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase' as const, color: T.paper, background: T.ink2, padding: '2px 7px', borderRadius: 999 }}>{t('intake.viaWeb')}</div>
        <Mono size={10} color={T.ink3}>{date}</Mono>
      </div>
      <div style={{ border: `1px solid ${T.hairline2}`, background: T.paper }}>
        {Object.entries(intake.form_data).map(([k, v], i, arr) => (
          <div key={k} style={{ display: 'flex', gap: 16, padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${T.hairline}` : 'none', flexWrap: 'wrap' as const }}>
            <Mono size={10} color={T.ink3} style={{ width: 120, flexShrink: 0 }}>{FORM_LABELS[k] ?? k}</Mono>
            <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, flex: 1 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadView({ intake }: { intake: LeadIntake }) {
  const date = formatEventDate(intake.received_at.slice(0, 10));
  const fieldEntries = Object.entries(intake.fields);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Mono size={10} color={T.ink3} style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>{channelLabel(intake.channel)}</Mono>
        <Mono size={10} color={T.ink3}>{date}</Mono>
      </div>
      {intake.message && (
        <div style={{
          padding: '9px 12px', background: T.paper2, color: T.ink,
          borderRadius: '12px 12px 12px 2px',
          fontFamily: T.sans, fontSize: 13, lineHeight: 1.5,
          marginBottom: fieldEntries.length > 0 ? 16 : 0,
        }}>
          {intake.message}
        </div>
      )}
      {fieldEntries.length > 0 && (
        <div style={{ border: `1px solid ${T.hairline2}`, background: T.paper }}>
          {fieldEntries.map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', gap: 16, padding: '10px 14px', borderBottom: i < fieldEntries.length - 1 ? `1px solid ${T.hairline}` : 'none', flexWrap: 'wrap' as const }}>
              <Mono size={10} color={T.ink3} style={{ width: 120, flexShrink: 0 }}>{k}</Mono>
              <Mono size={13} color={T.ink} style={{ flex: 1 }}>{v}</Mono>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders a client's intake record — the conversation/form/lead it came from,
 * plus the extracted brief.
 *
 * Originally its own full-height tab (with a two-column split on desktop);
 * now embedded inline as a collapsed `<details>`-style section within Fitxa
 * (see `ProfileScreen.tsx`), so it always lays out as a simple stacked
 * column that flows with the rest of the page — no `height: 100%` split,
 * no independent scroll container.
 */
export function IntakeTab({ clientId }: { clientId: number }) {
  const [data, setData] = useState<IntakeData | null | 'loading'>('loading');

  useEffect(() => {
    api.getIntake(clientId)
      .then(setData)
      .catch(() => setData(null));
  }, [clientId]);

  if (data === 'loading') {
    return <div style={{ padding: '12px 0', fontFamily: T.mono, fontSize: 11, color: T.ink3 }}>{t('common.loading')}</div>;
  }

  if (data === null) {
    return (
      <div style={{ padding: '12px 0' }}>
        <Mono size={11} color={T.ink3}>{t('intake.noData')}</Mono>
      </div>
    );
  }

  const sourceView = data.source === 'whatsapp'
    ? <WhatsAppView intake={data} />
    : data.source === 'web_form'
    ? <WebFormView intake={data} />
    : <LeadView intake={data} />;

  // Lead intakes have no extracted brief — the source pane is the whole story.
  if (data.source === 'lead') {
    return <div style={{ padding: '12px 0' }}>{sourceView}</div>;
  }

  return (
    <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {sourceView}
      <Rule />
      <BriefPanel brief={data.brief} />
    </div>
  );
}
