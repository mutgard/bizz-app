import { useState, useEffect } from 'react';
import type { DemoScenarioSummary, DemoScenario, DemoScenarioWhatsApp, DemoScenarioWebForm } from '../types';
import { api } from '../api';
import { T } from '../tokens';
import { Label, Mono, Serif } from '../components/primitives';
import { useIsMobile } from '../hooks/useIsMobile';
import { t } from '../config';

interface Props {
  onClientCreated: () => void;
}

// ── WhatsApp thread column ──────────────────────────────────────────────────

function WhatsAppColumn({ scenario }: { scenario: DemoScenarioWhatsApp }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#25D366' }} />
        <Mono size={10} color={T.ink3}>{t('intake.whatsappConversation')}</Mono>
      </div>
      {scenario.thread.map((msg, i) => {
        const isJulia = msg.role === 'julia';
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isJulia ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%', padding: '9px 12px',
              background: isJulia ? T.accent : T.paper2,
              color: isJulia ? T.paper : T.ink,
              borderRadius: isJulia ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              fontFamily: T.sans, fontSize: 13, lineHeight: 1.45,
            }}>{msg.text}</div>
            <Mono size={9} color={T.ink3} style={{ marginTop: 3 }}>{msg.time}</Mono>
          </div>
        );
      })}
    </div>
  );
}

// ── Web form column ─────────────────────────────────────────────────────────

function WebFormColumn({ scenario }: { scenario: DemoScenarioWebForm }) {
  const FORM_LABELS: Record<string, string> = {
    name: t('intake.fieldName'), email: t('common.email'), phone: t('common.phone'),
    wedding_date: t('intake.weddingDateShort'), venue: t('common.venue'),
    style_notes: t('intake.styleNotes'), budget_range: t('intake.budget'),
    how_did_you_hear: t('intake.referral'),
  };
  const date = new Date(scenario.submitted_at).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase' as const, color: T.paper, background: T.ink2, padding: '2px 7px', borderRadius: 999 }}>{t('intake.viaWeb')}</div>
        <Mono size={10} color={T.ink3}>{date}</Mono>
      </div>
      <div style={{ border: `1px solid ${T.hairline2}`, background: T.paper }}>
        {Object.entries(scenario.form_data).map(([k, v], i, arr) => (
          <div key={k} style={{ display: 'flex', gap: 16, padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${T.hairline}` : 'none', flexWrap: 'wrap' as const }}>
            <Mono size={10} color={T.ink3} style={{ width: 120, flexShrink: 0 }}>{FORM_LABELS[k] ?? k}</Mono>
            <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, flex: 1 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Brief column ────────────────────────────────────────────────────────────

function BriefColumn({ scenario }: { scenario: DemoScenario }) {
  const { brief } = scenario;
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
      <Label style={{ marginBottom: 12 }}>{t('intake.briefExtracted')}</Label>
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

// ── Client card + action column ─────────────────────────────────────────────

function ClientCardColumn({ scenario, onClientCreated }: { scenario: DemoScenario; onClientCreated: (id: number) => void }) {
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState('');
  const { client_defaults: d } = scenario;

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const c = await api.createClient({
        name: d.name, wedding_date: d.wedding_date, wedding_date_iso: d.wedding_date_iso,
        days_until: d.days_until, status: 'prospect', garment: d.garment,
        garment_style: d.garment_style, phone: d.phone, email: d.email, notes: d.notes,
      });
      setCreated(true);
      setTimeout(() => onClientCreated(c.id), 800);
    } catch {
      setError(t('intake.createError'));
      setCreating(false);
    }
  };

  return (
    <div>
      <Label style={{ marginBottom: 12 }}>{t('intake.proposedProfile')}</Label>
      <div style={{ border: `1px solid ${T.hairline2}`, padding: '16px' }}>
        <Serif size={20} italic style={{ display: 'block', marginBottom: 12 }}>{d.name}</Serif>
        {([
          [t('event.keyDate'), d.wedding_date],
          [t('common.garment'), d.garment],
          [t('common.style'), d.garment_style],
          d.phone ? [t('common.phone'), d.phone] : null,
          d.email ? [t('common.email'), d.email] : null,
        ] as ([string, string] | null)[]).filter(Boolean).map(row => {
          const [k, v] = row as [string, string];
          return (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.hairline}` }}>
              <Mono size={9} color={T.ink3}>{k}</Mono>
              <Mono size={9} color={T.ink}>{v}</Mono>
            </div>
          );
        })}
        {d.notes && (
          <div style={{ marginTop: 10, padding: '8px', background: T.paper2 }}>
            <Mono size={9} color={T.ink2}>{d.notes}</Mono>
          </div>
        )}
      </div>
      {error && <Mono size={10} color={T.accent} style={{ marginTop: 8, display: 'block' }}>{error}</Mono>}
      <button
        onClick={handleCreate}
        disabled={creating || created}
        style={{
          width: '100%', marginTop: 16, padding: '14px',
          background: created ? T.accent : creating ? T.ink3 : T.ink,
          color: T.paper, border: 'none',
          fontFamily: T.mono, fontSize: 12, letterSpacing: 0.8,
          textTransform: 'uppercase', cursor: creating || created ? 'not-allowed' : 'pointer',
        }}
      >
        {created ? t('intake.addedProspect') : creating ? t('common.creating') : t('intake.addAsProspect')}
      </button>
    </div>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────

