import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../tokens';
import { Label, Mono } from '../components/primitives';
import { StatusChip } from '../components/StatusChip';
import { EventDialog } from '../components/EventDialog';
import { RegisterPaymentSheet } from '../components/RegisterPaymentSheet';
import { api } from '../api';
import type { AtelierEvent, Client, Todo } from '../types';
import { buildFinances } from '../lib/finance';
import { fabricsToBuyCount } from '../lib/clientHelpers';
import { isoToday } from '../lib/calendarHelpers';
import { t, formatCurrency, featureOn, statusByKey } from '../config';

interface Props {
  clients: Client[];
  onOpenClient: (id: number) => void;
  onRefresh: () => void;
}

function eventTypeLabel(type: AtelierEvent['type']): string {
  if (type === 'delivery') return t('event.typeDelivery');
  if (type === 'wedding') return t('event.keyDate');
  return t('event.typeAppointment');
}

function todoLabel(type: Todo['type']): string {
  if (type === 'schedule_fitting') return t('avui.todoScheduleFitting');
  if (type === 'collect_deposit') return t('avui.todoCollectDeposit');
  return t('avui.todoReviewLead');
}

function todoStripColor(type: Todo['type']): string {
  if (type === 'schedule_fitting') return T.accent;
  if (type === 'collect_deposit') return T.gold;
  return T.ink3;
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, minHeight: 44,
  padding: '0 2px', borderBottom: `1px solid ${T.hairline}`,
};

const actionBtnStyle: React.CSSProperties = {
  fontFamily: T.mono, fontSize: 9.5, letterSpacing: 0.6, textTransform: 'uppercase',
  color: T.ink2, background: 'none', border: `1px solid ${T.hairline2}`,
  borderRadius: 3, padding: '4px 9px', cursor: 'pointer', whiteSpace: 'nowrap',
};

function Stat({ value, label, warn, goLabel, onClick }: {
  value: string; label: string; warn?: boolean; goLabel: string; onClick: () => void;
}) {
  return (
    <div style={{
      flex: 1, background: T.sheet, border: `1px solid ${T.hairline}`, borderRadius: 4,
      padding: '10px 14px', display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0,
    }}>
      <span style={{
        fontFamily: T.serif, fontSize: 22, fontStyle: 'italic', lineHeight: 1,
        color: warn ? T.accent : T.ink, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
      }}>
        {value}
      </span>
      <Mono size={9.5} color={T.ink3} style={{ textTransform: 'uppercase', letterSpacing: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </Mono>
      <span
        onClick={onClick}
        style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 9.5, color: T.ink3, cursor: 'pointer', flexShrink: 0 }}
      >
        {goLabel} →
      </span>
    </div>
  );
}

