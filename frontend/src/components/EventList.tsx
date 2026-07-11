import { useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarDays, Truck, Heart, Plus, Pencil, Trash2 } from 'lucide-react';
import { T } from '../tokens';
import { api } from '../api';
import type { AtelierEvent, Client } from '../types';
import { EventDialog } from './EventDialog';
import { formatEventDate } from '../lib/calendarHelpers';
import { Label } from './primitives';
import { t } from '../config';

const TYPE_ICON = {
  appointment: CalendarDays,
  delivery:    Truck,
  wedding:     Heart,
} as const;

const TYPE_COLOR: Record<string, string> = {
  appointment: T.accent,
  delivery:    T.gold,
  wedding:     T.ink,
};

interface Props {
  events: AtelierEvent[];
  clients: Client[];
  defaultClientId?: number;
  onRefresh: () => void;
}

export function EventList({ events, clients, defaultClientId, onRefresh }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<AtelierEvent | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<AtelierEvent | null>(null);

  const handleConfirmDelete = async () => {
    if (!deleteEvent) return;
    if (deleteEvent.type === 'appointment') await api.deleteAppointment(deleteEvent.id);
    else if (deleteEvent.type === 'delivery') await api.deleteDelivery(deleteEvent.id);
    setDeleteEvent(null);
    onRefresh();
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Label>{t('event.events')}</Label>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: T.ink2,
            display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8,
            textTransform: 'uppercase', padding: 0,
          }}
        >
          <Plus size={11} /> {t('common.add')}
        </button>
      </div>

      {events.length === 0 && (
        <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3, padding: '8px 0' }}>
          {t('event.empty')}
        </div>
      )}

      {events.map((e, i) => {
        const Icon = TYPE_ICON[e.type];
        const color = TYPE_COLOR[e.type];
        return (
          <div
            key={`${e.type}-${e.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: i < events.length - 1 ? `1px solid ${T.hairline}` : 'none',
            }}
          >
            <Icon size={12} color={color} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: T.sans, fontSize: 12, color: T.ink,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {e.title}
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3, marginTop: 1 }}>
                {formatEventDate(e.date)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => setEditEvent(e)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: T.ink3, padding: 4, borderRadius: 2,
                }}
              >
                <Pencil size={11} />
              </button>
              {e.type !== 'wedding' && (
                <button
                  onClick={() => setDeleteEvent(e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: T.accent, padding: 4, borderRadius: 2,
                  }}
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {createOpen && (
        <EventDialog
          defaultClientId={defaultClientId}
          clients={clients}
          onSuccess={() => { setCreateOpen(false); onRefresh(); }}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {editEvent && (
        <EventDialog
          event={editEvent}
          clients={clients}
          onSuccess={() => { setEditEvent(null); onRefresh(); }}
          onClose={() => setEditEvent(null)}
        />
      )}

      <AlertDialog
        open={deleteEvent !== null}
        onOpenChange={(o) => { if (!o) setDeleteEvent(null); }}
      >
        <AlertDialogContent style={{
          background: T.paper, border: `1px solid ${T.hairline2}`, borderRadius: 2,
        }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, fontWeight: 'normal' }}>
              {t('event.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription style={{ fontFamily: T.sans, fontSize: 13, color: T.ink2 }}>
              {t('event.deletePromptPre')}"{deleteEvent?.title}"{t('event.deletePromptPost')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ fontFamily: T.mono, fontSize: 11, borderRadius: 2 }}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              style={{ background: T.accent, color: T.paper, fontFamily: T.mono, fontSize: 11, borderRadius: 2 }}
            >
              {t('event.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
