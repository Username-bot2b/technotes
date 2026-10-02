type Handler<T = any> = (payload: T) => void;
export class EventBus {
  /** 同一 event 名会混多种 payload，存储层只能擦除为 Handler（= Handler<unknown>） */
  private events = new Map<string, Set<Handler>>();
  on<T>(event: string, handler: Handler<T>) {
    let handlers = this.events.get(event);
    if (!handlers) {
      handlers = new Set();
      this.events.set(event, handlers);
    }
    handlers.add(handler);
    return () => {
      this.off(event, handler);
    };
  }
  off<T>(event: string, handler: Handler<T>) {
    let handlers = this.events.get(event);
    if (!handlers) {
      return;
    }
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.events.delete(event);
    }
  }
  emit<T>(event: string, payload: T) {
    this.events.get(event)?.forEach((handler) => handler(payload));
  }
  once<T>(event: string, handler: Handler<T>) {
    /** 包裹一层，执行一次后自动解绑 */
    const wrapper: Handler<T> = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }
}