export function TodayDeskScreen({ clients, onOpenClient, onRefresh }: Props) {
  const navigate = useNavigate();
  const today = isoToday();

  const [events, setEvents] = useState<AtelierEvent[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);

  const refreshEvents = () => api.listEvents(today, today).then(setEvents);
  const refreshTodos = () => api.getTodos().then(setTodos);

  useEffect(() => { refreshEvents(); refreshTodos(); }, []);

  const finances = useMemo(() => buildFinances(clients), [clients]);
  const topOutstanding = finances.slice(0, 3);
  const totalOutstanding = finances.reduce((s, f) => s + f.outstanding, 0);

  const fabricsToBuy = useMemo(
    () => fabricsToBuyCount(clients.flatMap(c => c.fabrics)),
    [clients]
  );
  const keyDatesSoon = useMemo(
    () => clients.filter(c => c.days_until >= 0 && c.days_until < 45 && !statusByKey(c.status)?.terminal).length,
    [clients]
  );
  const appointmentsToday = events.filter(e => e.type === 'appointment').length;

  const [eventDialogClientId, setEventDialogClientId] = useState<number | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [payClient, setPayClient] = useState<Client | null>(null);

  const [noteClientId, setNoteClientId] = useState<number | ''>('');
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const saveNote = async () => {
    if (noteClientId === '' || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      await api.createNote({ client_id: noteClientId as number, text: noteText.trim() });
      setNoteText('');
    } finally {
      setNoteSaving(false);
    }
  };

  const whatsappHref = (clientId: number | null): string | null => {
    if (clientId == null) return null;
    const c = clients.find(cl => cl.id === clientId);
    if (!c?.phone) return null;
    const digits = c.phone.replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  };

  const openEventDialog = (clientId: number | null) => {
    setEventDialogClientId(clientId);
    setShowEventDialog(true);
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 32px 40px' }}>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Stat
          value={String(appointmentsToday)}
          label={t('avui.statAppointmentsToday')}
          goLabel={t('nav.agenda')}
          onClick={() => navigate('/agenda')}
        />
        <Stat
          value={formatCurrency(totalOutstanding)}
          label={t('avui.statPendingCollect')}
          warn={totalOutstanding > 0}
          goLabel={t('nav.finances')}
          onClick={() => navigate('/caixa')}
        />
        {featureOn('fabrics') && (
          <Stat
            value={String(fabricsToBuy)}
            label={t('avui.statMaterialsToBuy')}
            goLabel={t('nav.materials')}
            onClick={() => navigate('/materials')}
          />
        )}
        {featureOn('keyDate') && (
          <Stat
            value={String(keyDatesSoon)}
            label={t('avui.statKeyDatesSoon')}
            warn={keyDatesSoon > 0}
            goLabel={t('nav.clients')}
            onClick={() => navigate('/clients')}
          />
        )}
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr)', gap: 24, alignItems: 'start' }}>

        {/* Left column */}
        <div>
          <Label style={{ marginBottom: 8 }}>{t('avui.appointmentsToday')}</Label>
          <div style={{ marginBottom: 24 }}>
            {events.length === 0 && (
              <Mono size={11} color={T.ink3} style={{ display: 'block', padding: '8px 0' }}>{t('event.empty')}</Mono>
            )}
            {events.map(e => {
              const client = e.client_id != null ? clients.find(c => c.id === e.client_id) : undefined;
              return (
                <div key={`${e.type}-${e.id}`} style={rowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 500, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.title}
                    </div>
                    <Mono size={9.5} color={T.ink3} style={{ display: 'block', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {eventTypeLabel(e.type)}
                    </Mono>
                  </div>
                  {client && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <Mono size={11.5} color={T.ink}>{client.name}</Mono>
                      <StatusChip statusKey={client.status} size="sm" />
                    </div>
                  )}
                  {client && (
                    <button style={actionBtnStyle} onClick={() => onOpenClient(client.id)}>
                      {t('nav.profile')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <Label style={{ marginBottom: 8 }}>{t('avui.todo')}</Label>
          <div>
            {todos.length === 0 && (
              <Mono size={11} color={T.ink3} style={{ display: 'block', padding: '8px 0' }}>{t('event.empty')}</Mono>
            )}
            {todos.map((todo, i) => {
              const wa = todo.type === 'collect_deposit' ? whatsappHref(todo.client_id) : null;
              return (
                <div key={`${todo.type}-${todo.client_id ?? i}`} style={rowStyle}>
                  <span style={{ width: 3, alignSelf: 'stretch', background: todoStripColor(todo.type), flexShrink: 0, borderRadius: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 500, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {todoLabel(todo.type)} — {todo.client_name}
                    </div>
                    {todo.days_until != null && (
                      <Mono size={9.5} color={T.ink3} style={{ display: 'block', marginTop: 1 }}>
                        {todo.days_until} {t('common.days')}
                      </Mono>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {todo.type === 'schedule_fitting' && (
                      <button style={actionBtnStyle} onClick={() => openEventDialog(todo.client_id)}>
                        + {t('event.typeAppointment')}
                      </button>
                    )}
                    {todo.type === 'collect_deposit' && wa && (
                      <a href={wa} target="_blank" rel="noreferrer" style={{ ...actionBtnStyle, textDecoration: 'none', display: 'inline-block' }}>
                        WhatsApp
                      </a>
                    )}
                    {todo.type === 'review_lead' && (
                      <button style={actionBtnStyle} onClick={() => navigate('/intake')}>
                        {t('avui.review')}
                      </button>
                    )}
                    {todo.client_id != null && (
                      <button style={actionBtnStyle} onClick={() => onOpenClient(todo.client_id!)}>
                        {t('nav.profile')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div>
          <Label style={{ marginBottom: 8 }}>{t('avui.pendingPayments')}</Label>
          <div style={{ marginBottom: 24 }}>
            {topOutstanding.length === 0 && (
              <Mono size={11} color={T.ink3} style={{ display: 'block', padding: '8px 0' }}>{t('finances.empty')}</Mono>
            )}
            {topOutstanding.map(f => (
              <div key={f.client.id} style={rowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Mono size={12} color={T.ink}>{f.client.name}</Mono>
                </div>
                <Mono size={12} color={T.gold} style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {formatCurrency(f.outstanding)}
                </Mono>
                <button style={actionBtnStyle} onClick={() => setPayClient(f.client)}>
                  {t('finances.register')}
                </button>
              </div>
            ))}
          </div>

          <Label style={{ marginBottom: 8 }}>{t('avui.logSection')}</Label>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8, padding: 12,
            background: T.sheet, border: `1px solid ${T.hairline}`, borderRadius: 4,
          }}>
            <select
              value={noteClientId}
              onChange={(e) => setNoteClientId(e.target.value !== '' ? Number(e.target.value) : '')}
              style={{
                padding: '7px 9px', border: `1px solid ${T.hairline2}`, background: T.paper,
                fontFamily: T.sans, fontSize: 12.5, color: T.ink, borderRadius: 2, cursor: 'pointer',
              }}
            >
              <option value="">{t('event.noClient')}</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t('avui.logPlaceholder')}
                style={{
                  flex: 1, padding: '7px 9px', border: `1px dashed ${T.hairline2}`, background: T.paper,
                  fontFamily: T.sans, fontSize: 12.5, color: T.ink, borderRadius: 2, outline: 'none',
                }}
              />
              <button
                onClick={saveNote}
                disabled={noteSaving || noteClientId === '' || !noteText.trim()}
                style={{
                  padding: '7px 16px', background: T.ink, color: T.paper,
                  fontFamily: T.mono, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase',
                  borderRadius: 2, border: 'none',
                  cursor: noteSaving ? 'not-allowed' : 'pointer',
                  opacity: (noteClientId === '' || !noteText.trim()) ? 0.5 : 1,
                }}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEventDialog && (
        <EventDialog
          defaultDate={today}
          defaultClientId={eventDialogClientId ?? undefined}
          clients={clients}
          onSuccess={() => { setShowEventDialog(false); refreshEvents(); refreshTodos(); }}
          onClose={() => setShowEventDialog(false)}
        />
      )}

      {payClient && (
        <RegisterPaymentSheet
          client={payClient}
          open
          onClose={() => setPayClient(null)}
          onSaved={() => { setPayClient(null); onRefresh(); refreshTodos(); }}
        />
      )}
    </div>
  );
}
