import { describe, expect, it } from 'vitest';
import { decide } from '../src/policy.js';
import { EMPTY_STATE, type State } from '../src/state.js';
import type { Status } from '../src/probe/types.js';

// Sábado 24/oct/2026 16:00 en Bogotá (no es lunes → sin heartbeat)
const SAT = new Date('2026-10-24T21:00:00Z');
const hoursLater = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);
const RUN = 'https://github.com/liska/dian-watcher/actions/runs/1';

const NO_SLOTS: Status = { kind: 'NO_SLOTS' };
const AVAILABLE: Status = { kind: 'AVAILABLE', detail: 'Devoluciones' };
const ERROR: Status = { kind: 'ERROR', step: 'devoluciones', message: 'Timeout' };
const BLOCKED: Status = { kind: 'BLOCKED', reason: 'HTTP 403' };

const s = (o: Partial<State> = {}): State => ({ ...EMPTY_STATE, ...o });

describe('policy', () => {
  it('AVAILABLE notifica siempre con prioridad 5', () => {
    const first = decide(AVAILABLE, s(), SAT);
    expect(first.notification?.priority).toBe(5);
    const again = decide(AVAILABLE, first.state, hoursLater(SAT, 4));
    expect(again.notification?.priority).toBe(5);
  });

  it('NO_SLOTS tras AVAILABLE avisa que se acabaron (prioridad 3)', () => {
    const d = decide(NO_SLOTS, s({ lastStatus: 'AVAILABLE' }), SAT);
    expect(d.notification?.priority).toBe(3);
    expect(d.state.lastStatus).toBe('NO_SLOTS');
  });

  it('NO_SLOTS tras AVAILABLE avisa aunque haya fallos en medio', () => {
    let st = decide(AVAILABLE, s(), SAT).state;
    st = decide(ERROR, st, hoursLater(SAT, 4)).state;
    expect(decide(NO_SLOTS, st, hoursLater(SAT, 8)).notification?.priority).toBe(3);
  });

  it('NO_SLOTS normal no notifica', () => {
    expect(decide(NO_SLOTS, s({ lastStatus: 'NO_SLOTS' }), SAT).notification).toBeNull();
  });

  it('ERROR/BLOCKED: 1 fallo nada; 2 fallos avisa (prioridad 2) con paso y link al run', () => {
    const one = decide(ERROR, s(), SAT, RUN);
    expect(one.notification).toBeNull();
    const two = decide(BLOCKED, one.state, hoursLater(SAT, 4), RUN);
    expect(two.notification?.priority).toBe(2);
    expect(two.notification?.message).toContain('HTTP 403');
    expect(two.notification?.message).toContain(RUN);
    expect(two.notification?.click).toBe(RUN);

    const err = decide(ERROR, one.state, hoursLater(SAT, 4), RUN);
    expect(err.notification?.message).toContain('"devoluciones"');
  });

  it('ERROR/BLOCKED: un tercer fallo en < 24 h no avisa; pasadas 24 h vuelve a avisar', () => {
    let st = decide(ERROR, s(), SAT).state;
    const two = decide(ERROR, st, hoursLater(SAT, 4));
    expect(two.notification).not.toBeNull();
    st = two.state;
    const three = decide(ERROR, st, hoursLater(SAT, 8));
    expect(three.notification).toBeNull();
    const later = decide(ERROR, three.state, hoursLater(SAT, 28));
    expect(later.notification?.priority).toBe(2);
  });

  it('recuperación tras errores avisados (prioridad 1) y resetea contadores', () => {
    let st = decide(ERROR, s({ lastStatus: 'NO_SLOTS' }), SAT).state;
    st = decide(ERROR, st, hoursLater(SAT, 4)).state;
    const back = decide(NO_SLOTS, st, hoursLater(SAT, 8));
    expect(back.notification?.priority).toBe(1);
    expect(back.notification?.title).toMatch(/operativo/);
    expect(back.state).toMatchObject({ consecutiveFailures: 0, lastFailureNotifiedAt: null });
  });

  it('un solo fallo sin avisar no genera mensaje de recuperación', () => {
    const st = decide(ERROR, s({ lastStatus: 'NO_SLOTS' }), SAT).state;
    expect(decide(NO_SLOTS, st, hoursLater(SAT, 4)).notification).toBeNull();
  });

  it('heartbeat semanal el lunes (hora Bogotá), una sola vez', () => {
    const monday = new Date('2026-10-26T14:00:00Z'); // lunes 9:00 Bogotá
    const hb = decide(NO_SLOTS, s({ lastStatus: 'NO_SLOTS' }), monday);
    expect(hb.notification?.priority).toBe(1);
    expect(decide(NO_SLOTS, hb.state, hoursLater(monday, 4)).notification).toBeNull();
    // Domingo 23:00 en Bogotá = lunes 04:00 UTC → todavía no es lunes allá
    expect(decide(NO_SLOTS, s({ lastStatus: 'NO_SLOTS' }), new Date('2026-10-26T04:00:00Z')).notification).toBeNull();
  });
});
