import type { AtelierEvent } from '../types';

/** Hourly week grid geometry (Agenda screen), per the approved desktop mock
 *  (docs/design/proposal-v1-desktop.html, section 5): 09:00–19:00 axis,
 *  1 hour = 44px, so the day column is (DAY_END - DAY_START) * HOUR_PX tall. */
export const DAY_START = 9;
export const DAY_END = 19;
export const HOUR_PX = 44;

function parseTime(time: string): { h: number; m: number } {
  const [h, m] = time.split(':').map(Number);
  return { h, m };
}

/** Pixel offset from the top of the day column for an event starting at
 *  `time` ("HH:MM"). Not clamped: out-of-window starts ARE routed to the
 *  all-day strip because `isAllDay` treats times outside [DAY_START, DAY_END)
 *  as all-day — so positioned callers never receive them. */
export function blockTop(time: string | null | undefined): number {
  if (!time) return 0;
  const { h, m } = parseTime(time);
  return (h - DAY_START + m / 60) * HOUR_PX;
}

/** Pixel height of an event block for a given duration (minutes). Defaults
 *  to 60 min when not set. A small gap is trimmed off the raw duration height
 *  so adjacent/stacked blocks stay visually separated; never shorter than
 *  ~26px (enough for one line of title + one line of header text). */
export function blockHeight(durationMin: number | null | undefined): number {
  const min = durationMin ?? 60;
  return Math.max(26, (min / 60) * HOUR_PX - 2);
}

/** Hour axis labels, "09:00" … "18:00" — the last full hour that starts
 *  before DAY_END (the grid is 10 rows of 44px = 440px for a 09–19 window). */
export function hourLabels(): string[] {
  const labels: string[] = [];
  for (let h = DAY_START; h < DAY_END; h++) {
    labels.push(`${String(h).padStart(2, '0')}:00`);
  }
  return labels;
}

/** Converts a y-offset (px, from the top of a day column) into the "HH:00"
 *  slot label it falls in, clamped to the grid's visible hour range. Used to
 *  turn a click/hover position into the pre-fill time for a new appointment. */
export function slotHourFromOffset(y: number): string {
  const hour = DAY_START + Math.floor(y / HOUR_PX);
  const clamped = Math.min(DAY_END - 1, Math.max(DAY_START, hour));
  return `${String(clamped).padStart(2, '0')}:00`;
}

/** True when an event belongs in the "Tot el dia" (all-day) strip above the
 *  hourly grid rather than as a positioned block: weddings (key dates, which
 *  never carry a time of day), any event with no `time` set at all, and timed
 *  events whose start falls outside the visible [DAY_START, DAY_END) window —
 *  e.g. a booking-sourced 08:00 or 21:00 appointment would otherwise draw
 *  above/below the day column. */
export function isAllDay(event: Pick<AtelierEvent, 'time' | 'type'>): boolean {
  if (!event.time || event.type === 'wedding') return true;
  const { h } = parseTime(event.time);
  return h < DAY_START || h >= DAY_END;
}

export interface LaidOutBlock<E> {
  event: E;
  top: number;
  height: number;
  /** 0-based column within the overlap cluster … */
  col: number;
  /** … out of this many side-by-side columns (1 = full width). */
  cols: number;
}

/** Lays out one day's timed events so overlapping blocks render side by side
 *  instead of on top of each other. Events are clustered by transitive time
 *  overlap; within a cluster each event takes the first free column
 *  (first-fit, in start order), and every member spans width 1/maxCols. */
export function layoutDay<E extends Pick<AtelierEvent, 'time' | 'duration_min'>>(
  events: E[],
): LaidOutBlock<E>[] {
  const sorted = [...events].sort((a, b) => blockTop(a.time) - blockTop(b.time));
  const placed: LaidOutBlock<E>[] = [];
  let cluster: LaidOutBlock<E>[] = [];
  let clusterEnd = -Infinity;
  const colEnds: number[] = []; // per-column current bottom within the cluster

  const closeCluster = () => {
    const cols = colEnds.length || 1;
    for (const b of cluster) b.cols = cols;
    cluster = [];
    colEnds.length = 0;
  };

  for (const event of sorted) {
    const top = blockTop(event.time);
    const height = blockHeight(event.duration_min);
    if (top >= clusterEnd && cluster.length) closeCluster();
    // first column whose last block ends at or before this block's start
    let col = colEnds.findIndex((end) => end <= top);
    if (col === -1) { col = colEnds.length; colEnds.push(0); }
    colEnds[col] = top + height;
    clusterEnd = Math.max(clusterEnd, top + height);
    const block: LaidOutBlock<E> = { event, top, height, col, cols: 1 };
    cluster.push(block);
    placed.push(block);
  }
  closeCluster();
  return placed;
}
