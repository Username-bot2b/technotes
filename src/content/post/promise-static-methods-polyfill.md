---
publishDate: 2026-10-01T06:00:00Z
title: Promise 原生静态方法 polyfill
excerpt: 逐一实现 Promise.resolve / reject / all / race / allSettled / any / withResolvers：说明用途、易混点与简练实现原理。默认基于前文 MyPromise，语法保持 ES5 友好。
category: JavaScript
tags:
  - promise
  - polyfill
  - javascript
  - 异步
author: technotes
---

上一篇 [手动实现 Promise polyfill（ES5）](/promise-polyfill-es5/) 已经具备 **`MyPromise` 构造器、`then`、实例链**。本文在**同一套 `MyPromise` 上**补全 **Promise 的静态方法** polyfill：每个方法先讲用途和容易和谁搞混，再给尽量短的实现，并说明原理。

下文代码默认 **`MyPromise` 已存在**（可从上一篇完整合并版复制）。若你用的是浏览器原生 `Promise`，把 `MyPromise` 改成 `Promise` 即可，逻辑相同。

---

## 1. 静态方法一览

| 方法 | 典型用途 | 大致行为 |
|------|----------|----------|
| `Promise.resolve(x)` | 把任意值变成已决 Promise；展开 thenable | 已是 Promise 则返回；否则 `new Promise(r => r(x))` |
| `Promise.reject(r)` | 得到已 reject 的 Promise | `new Promise((_, rej) => rej(r))` |
| `Promise.all(iterable)` | 并行等多份，**全成功**才成功 | 结果数组与输入**下标对齐**；**任一 reject → 整体 reject** |
| `Promise.race(iterable)` | 谁**先落定**（成功或失败）跟谁 | 只采纳第一个 settled |
| `Promise.allSettled(iterable)` | 并行等全部结束，**不因单个失败而 fail** | 永远 fulfill，元素为 `{ status, value \| reason }` |
| `Promise.any(iterable)` | 谁**先成功**跟谁 | 全失败才 reject（`AggregateError`） |
| `Promise.withResolvers()` | 先拿 `promise`，稍后再 `resolve`/`reject` | 返回 `{ promise, resolve, reject }`（ES2024） |

**组合类 API 的公共实现套路**：`new MyPromise` + 对 iterable 里每一项先 **`MyPromise.resolve(item)`**（把非 Promise 值、thenable 统一成 Promise），再 **`then` / 计数**。

---

## 2. `MyPromise.resolve`

### 用途

- 把普通值、thenable、已是 Promise 的值，规范化成 **Promise 实例**。
- `async` 函数 return 非 Promise 时，引擎内部也相当于对它做「resolve」。

### 易混点

| 别和…混淆 | 区别 |
|-----------|------|
| `new MyPromise(fn)` | `resolve` **不传 executor**，只包装已有值；不会因为你传了函数就去「执行函数当异步任务」。 |
| `Promise.reject` | 一个走向 fulfilled（或展开 thenable），一个走向 rejected。 |

### 原理

- 已是 `MyPromise`：**原样返回**（规范要求同一引用）。
- 否则：`new MyPromise`，在 executor 里调用 `resolve(value)`，走构造器里对 thenable 的展开逻辑。

```javascript
MyPromise.resolve = function (value) {
  if (value instanceof MyPromise) {
    return value;
  }
  return new MyPromise(function (resolve) {
    resolve(value);
  });
};
```

---

## 3. `MyPromise.reject`

### 用途

- 快速得到 **已 rejected** 的 Promise，便于链式 `catch` 或测试。

### 易混点

| 别和…混淆 | 区别 |
|-----------|------|
| `throw` in executor | `reject(r)` 一定 rejected；`throw` 也会被构造器 catch 后 reject，但语义入口不同。 |
| `Promise.resolve` 传 thenable | thenable 可能被**展开成 fulfilled**；`reject(thenable)` 则 rejected 的值就是 thenable 本身，**不会**去调它的 `then`。 |

### 原理

只做一件事：新建 Promise 并 **同步** 调用 `reject(reason)`。

```javascript
MyPromise.reject = function (reason) {
  return new MyPromise(function (_resolve, reject) {
    reject(reason);
  });
};
```

---

## 4. `MyPromise.all`

### 用途

- **并行**发起多路异步（多接口、多资源），且需要 **全部成功** 才继续。
- 结果数组 **顺序与传入 iterable 一致**（与谁先完成无关）。

### 易混点

| 方法 | 何时「整组失败」 | 成功时得到什么 |
|------|------------------|----------------|
| **`all`** | **第一个** reject | 全部 fulfilled → 结果数组 |
| **`race`** | 第一个 settled 若是 reject | 第一个 settled 的值或原因 |
| **`allSettled`** | 几乎不 reject（见下文） | 每个输入对应一条 `{ status, … }` |
| **`any`** | **全部** reject | 第一个 fulfilled 的值 |

空数组：`Promise.all([])` **立即 fulfill `[]`**。

非 Promise 元素：规范会先 `Promise.resolve(element)`，因此 **`42` 与 `Promise.resolve(42)` 等价**。

