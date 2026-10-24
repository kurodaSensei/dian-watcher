import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classify } from '../src/classify.js';
import { textRegex } from '../src/config.js';
import type { CapturedResponse, ProbeOutput } from '../src/probe/types.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const api = (name: string): CapturedResponse[] => JSON.parse(fixture(name));

const out = (o: Partial<ProbeOutput>): ProbeOutput => ({
  mainStatus: 200,
  html: fixture('blank.html'),
  modalVisible: false,
  responses: [],
  ...o,
});

describe('classify', () => {
  it('NO_SLOTS con la respuesta real de la API', () => {
    expect(classify(out({ html: fixture('no-slots.html'), modalVisible: true, responses: api('no-slots.api.json') }))).toEqual({
      kind: 'NO_SLOTS',
    });
  });

  it('NO_SLOTS solo con el modal visible, aunque no se haya capturado la API', () => {
    expect(classify(out({ html: fixture('no-slots.html'), modalVisible: true })).kind).toBe('NO_SLOTS');
  });

  it('el texto del modal en el DOM no basta si no está visible → ambiguo', () => {
    expect(classify(out({ html: fixture('no-slots.html'), modalVisible: false }))).toMatchObject({ kind: 'ERROR', step: 'classify' });
  });

  it('AVAILABLE cuando la API devuelve colas', () => {
    expect(classify(out({ responses: api('available.api.json') }))).toEqual({
      kind: 'AVAILABLE',
      detail: 'Devoluciones saldos a favor',
    });
  });

  it('BLOCKED por página de bloqueo', () => {
    expect(classify(out({ html: fixture('blocked.html') })).kind).toBe('BLOCKED');
  });

  it('BLOCKED por HTTP 403/429, aunque haya otras señales', () => {
    expect(classify(out({ mainStatus: 403, modalVisible: true })).kind).toBe('BLOCKED');
    const throttled = api('no-slots.api.json').map((r) => ({ ...r, status: 429 }));
    expect(classify(out({ responses: throttled }))).toEqual({ kind: 'BLOCKED', reason: 'HTTP 429' });
  });

  it('ERROR con el nombre del paso que falló', () => {
    expect(classify(out({ failure: { step: 'video-atencion', message: 'Timeout 30000ms' } }))).toEqual({
      kind: 'ERROR',
      step: 'video-atencion',
      message: 'Timeout 30000ms',
    });
  });

  it('ERROR si la API trae ErrorString', () => {
    expect(classify(out({ responses: api('api-error.api.json') }))).toMatchObject({ kind: 'ERROR', step: 'api' });
  });

  it('ERROR ambiguo sin evidencia (página que no cargó)', () => {
    expect(classify(out({}))).toMatchObject({ kind: 'ERROR', step: 'classify' });
  });
});

describe('textRegex', () => {
  it('tolera tildes, mayúsculas, espacios y punto final', () => {
    expect(textRegex('Devoluciones').test('Devoluciones.')).toBe(true);
    expect(textRegex('Persona Natural').test('PersonaNatural')).toBe(true);
    expect(textRegex('Videoatención').test('VIDEOATENCION')).toBe(true);
    expect(textRegex('Agendar cita').test('Agendar citaPrograme cita para trámites')).toBe(false);
  });
});
