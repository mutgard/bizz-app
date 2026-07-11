import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CalendarDays, Truck, Heart, Pencil, Trash2 } from 'lucide-react';
import { T } from '../tokens';
import { api } from '../api';
import type { AtelierEvent, Client } from '../types';
import { formatEventDate } from '../lib/calendarHelpers';
import { EventDialog } from './EventDialog';
import { t } from '../config';

const TYPE_BG: Record<string, string> = {
  appointment: T.accent,
  delivery:    T.gold,
  wedding:     T.ink,
};
const TYPE_ICON = {
  appointment: CalendarDays,
  delivery:    Truck,
  wedding:     Heart,
} as const;

interface Props {
  event: AtelierEvent;
  clients: Client[];
  onChanged: () => void;
}

export function EventChip({ event, clients, onChanged }: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const bg = TYPE_BG[event.type] ?? T.ink;
  const Icon = TYPE_ICON[event.type];

  const handleDelete = async () => {
    if (event.type === 'appointment') await api.deleteAppointment(event.id);
    else if (event.type === 'delivery') await api.deleteDelivery(event.id);
    setPopoverOpen(false);
    onChanged();
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => { e.stopPropagation(); setPopoverOpen(true); }}
            style={{
              display: 'block', width: '100%',
              background: bg, color: T.paper,
              fontFamily: T.mono, fontSize: 9, letterSpacing: 0.3,
              padding: '2px 5px', textAlign: 'left',
              border: 'none', cursor: 'pointer',
              borderRadius: 2, overflow: 'hidden',
              whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              marginBottom: 2, lineHeight: 1.6,
            }}
          >
            {event.title}
          </button>
        </PopoverTrigger>

        <PopoverContent
          style={{
            background: T.paper, border: `1px solid ${T.hairline2}`,
            padding: 16, width: 240,
            boxShadow: '0 4px 20px rgba(42,31,20,0.15)', borderRadius: 2,
          }}
          className="z-50"
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <Icon size={14} color={T.ink2} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: T.serif, fontSize: 15, color: T.ink, lineHeight: 1.2 }}>
                {event.title}
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3, marginTop: 3 }}>
                {formatEventDate(event.date)}
              </div>
            </div>
          </div>

          {event.client_name && (
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink2, marginBottom: 4 }}>
              {event.client_name}
            </div>
          )}
          {event.order_id && (
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3, marginBottom: 4 }}>
              {event.order_id}
            </div>
          )}
          {event.supplier && (
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3, marginBottom: 4 }}>
              {event.supplier}
            </div>
          )}

          {/* Actions */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 6,
            marginTop: 10, borderTop: `1px solid ${T.hairline}`, paddingTop: 10,
          }}>
            <button
              onClick={() => { setPopoverOpen(false); setEditOpen(true); }}
              style={{
                background: 'none', border: `1px solid ${T.hairline2}`,
                cursor: 'pointer', color: T.ink2,
                display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: T.mono, fontSize: 10, letterSpacing: 0.5,
                padding: '4px 10px', borderRadius: 2,
              }}
            >
              <Pencil size={11} /> {t('common.edit')}
            </button>

            {event.type !== 'wedding' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button style={{
                    background: 'none', border: `1px solid ${T.accent}`,
                    cursor: 'pointer', color: T.accent,
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontFamily: T.mono, fontSize: 10, letterSpacing: 0.5,
                    padding: '4px 10px', borderRadius: 2,
                  }}>
                    <Trash2 size={11} /> {t('event.delete')}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent style={{
                  background: T.paper, border: `1px solid ${T.hairline2}`, borderRadius: 2,
                }}>
                  <AlertDialogHeader>
                    <AlertDialogTitle style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, fontWeight: 'normal' }}>
                      {t('event.deleteTitle')}
                    </AlertDialogTitle>
                    <AlertDialogDescription style={{ fontFamily: T.sans, fontSize: 13, color: T.ink2 }}>
                      {t('event.deletePromptPre')}"{event.title}"{t('event.deletePromptPost')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel style={{ fontFamily: T.mono, fontSize: 11, borderRadius: 2 }}>
                      {t('common.cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      style={{ background: T.accent, color: T.paper, fontFamily: T.mono, fontSize: 11, borderRadius: 2 }}
                    >
                      {t('event.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {editOpen && (
        <EventDialog
          event={event}
          clients={clients}
          onSuccess={() => { setEditOpen(false); onChanged(); }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}