### 原理

1. 把 iterable 转成数组（ES5 下示例只处理 **数组**；生产环境可用 `Array.from` 或自行遍历 `Symbol.iterator`）。
2. `count` 记录已完成个数；`results` 按下标存结果。
3. 每一项：`MyPromise.resolve(p).then(onFulfilled, onRejected)`。
   - fulfilled：写入 `results[i]`，`count++`，若 `count === len` 则 `resolve(results)`。
   - rejected：**立刻** `reject(reason)`（其余 then 仍会跑完，但外层 Promise 已 rejected，这是常见 polyfill 行为）。
4. `len === 0` 时直接 `resolve([])`。

```javascript
MyPromise.all = function (arr) {
  return new MyPromise(function (resolve, reject) {
    if (!arr || typeof arr.length !== 'number') {
      return reject(new TypeError('MyPromise.all expects an array'));
    }
    var len = arr.length;
    if (len === 0) {
      resolve([]);
      return;
    }
    var results = new Array(len);
    var count = 0;

    function check(i, val) {
      results[i] = val;
      count++;
      if (count === len) {
        resolve(results);
      }
    }

    for (var i = 0; i < len; i++) {
      (function (index) {
        MyPromise.resolve(arr[index]).then(
          function (v) {
            check(index, v);
          },
          reject
        );
      })(i);
    }
  });
};
```

**要点**：用 IIFE 捕获 `index`，避免循环闭包经典坑；reject 回调直接传 **`reject`**，实现「第一个失败即失败」。

---

## 5. `MyPromise.race`

### 用途

- 超时、多源择优：**谁先落定用谁**（成功、失败都算落定）。
- 例如：`Promise.race([fetch(url), delay(5000).then(() => reject('timeout'))])`。

### 易混点

| 别和…混淆 | 区别 |
|-----------|------|
| **`any`** | `race` 采纳 **第一个 settled**（可能是 reject）；`any` 只认 **第一个 fulfilled**，全 reject 才失败。 |
| **`all`** | `all` 要等 **全部** fulfilled；`race` 只等 **一个** settled。 |

**空 iterable**：规范里 `Promise.race([])` 得到的 Promise **永远 pending**；实现里 `len === 0` 时不调用 resolve/reject 即可。

### 原理

对每个元素 `MyPromise.resolve(p).then(resolve, reject)`，**同一个** `resolve`/`reject` 会被第一个 settled 的项触发；之后再次调用会被 `MyPromise` 内部「非 pending 不可再改状态」挡住。

```javascript
MyPromise.race = function (arr) {
  return new MyPromise(function (resolve, reject) {
    if (!arr || typeof arr.length !== 'number') {
      return reject(new TypeError('MyPromise.race expects an array'));
    }
    var len = arr.length;
    for (var i = 0; i < len; i++) {
      MyPromise.resolve(arr[i]).then(resolve, reject);
    }
  });
};
```

---

## 6. `MyPromise.allSettled`

### 用途

- 批量操作：想知道 **每一份** 是成功还是失败（例如批量上报、批量写库），**不想**因为一条失败就让整批 Promise reject。
- 适合配合 UI「逐项展示成功/失败」。

### 易混点

| 别和…混淆 | 区别 |
|-----------|------|
| **`all`** | `all` 一个 reject 就 **整体 reject**；`allSettled` **总是 fulfill**，用 `status: 'rejected'` 表示单项失败。 |
| **`race` / `any`** | 后两者是「竞速选一个」；`allSettled` **等全员结束**。 |

返回元素形状（规范）：

- 成功：`{ status: 'fulfilled', value }`
- 失败：`{ status: 'rejected', reason }`

### 原理

与 `all` 类似用 **计数器**，但 **reject 也计入完成**，并写入 `rejected` 结构；**从不**对外 `reject`（除非 iterable 本身遍历抛错——数组版可忽略）。

```javascript
MyPromise.allSettled = function (arr) {
  return new MyPromise(function (resolve) {
    if (!arr || typeof arr.length !== 'number') {
      return resolve([]);
    }
    var len = arr.length;
    if (len === 0) {
      resolve([]);
      return;
    }
    var out = new Array(len);
    var count = 0;

    function done(i, entry) {
      out[i] = entry;
      count++;
      if (count === len) {
        resolve(out);
      }
    }

    for (var i = 0; i < len; i++) {
      (function (index) {
        MyPromise.resolve(arr[index]).then(
          function (v) {
            done(index, { status: 'fulfilled', value: v });
          },
          function (r) {
            done(index, { status: 'rejected', reason: r });
          }
        );
      })(i);
    }
  });
};
```

---

## 7. `MyPromise.any`

### 用途

- **任一成功即可**（镜像 `all` 的「任一失败即败」）：例如多个镜像 CDN，谁先返回用谁。
- 全部失败时，需要 **汇总错误**（规范为 `AggregateError`）。

### 易混点

| 别和…混淆 | 区别 |
|-----------|------|
| **`race`** | 第一个 **reject** 也会赢 `race`；`any` **忽略 reject**，继续等其它项，直到有人 fulfill 或 **全部 reject**。 |
| **`all`** | `all` 要 **全部** fulfill；`any` 要 **至少一个** fulfill。 |

