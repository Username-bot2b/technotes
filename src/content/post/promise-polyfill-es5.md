---
publishDate: 2026-09-30T06:00:00Z
title: 手动实现 Promise polyfill（ES5）
excerpt: 在 ES5 环境下从零实现符合 Promises/A+ 的 Promise：先讲状态机、then 链与 thenable  assimilation 的原理，再分步骤写出可运行的 polyfill。
category: JavaScript
tags:
  - promise
  - es5
  - polyfill
  - javascript
  - 异步
author: technotes
---

如果你已经会用 `async/await`，但说不清「`then` 为什么能链式调用」「为什么不能在 executor 里同步 `resolve(promise)`」，这篇笔记会把 **Promise 的最小可运行模型** 拆开，并在 **ES5** 语法下手写一个可用的 polyfill。

目标不是 100% 复刻浏览器内置实现，而是实现一个 **通过 Promises/A+ 核心测试思路** 的 subset：构造、`then`、链式传递、thenable 展开、`Promise.resolve` / `Promise.reject`。异步调度用 `setTimeout(fn, 0)`（宏任务），与原生微任务有差异，文末会说明。

---

## 1. 要先统一的三个概念

### 1.1 状态机

一个 Promise 实例在任意时刻只有一种状态：

| 状态 | 含义 |
|------|------|
| `pending` | 初始；结果尚未确定 |
| `fulfilled` | 已成功，有一个不可变的 `value` |
| `rejected` | 已失败，有一个不可变的 `reason` |

规则（与规范一致）：

- 只能从 `pending` → `fulfilled` 或 `pending` → `rejected`，**不可逆**。
- `then` 注册的处理函数只有在 **落定（settled）之后** 才会被调用。

### 1.2 `then` 返回新的 Promise

`p.then(onFulfilled, onRejected)` **总是返回一个新的 Promise** `p2`。这样链式调用的本质是：

1. 等 `p` 落定；
2. 执行用户回调，得到结果 `x`；
3. 用 **Promise 决议过程（resolution procedure）** 把 `x` 变成 `p2` 的结果。

链上的错误会向下传递，直到某一层 `onRejected` 处理掉。

### 1.3 异步执行

规范要求：`then` 的回调不能同步执行，即使 `p` 已经是 `fulfilled`。这样避免「注册回调时父 Promise 已在执行栈中同步触发子逻辑」导致的重入问题。

ES5 环境没有 `queueMicrotask`，常见 polyfill 用 **`setTimeout(callback, 0)`** 把回调推到宏任务。行为上仍是「晚于当前同步代码」，但顺序与原生 `Promise`（微任务）混用时可能不同——实现原理一致即可。

---

## 2. 实现步骤总览

按依赖顺序，建议分七步完成（每步都在上一步基础上扩展）：

1. **骨架**：构造函数、`pending/fulfilled/rejected`、`_value` / `_reason`、`_onFulfilled` / `_onRejected` 队列。
2. **`resolve` / `reject`**：只允许从 `pending` 改变状态；在 ES5 里用 `setTimeout` 异步触发已注册的 `then` 回调。
3. **`then`**：返回新 Promise；若已落定则入队执行，若 `pending` 则把回调存入队列。
4. **执行回调**：`try/catch` 包裹用户函数；返回值 `x` 交给 **resolutionProcedure** 决定子 Promise 的命运。
5. **`resolutionProcedure`**：处理 thenable、循环引用、重复 resolve。
6. **`Promise.resolve` / `Promise.reject`**：静态工厂。
7. **（可选加强）** `executor` 里同步 `throw` 等价于 `reject`；`onFulfilled` / `onRejected` 非函数时用穿透（pass-through）。

下面按步骤给出代码，最终合并为一份完整 polyfill。

---

## 3. 步骤 1：构造函数与状态

```javascript
function MyPromise(executor) {
  var self = this;
  self.status = 'pending';
  self.value = undefined;
  self.reason = undefined;
  // pending 时注册的 then 回调，落定后统一异步触发
  self.onFulfilledCallbacks = [];
  self.onRejectedCallbacks = [];

  function resolve(value) {
    if (self.status !== 'pending') return; // 状态只能变更一次
    self.status = 'fulfilled';
    self.value = value;
    self.onFulfilledCallbacks.forEach(function (fn) {
      asyncRun(fn); // 即使已 fulfilled，then 回调也须异步执行
    });
  }

  function reject(reason) {
    if (self.status !== 'pending') return;
    self.status = 'rejected';
    self.reason = reason;
    self.onRejectedCallbacks.forEach(function (fn) {
      asyncRun(fn);
    });
  }

  try {
    executor(resolve, reject);
  } catch (e) {
    reject(e); // executor 同步抛错等价于 reject
  }
}

function asyncRun(fn) {
  setTimeout(fn, 0); // ES5 下用宏任务模拟「异步回调」
}
```

要点：

- 回调先存进数组，**等 resolve/reject 后再统一异步执行**。
- `executor` 同步抛错 → `reject(e)`，与原生一致。

此时尚未实现 `then`，下一步补上。

