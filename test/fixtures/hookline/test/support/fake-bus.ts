export interface FakeBus {
  emit(name: string, payload: unknown): void;
  emitted(name: string): unknown[];
}

export function createFakeBus(): FakeBus {
  const events: { name: string; payload: unknown }[] = [];
  return {
    emit: (name, payload) => {
      events.push({ name, payload });
    },
    emitted: (name) => events.filter((event) => event.name === name).map((event) => event.payload),
  };
}