### 原理

- `fulfilledCount` 不适用；用 **`rejectCount`**：每项 rejected 时 `rejectCount++`，若等于 `len` 则 **`reject(new AggregateError(errors))`**。
- 任一项 fulfilled：**立刻 `resolve(v)`**（与 `all` 里立刻 reject 对称）。

ES5 没有 `AggregateError` 时，可用简易替身并挂上 `errors` 数组：

```javascript
function AggregateError(errors, message) {
  var e = new Error(message || 'All promises were rejected');
  e.name = 'AggregateError';
  e.errors = errors;
  return e;
}

MyPromise.any = function (arr) {
  return new MyPromise(function (resolve, reject) {
    if (!arr || typeof arr.length !== 'number') {
      return reject(new TypeError('MyPromise.any expects an array'));
    }
    var len = arr.length;
    if (len === 0) {
      reject(new AggregateError([], 'All promises were rejected'));
      return;
    }
    var errors = new Array(len);
    var rejectCount = 0;

    for (var i = 0; i < len; i++) {
      (function (index) {
        MyPromise.resolve(arr[index]).then(
          resolve,
          function (r) {
            errors[index] = r;
            rejectCount++;
            if (rejectCount === len) {
              reject(new AggregateError(errors, 'All promises were rejected'));
            }
          }
        );
      })(i);
    }
  });
};
```

**要点**：`then` 的第一个参数直接传 **`resolve`**，第一个 fulfill 的项会直接落定外层；`errors[index]` 保留失败顺序，方便调试。

---

## 8. `MyPromise.withResolvers`（ES2024）

### 用途

- 需要在 **非 executor 回调** 里（事件监听、第三方 API）拿到 `resolve`/`reject`，又要避免「先 `new Promise` 再赋给外部变量」的临时变量写法。
- 等价于手写 **Deferred**，但形状与语言标准一致。

### 易混点

| 别和…混淆 | 区别 |
|-----------|------|
| 仅 `new MyPromise((res, rej) => { … })` | 若 resolve 函数只在 executor 同步栈里可用，**传不出**给异步注册的逻辑；`withResolvers` 把两个函数 **和 promise 一起返回**。 |
| `Promise.resolve()` | 只创建「将来由 `resolve` 参数落定」的通道，**不会**把 `resolve`/`reject` 暴露给外部。 |

### 原理

构造一个 Promise，在 executor 里把 `resolve`/`reject` **赋给外部对象** 的字段，再返回 `{ promise, resolve, reject }`。

```javascript
MyPromise.withResolvers = function () {
  var out = {};
  out.promise = new MyPromise(function (resolve, reject) {
    out.resolve = resolve;
    out.reject = reject;
  });
  return out;
};
```

注意：`out.promise` 创建时 executor **同步** 运行，因此返回 `out` 时 `resolve`/`reject` 已就绪。

---

## 9. 合并挂载

把 **§2–§8** 里各段 `MyPromise.xxx = function …` 原样贴到上一篇 polyfill 的 IIFE 内、`global.MyPromise = MyPromise` 之前即可（`resolve` / `reject` 若已存在则跳过 §2–§3）。`any` 需要先定义同文件内的 `AggregateError` 替身（或改用原生 `AggregateError`）。

---

## 10. 自测建议

```javascript
// all：顺序与全 fulfilled
MyPromise.all([
  MyPromise.resolve(1),
  MyPromise.resolve(2),
]).then(function (a) {
  console.log('all', a); // [1, 2]
});

// race vs any：一个快 reject、一个慢 fulfill
var fastReject = MyPromise.reject('no');
var slowOk = new MyPromise(function (r) {
  setTimeout(function () {
    r('ok');
  }, 50);
});
MyPromise.race([fastReject, slowOk]).then(null, function (e) {
  console.log('race', e); // 'no'
});
MyPromise.any([fastReject, slowOk]).then(function (v) {
  console.log('any', v); // 'ok'
});

// allSettled：混合结果
MyPromise.allSettled([MyPromise.resolve(1), MyPromise.reject(2)]).then(function (r) {
  console.log('allSettled', r);
});
```

---

## 11. 小结

| 方法 | 一句话 |
|------|--------|
| `resolve` / `reject` | 工厂：包装值 vs 包装错误 |
| `all` | 全赢才赢，一输全输 |
| `race` | 第一个落定（成或败） |
| `allSettled` | 全跑完，逐个报状态 |
| `any` | 第一个成功；全败才败 |
| `withResolvers` | 标准 Deferred：`{ promise, resolve, reject }` |

实现组合 API 时记住两件事：**每一项先 `resolve` 成 Promise**，再用 **计数 / 第一个 settled** 决定外层 fate。搞清「失败是立刻传染还是汇总到结果里」，就不会在 `all`、`race`、`any` 之间选错。

若还要补 **`try`（Promise.try）** 或完整 **iterable（非数组）** 版本，可以在同一文件里按规范加 `GetIterator` 逻辑，核心计数不变。