export function IntakeDemoScreen({ onClientCreated }: Props) {
  const mobile = useIsMobile();
  const [summaries, setSummaries] = useState<DemoScenarioSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [scenario, setScenario] = useState<DemoScenario | null>(null);
  const [mobileTab, setMobileTab] = useState<'thread' | 'brief' | 'fitxa'>('thread');
  const px = mobile ? 20 : 40;

  useEffect(() => {
    api.listDemoScenarios().then(list => {
      setSummaries(list);
      if (list.length > 0) setSelectedId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setScenario(null);
    api.getDemoScenario(selectedId).then(setScenario);
  }, [selectedId]);

  const threadCol = scenario
    ? (scenario.source === 'whatsapp'
      ? <WhatsAppColumn scenario={scenario as DemoScenarioWhatsApp} />
      : <WebFormColumn scenario={scenario as DemoScenarioWebForm} />)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: `14px ${px}px`, borderBottom: `1px solid ${T.hairline}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Label>{t('intake.stepLabel')}</Label>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          style={{
            border: `1px solid ${T.hairline2}`, background: T.vellum,
            fontFamily: T.mono, fontSize: 10, letterSpacing: 0.6,
            color: T.ink, padding: '6px 10px', outline: 'none', cursor: 'pointer',
          }}
        >
          {summaries.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {!scenario && (
        <div style={{ padding: 40, fontFamily: T.mono, fontSize: 11, color: T.ink3 }}>{t('common.loading')}</div>
      )}

      {scenario && !mobile && (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '42% 32% 26%', overflow: 'hidden' }}>
          <div style={{ overflow: 'auto', padding: '28px 28px 40px', borderRight: `1px solid ${T.hairline}` }}>
            {threadCol}
          </div>
          <div style={{ overflow: 'auto', padding: '28px 28px 40px', borderRight: `1px solid ${T.hairline}` }}>
            <BriefColumn scenario={scenario} />
          </div>
          <div style={{ overflow: 'auto', padding: '28px 24px 40px' }}>
            <ClientCardColumn key={scenario.id} scenario={scenario} onClientCreated={onClientCreated} />
          </div>
        </div>
      )}

      {scenario && mobile && (
        <>
          <div style={{ display: 'flex', borderBottom: `1px solid ${T.hairline}`, flexShrink: 0, background: T.paper }}>
            {(['thread', 'brief', 'fitxa'] as const).map(tabKey => {
              const labels = { thread: t('intake.tabConversation'), brief: t('intake.tabBrief'), fitxa: t('nav.profile') };
              const on = mobileTab === tabKey;
              return (
                <div key={tabKey} onClick={() => setMobileTab(tabKey)} style={{
                  flex: 1, textAlign: 'center', padding: '10px 4px', cursor: 'pointer',
                  position: 'relative', fontFamily: T.serif, fontSize: 15,
                  fontStyle: on ? 'italic' : 'normal', color: on ? T.ink : T.ink3,
                }}>
                  {labels[tabKey]}
                  {on && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: T.accent }} />}
                </div>
              );
            })}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 20px 40px' }}>
            {mobileTab === 'thread' && threadCol}
            {mobileTab === 'brief' && <BriefColumn scenario={scenario} />}
            {mobileTab === 'fitxa' && <ClientCardColumn key={scenario.id} scenario={scenario} onClientCreated={onClientCreated} />}
          </div>
        </>
      )}
    </div>
  );
}
