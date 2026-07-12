import { describe, it, expect } from 'vitest';
import {
  DAY_START, DAY_END, HOUR_PX,
  blockTop, blockHeight, hourLabels, slotHourFromOffset, isAllDay, layoutDay,
} from '../hourGrid';

describe('blockTop', () => {
  it('places 09:00 (DAY_START) at the top of the column', () => {
    expect(blockTop('09:00')).toBe(0);
  });

  it('places each whole hour HOUR_PX apart', () => {
    expect(blockTop('10:00')).toBe(44);
    expect(blockTop('12:00')).toBe(132);
  });

  it('accounts for minutes within the hour', () => {
    expect(blockTop('17:30')).toBe(374); // (17-9)*44 + 22
  });

  it('returns 0 for null/undefined time', () => {
    expect(blockTop(null)).toBe(0);
    expect(blockTop(undefined)).toBe(0);
  });
});

describe('blockHeight', () => {
  it('defaults to 60 minutes when duration is null/undefined', () => {
    expect(blockHeight(null)).toBe(HOUR_PX - 2);
    expect(blockHeight(undefined)).toBe(HOUR_PX - 2);
  });

  it('scales with duration', () => {
    expect(blockHeight(90)).toBe(1.5 * HOUR_PX - 2);
  });

  it('never goes below the minimum readable height', () => {
    expect(blockHeight(15)).toBe(26);
  });
});

describe('hourLabels', () => {
  it('spans DAY_START..DAY_END-1, one label per hour', () => {
    const labels = hourLabels();
    expect(labels[0]).toBe('09:00');
    expect(labels[labels.length - 1]).toBe('18:00');
    expect(labels).toHaveLength(DAY_END - DAY_START);
  });
});

describe('slotHourFromOffset', () => {
  it('maps a y-offset to the hour slot it falls in', () => {
    expect(slotHourFromOffset(0)).toBe('09:00');
    expect(slotHourFromOffset(43)).toBe('09:00');
    expect(slotHourFromOffset(44)).toBe('10:00');
    expect(slotHourFromOffset(88)).toBe('11:00');
  });

  it('clamps to the grid range for out-of-bounds offsets', () => {
    expect(slotHourFromOffset(-10)).toBe('09:00');
    expect(slotHourFromOffset(10000)).toBe('18:00');
  });
});

describe('isAllDay', () => {
  it('is true for events with no time', () => {
    expect(isAllDay({ time: null, type: 'appointment' })).toBe(true);
    expect(isAllDay({ time: undefined, type: 'delivery' })).toBe(true);
  });

  it('is true for weddings regardless of time', () => {
    expect(isAllDay({ time: '10:00', type: 'wedding' })).toBe(true);
    expect(isAllDay({ time: null, type: 'wedding' })).toBe(true);
  });

  it('is false for a timed non-wedding event', () => {
    expect(isAllDay({ time: '10:00', type: 'appointment' })).toBe(false);
    expect(isAllDay({ time: '17:00', type: 'delivery' })).toBe(false);
  });
});

describe('layoutDay (overlap clusters)', () => {
  it('non-overlapping events each get full width', () => {
    const blocks = layoutDay([
      { time: '09:00', duration_min: 60 },
      { time: '11:00', duration_min: 60 },
    ]);
    expect(blocks.map(b => [b.col, b.cols])).toEqual([[0, 1], [0, 1]]);
  });

  it('two events at the same time split side by side', () => {
    const blocks = layoutDay([
      { time: '16:00', duration_min: 60 },
      { time: '16:00', duration_min: 45 },
    ]);
    expect(blocks.map(b => [b.col, b.cols])).toEqual([[0, 2], [1, 2]]);
  });

  it('partial overlap clusters; later event reuses a freed column', () => {
    const blocks = layoutDay([
      { time: '10:00', duration_min: 120 },  // 10-12
      { time: '10:30', duration_min: 30 },   // 10:30-11 → col 1
      { time: '11:15', duration_min: 30 },   // fits back into col 1
      { time: '14:00', duration_min: 60 },   // separate cluster, full width
    ]);
    expect(blocks.map(b => [b.col, b.cols])).toEqual([[0, 2], [1, 2], [1, 2], [0, 1]]);
  });
});

describe('isAllDay routes out-of-window times to the strip', () => {
  it('early/late timed appointments are all-day', () => {
    expect(isAllDay({ time: '08:00', type: 'appointment' })).toBe(true);
    expect(isAllDay({ time: '21:00', type: 'appointment' })).toBe(true);
  });
  it('in-window timed appointments are positioned', () => {
    expect(isAllDay({ time: '09:00', type: 'appointment' })).toBe(false);
    expect(isAllDay({ time: '18:59', type: 'appointment' })).toBe(false);
  });
});
