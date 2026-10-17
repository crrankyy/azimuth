export interface DeliveryEvents {
  "delivery.delivered": { deliveryId: string };
  "delivery.failed": { deliveryId: string; error: string };
}

type Handler<T> = (payload: T) => void;

export function createBus<E extends object = DeliveryEvents>() {
  const handlers = new Map<keyof E, Handler<never>[]>();
  return {
    on<K extends keyof E>(name: K, handler: Handler<E[K]>): void {
      handlers.set(name, [...(handlers.get(name) ?? []), handler as Handler<never>]);
    },
    emit<K extends keyof E>(name: K, payload: E[K]): void {
      for (const handler of handlers.get(name) ?? []) (handler as Handler<E[K]>)(payload);
    },
  };
}
