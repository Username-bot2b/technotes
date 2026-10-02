---
publishDate: 2026-10-01T08:00:00Z
title: 实现一个简单的 EventBus
excerpt: 用 Map,Set 实现一个简单的 EventBus
category: JavaScript,TypeScript
tags:
  - eventBus
  - javascript
  - typescript
author: technotes
---

eventBus一般具有on,emit,off,以及 once 方法，每个event都对应一个事件队列；实现on的时候，要注意相同事件的重复绑定，所以天然就适合用 Set；而且Set在实现 off 的时候就非常方便了，但用户要自己确保传入的handler是on的同一个——在组件繁多的现实项目里，这一点并不容易

所以eventBus的on，一般会返回一个解绑函数，调用即可解绑。我们也应该这么做。

另外就是once，执行一次就会自动解绑。原理实际上是给传入的fn加上一层包裹函数，包裹函数里面会解绑函数+执行函数。

下面是 typescript 代码：

```ts
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

```