---

## 4. 步骤 2：`then` 与返回新 Promise

```javascript
MyPromise.prototype.then = function (onFulfilled, onRejected) {
  var self = this;
  var promise2; // 先声明，供 resolvePromise 做 promise2 === x 检测

  // then 的 resolve/reject 只落定「本段 then 返回的新 Promise」
  promise2 = new MyPromise(function (resolve, reject) {
    function runFulfilled() {
      try {
        if (typeof onFulfilled !== 'function') {
          resolvePromise(promise2, self.value, resolve, reject); // 成功链值穿透
          return;
        }
        var x = onFulfilled(self.value);
        resolvePromise(promise2, x, resolve, reject); // 用 x 决议 promise2
      } catch (e) {
        reject(e);
      }
    }

    function runRejected() {
      try {
        if (typeof onRejected !== 'function') {
          reject(self.reason); // 失败链错误穿透（仍是 reject，不是 resolve）
          return;
        }
        var x = onRejected(self.reason);
        resolvePromise(promise2, x, resolve, reject);
      } catch (e) {
        reject(e);
      }
    }

    if (self.status === 'fulfilled') {
      asyncRun(runFulfilled);
    } else if (self.status === 'rejected') {
      asyncRun(runRejected);
    } else {
      // 父 Promise 仍 pending：等 resolve/reject 后再跑 run*
      self.onFulfilledCallbacks.push(runFulfilled);
      self.onRejectedCallbacks.push(runRejected);
    }
  });

  return promise2;
};

// Promises/A+ 2.3：把 then 回调的返回值 x 变成 promise2 的结果
function resolvePromise(promise2, x, resolve, reject) {
  if (promise2 === x) {
    reject(new TypeError('Chaining cycle detected for promise'));
    return;
  }
  if (x instanceof MyPromise) {
    x.then(resolve, reject);
    return;
  }
  if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
    var then;
    var called = false; // thenable 只允许 resolve/reject 一次
    try {
      then = x.then; // 读 then 可能抛错，须单独 try
    } catch (e) {
      reject(e);
      return;
    }
    if (typeof then === 'function') {
      try {
        then.call(
          x,
          function (y) {
            if (called) return;
            called = true;
            resolvePromise(promise2, y, resolve, reject); // 递归 assimilation
          },
          function (r) {
            if (called) return;
            called = true;
            reject(r);
          }
        );
      } catch (e) {
        if (called) return;
        called = true;
        reject(e);
      }
      return;
    }
  }
  resolve(x); // 普通值直接 fulfill promise2
}
```

说明：

- **`promise2` 必须先声明再传入 `new MyPromise` 的 executor**，否则 `resolvePromise` 里无法做 `promise2 === x` 的循环检测。
- **`onFulfilled` / `onRejected` 不是函数**：成功链用 `resolvePromise` 透传 `value`；失败链直接 `reject(reason)` 透传错误（Promises/A+ 2.2.7）。
- **`resolve` / `reject` 参数**：来自子 Promise 构造函数的决议函数，专门用来落定 **`then` 返回的那个新 Promise**。
- **`called` 标志**：防止 thenable 多次调用 resolve/reject。

---

## 5. 步骤 3：静态方法与完整文件

```javascript
MyPromise.resolve = function (value) {
  if (value instanceof MyPromise) return value; // 已是 Promise 则原样返回
  return new MyPromise(function (resolve) {
    resolve(value); // 走构造器 resolve，会展开 thenable
  });
};

MyPromise.reject = function (reason) {
  return new MyPromise(function (_, reject) {
    reject(reason);
  });
};
```

将以上片段合并后的完整版如下（可直接在 ES5 环境运行）。构造函数里的 `resolve` 负责 **当前实例** 的落定；`then` 里的 `resolvePromise` 负责 **子 Promise** 的落定——两套逻辑不要混在同一组 `resolve/reject` 上。

