/**
 * A tiny typed event bus with two phases, so an effect can keep showing the old picture through a render.
 *
 * `emit(events, render)` runs, in order: every subscriber's `before(event)` (events in order, subscribers in the order
 * they subscribed), then `render()`, then every `after(event, prepared)`, where `prepared` is what that subscriber's
 * `before` returned. `before` is where an effect sets an override (`FX.ov`) and reads positions from before the
 * render; `after` is where it animates, against the fresh DOM. A subscriber that throws is reported to `onError` and
 * skipped (its `after` does not run when its `before` threw); the others still run.
 */

/** Anything with a `type`. */
export interface Typed {
  readonly type: string;
}

/** One subscriber's two phases. Both are optional. */
export interface Handler<E, P = void> {
  /** Before the render: may set overrides. What it returns is handed to `after`. */
  before?: (event: E) => P;
  /** After the render: animate, play sounds. */
  after?: (event: E, prepared: P) => void;
}

/** The member of the union `E` whose `type` is `T`. */
export type EventOf<E extends Typed, T extends E['type']> = Extract<E, { type: T }>;

export interface EventBus<E extends Typed> {
  /** Subscribes to one event type. Returns the function that unsubscribes. */
  on<T extends E['type'], P = void>(type: T, handler: Handler<EventOf<E, T>, P>): () => void;
  /** Runs every `before`, then `render`, then every `after` (see above). */
  emit(events: readonly E[], render?: () => void): void;
}

type AnyHandler = Handler<Typed, unknown>;

/** A new bus. `onError` hears about a subscriber that threw (the console by default). */
export function createEventBus<E extends Typed>(onError: (e: unknown) => void = e => console.error(e)): EventBus<E> {
  const subs = new Map<string, AnyHandler[]>();
  return {
    on(type, handler) {
      const h: AnyHandler = { ...(handler as AnyHandler) }; // its own identity, so unsubscribing removes only this one
      subs.set(type, [...(subs.get(type) ?? []), h]);
      return () =>
        subs.set(
          type,
          (subs.get(type) ?? []).filter(x => x !== h),
        );
    },
    emit(events, render) {
      const ran: { h: AnyHandler; e: Typed; p: unknown }[] = [];
      for (const e of events)
        for (const h of subs.get(e.type) ?? []) {
          try {
            ran.push({ h, e, p: h.before ? h.before(e) : undefined });
          } catch (err) {
            onError(err);
          }
        }
      if (render) render();
      for (const { h, e, p } of ran) {
        if (!h.after) continue;
        try {
          h.after(e, p);
        } catch (err) {
          onError(err);
        }
      }
    },
  };
}
