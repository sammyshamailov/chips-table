// The event bus: before → render → after, the value handed from before to after, unsubscribing, errors.
import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from './events';

type E = { type: 'a'; n: number } | { type: 'b'; s: string };

describe('createEventBus', () => {
  it('runs every before, then render, then every after, in event and subscription order', () => {
    const bus = createEventBus<E>(),
      log: string[] = [];
    bus.on('a', { before: e => log.push('a1 before ' + e.n), after: e => log.push('a1 after ' + e.n) });
    bus.on('b', { before: e => log.push('b before ' + e.s), after: e => log.push('b after ' + e.s) });
    bus.on('a', { after: e => log.push('a2 after ' + e.n) });
    bus.emit(
      [
        { type: 'a', n: 1 },
        { type: 'b', s: 'x' },
      ],
      () => log.push('render'),
    );
    expect(log).toEqual(['a1 before 1', 'b before x', 'render', 'a1 after 1', 'a2 after 1', 'b after x']);
  });

  it('hands what before returned to after, per event', () => {
    const bus = createEventBus<E>(),
      got: [number, number][] = [];
    bus.on('a', { before: e => e.n * 10, after: (e, p) => got.push([e.n, p]) });
    bus.emit([
      { type: 'a', n: 1 },
      { type: 'a', n: 2 },
    ]);
    expect(got).toEqual([
      [1, 10],
      [2, 20],
    ]);
  });

  it('renders even with no events, and without a render runs the phases alone', () => {
    const bus = createEventBus<E>(),
      render = vi.fn(),
      after = vi.fn();
    bus.emit([], render);
    expect(render).toHaveBeenCalledTimes(1);
    bus.on('b', { after });
    bus.emit([{ type: 'b', s: 'y' }]);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes only the handler it was given back for, even when the same object subscribed twice', () => {
    const bus = createEventBus<E>(),
      h = { after: vi.fn() };
    const off = bus.on('a', h);
    bus.on('a', h);
    off();
    bus.emit([{ type: 'a', n: 1 }]);
    expect(h.after).toHaveBeenCalledTimes(1);
    off(); // twice is harmless
    bus.emit([{ type: 'a', n: 1 }]);
    expect(h.after).toHaveBeenCalledTimes(2);
  });

  it('a handler subscribed during an emit hears only the next one', () => {
    const bus = createEventBus<E>(),
      late = vi.fn();
    bus.on('a', { before: () => void bus.on('a', { after: late }) });
    bus.emit([{ type: 'a', n: 1 }]);
    expect(late).not.toHaveBeenCalled();
    bus.emit([{ type: 'a', n: 2 }]);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('reports a handler that throws and runs the others; a failed before skips its own after', () => {
    const errors: unknown[] = [],
      bus = createEventBus<E>(e => errors.push(e)),
      log: string[] = [];
    bus.on('a', {
      before: () => {
        throw new Error('before');
      },
      after: () => log.push('skipped'),
    });
    bus.on('a', {
      after: () => {
        throw new Error('after');
      },
    });
    bus.on('a', { after: () => log.push('ran') });
    bus.emit([{ type: 'a', n: 1 }], () => log.push('render'));
    expect(log).toEqual(['render', 'ran']);
    expect(errors.map(e => (e as Error).message)).toEqual(['before', 'after']);
  });

  it('logs to the console by default', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = createEventBus<E>();
    bus.on('b', {
      after: () => {
        throw new Error('x');
      },
    });
    bus.emit([{ type: 'b', s: 'z' }]);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