```javascript
(function (global) {
  function asyncRun(fn) {
    setTimeout(fn, 0);
  }

  function MyPromise(executor) {
    var self = this;
    self.status = 'pending';
    self.value = undefined;
    self.reason = undefined;
    self.onFulfilledCallbacks = [];
    self.onRejectedCallbacks = [];

    // 落定「当前实例 self」，与 then 里的 resolvePromise 分工不同
    function resolve(value) {
      if (self.status !== 'pending') return;
      if (value === self) {
        reject(new TypeError('Chaining cycle detected for promise'));
        return;
      }
      if (value instanceof MyPromise) {
        value.then(resolve, reject); // 吸收另一个 Promise 的状态
        return;
      }
      if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
        var then;
        var called = false;
        try {
          then = value.then;
        } catch (e) {
          reject(e);
          return;
        }
        if (typeof then === 'function') {
          try {
            then.call(
              value,
              function (y) {
                if (called) return;
                called = true;
                resolve(y); // 继续走 resolve，可能仍是 thenable
              },
              function (r) {
                if (called) return;
                called = true;
                reject(r);
              }
            );
          } catch (e) {
            if (called) return;
            called = true;
            reject(e);
          }
          return;
        }
      }
      self.status = 'fulfilled';
      self.value = value;
      self.onFulfilledCallbacks.forEach(function (fn) {
        asyncRun(fn);
      });
    }

    function reject(reason) {
      if (self.status !== 'pending') return;
      self.status = 'rejected';
      self.reason = reason;
      self.onRejectedCallbacks.forEach(function (fn) {
        asyncRun(fn);
      });
    }

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  // then 链：用回调返回值 x 决议 promise2（子 Promise）
  function resolvePromise(promise2, x, resolve, reject) {
    if (promise2 === x) {
      reject(new TypeError('Chaining cycle detected for promise'));
      return;
    }
    if (x instanceof MyPromise) {
      x.then(resolve, reject);
      return;
    }
    if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
      var then;
      var called = false;
      try {
        then = x.then;
      } catch (e) {
        reject(e);
        return;
      }
      if (typeof then === 'function') {
        try {
          then.call(
            x,
            function (y) {
              if (called) return;
              called = true;
              resolvePromise(promise2, y, resolve, reject);
            },
            function (r) {
              if (called) return;
              called = true;
              reject(r);
            }
          );
        } catch (e) {
          if (called) return;
          called = true;
          reject(e);
        }
        return;
      }
    }
    resolve(x);
  }

  MyPromise.prototype.then = function (onFulfilled, onRejected) {
    var self = this;
    var promise2; // 先声明，供循环引用检测

    promise2 = new MyPromise(function (resolve, reject) {
      function runFulfilled() {
        try {
          if (typeof onFulfilled !== 'function') {
            resolvePromise(promise2, self.value, resolve, reject);
            return;
          }
          var x = onFulfilled(self.value);
          resolvePromise(promise2, x, resolve, reject);
        } catch (e) {
          reject(e);
        }
      }

      function runRejected() {
        try {
          if (typeof onRejected !== 'function') {
            reject(self.reason);
            return;
          }
          var x = onRejected(self.reason);
          resolvePromise(promise2, x, resolve, reject);
        } catch (e) {
          reject(e);
        }
      }

      if (self.status === 'fulfilled') {
        asyncRun(runFulfilled);
      } else if (self.status === 'rejected') {
        asyncRun(runRejected);
      } else {
        self.onFulfilledCallbacks.push(runFulfilled);
        self.onRejectedCallbacks.push(runRejected);
      }
    });

    return promise2;
  };

  MyPromise.resolve = function (value) {
    if (value instanceof MyPromise) return value;
    return new MyPromise(function (resolve) {
      resolve(value);
    });
  };

  MyPromise.reject = function (reason) {
    return new MyPromise(function (_, reject) {
      reject(reason);
    });
  };

  global.MyPromise = MyPromise;
})(typeof window !== 'undefined' ? window : this);
```

---

## 6. 自测用例（建议自己在控制台跑）

```javascript
// 1. 基础 fulfilled
MyPromise.resolve(1).then(function (v) {
  console.log('1:', v);
});

// 2. 链式与穿透
MyPromise.resolve(1)
  .then(function (v) {
    return v + 1;
  })
  .then(function (v) {
    console.log('2:', v);
  });

// 3. catch 穿透（无 onRejected 时继续 reject）
MyPromise.reject('err')
  .then(function () {})
  .then(null, function (e) {
    console.log('3:', e);
  });

// 4. thenable
MyPromise.resolve({
  then: function (onFulfilled) {
    setTimeout(function () {
      onFulfilled(42);
    }, 10);
  },
}).then(function (v) {
  console.log('4:', v);
});

// 5. executor 抛错
new MyPromise(function () {
  throw new Error('boom');
}).then(null, function (e) {
  console.log('5:', e.message);
});
```

---

## 7. 与原生 Promise 的差异（心里有数即可）

| 点 | 本 polyfill | 原生 Promise |
|----|-------------|--------------|
| 调度 | `setTimeout` 宏任务 | 微任务（MutationObserver / queueMicrotask） |
| API | `then`、静态 `resolve/reject` | 另有 `catch`、`finally`、`all`、`race` 等 |
| 严格性 | 手写 assimilation，边界 case 可能遗漏 | 符合完整 ECMAScript 语义 |

若要继续扩展，建议顺序：**`catch`（语法糖）→ `Promise.all` → `finally`**。`all` 的重点是计数与「任一 reject 即 reject 整体」。

---

## 8. 小结

| 步骤 | 做什么 |
|------|--------|
| 状态机 | `pending` 只能走向 fulfilled / rejected 一次 |
| `then` | 返回新 Promise；回调异步执行 |
| 链 | 回调返回值 `x` 经 `resolvePromise` 决定子 Promise |
| Thenable | 读 `then`、防多次调用、递归 assimilation |
| ES5 | 无 class / 箭头函数；异步用 `setTimeout` |

搞懂这套之后，再去看 [Promises/A+ 2.3](https://promisesaplus.com/) 或 V8 源码，会轻松很多——**Promise 不是魔法，而是一个带队列的状态机 + 一个递归的 `resolvePromise`**。
