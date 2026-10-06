---
publishDate: 2026-10-03T02:00:00Z
title: TypeScript 实现简单的 debounce 与 throttle
excerpt: 讲清防抖与节流的用途和差异，再用 TypeScript 手写最小可用实现，并在关键步骤加注释。
category: JavaScript,TypeScript
tags:
  - typescript
  - debounce
  - throttle
  - javascript
  - 性能
author: technotes
---

高频事件（输入、滚动、窗口 `resize`）若在每次触发时都跑重逻辑，容易卡顿。 **`debounce`（防抖）** 和 **`throttle`（节流）** 都是「少执行几次」，但规则不同。本文先讲用途与区别，再分别讲实现原理，最后给出带注释的 TypeScript 代码。

---

## 1. debounce：用途

**目标**：连续触发时 **先不执行**，等触发 **停下来** 超过指定时间，再 **执行最后一次**（或可选地执行第一次，见后文扩展）。

**现实生活例子（trailing debounce）**：电梯门本来 **5 秒后**自动关（启动一次定时）；第 3 秒又有人进，**重新计时** 5 秒；期间每进一次人都 **再延迟** 5 秒。直到 **连续 5 秒没有新干扰**，才真正关门——对应代码里：每次「进人」= 调用包装函数，「关门」= `wait` 安静期满后 **执行一次** `fn`（不是每进人都关一次）。

典型场景：

| 场景 | 为何用 debounce |
|------|-----------------|
| 搜索框联想 | 用户还在打字，不必每个键都请求接口 |
| 表单校验 | 等输入稳定后再校验，减少干扰 |
| 窗口 `resize` 结束后重算布局 | 只关心拖拽结束后的尺寸 |

直觉：**「等你歇一会儿我再算」**。

---

## 2. throttle：用途

`throttle` 作名词可指 **节流阀**和**喉咙**（和 throat「喉咙」同源，记成「卡脖子」也行——把流量掐在可控范围内）。

**现实生活例子（leading throttle 直觉）**：水龙头后面的水压很大，但阀芯让出水 **最多就那么一股**；你拧开再猛，也不会在极短时间内漫出来。对应到函数：事件触发再密，**每个 `wait` 窗口里最多执行一次** `fn`（本文实现是窗口开头那次立刻执行，中间多余的触发直接丢掉）。

**目标**：在固定时间窗口内，无论触发多少次，**最多执行一次**（按 leading / trailing 策略，见实现节）。

典型场景：

| 场景 | 为何用 throttle |
|------|-----------------|
| 滚动加载 / 滚动埋点 | 需要 **持续** 跟手，但不能每 1px 都跑 |
| 按钮防连点 | 短时间内只允许生效一次 |
| 拖拽时的坐标上报 | 固定频率采样即可 |

直觉：**「每隔一段时间最多执行一次」**。

---

## 3. 区别（别混用）

| | debounce | throttle |
|---|----------|----------|
| 关注点 | 触发 **停止** 后的那一次 | 时间轴上的 **执行频率上限** |
| 连续快速触发 | 可能 **一直不执行**，直到停下 | **按间隔** 仍会周期性执行 |
| 搜索联想 | ✅ 合适 | ❌ 打字期间仍会隔 `wait` 打一次请求 |
| 滚动监听 | ❌ 滚动中可能从不触发 | ✅ 合适 |

简图（连续触发 `|`，执行 `*`，`wait` 为间隔）：

```text
debounce（trailing）：  |||||||||||  → 停下 wait 后 → *
throttle（leading）：   |*  |*  |*  |*  （每 wait 最多一次）
```

---

## 4. debounce：实现原理

1. 每次调用包装函数时，**清掉** 上一次定时器（若存在）。
2. **重新** 启动一个 `wait` ms 的定时器。
3. 定时器到期时，用 **最后一次调用** 传入的参数执行原函数 `fn`。
4. 若在 `wait` 内 again 触发，重复 1–2，因此只有「安静 `wait` ms」才会执行。

要点：

- 闭包保存 `timer` 与最新 `args`（以及 `this`，若需要）。
- 返回的新函数类型应与 `fn` 参数一致；返回值若需要「等 debounce 结果」，要改成返回 `Promise`（本文做 **同步 fire-and-forget** 的最小版）。

---

## 5. debounce：代码

```typescript
/**
 * 泛型 T：由传入的 fn 推断，表示「原函数」的完整类型（不是手写 any[]）
 * - T extends (...args: never[]) => void → fn 必须是可调用的函数
 * - 返回 (...args: Parameters<T>) => void → 包装函数与 fn 参数列表一致，IDE 仍能校验 search('x')
 * - 包装函数上的 ThisParameterType<T> → 若 fn 带 this 类型（类方法），apply 时不丢
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  // 定时器 id；undefined 表示当前没有在「等待安静期」
  let timer: ReturnType<typeof setTimeout> | undefined;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    // 首位的 this: 仅为 TS 类型标注，不是运行时参数；调用 debounced('x') 不用传 this
    // args 类型 = Parameters<T>，与 fn 形参同步；闭包里延迟执行时仍用同一组 args
    if (timer !== undefined) {
      clearTimeout(timer); // 又来一次触发：重置安静期
    }
    timer = setTimeout(() => {
      timer = undefined;
      fn.apply(this, args); // this / args 类型已由泛型约束，无需 as any
    }, wait);
  };
}
```

**注释对应关系**：`clearTimeout` ↔ 原理第 1 步；`setTimeout` ↔ 第 2 步；只保留最后一次 `args` ↔ 第 3 步。

**若不写泛型**：常写成 `debounce(fn: (...args: any[]) => void)`，包装函数参数也会变成 `any`，`debounce((q: string) => …)` 之后调用 `search(123)` 编译期不会报错。用 `Parameters<T>` 是为了 **从 fn 反推并继承参数类型**。

**`this: ThisParameterType<T>` 要单独传吗？** 不用。这是 TypeScript 的 **伪参数（this parameter）**：只存在于类型层，**编译成 JavaScript 后会被擦掉**，不是 `function (this, ...args)` 里的第一个实参。下面 `function (this: Form, q: string)` 里的 **`this: Form` 也不是在「传 this」**，只是声明「这个 function 被调用时，`this` 应该是 `Form`」——和 `q: string` 标注 `q` 的类型一样，都属于类型语法，不是多传一个值。调用时仍然是你熟悉的形式：`search('abc')` 只传业务参数；运行时 `this` 由 **怎么调用** 决定（严格模式下独立调用常为 `undefined`；`obj.handler()` 则为 `obj`）。包装函数里写 `this`，是为了在 `fn.apply(this, args)` 时把 **同一次调用** 的 `this` 原样交给 `fn`。若 `fn` 是普通箭头函数且从不依赖 `this`，这一行类型几乎无感，但类方法、`function () { this.x }` 等场景需要保留。

```typescript
// 定义 fn 时写的 (this: Form, q: string) 里，this: Form 是「类型标注」，不是 JavaScript 实参
// 编译后相当于 function (q) { ... }，并没有多出一个 Form 形参
class Form {
  query = '';
  search = debounce(function (this: Form, q: string) {
    this.query = q;
  }, 300);
}
const form = new Form();
form.search('abc'); // 调用处：仍然只有这一个实参 'abc'，不是 search(form, 'abc')
// 运行时 this 由「form.search(...)」这种成员调用自动绑定为 form，debounce 内部 fn.apply(this, args) 会把它传给上面的 fn
```

**使用示例（`wait = 300`，注释为相对时间）**：

```typescript
const search = debounce((q: string) => {
  console.log('请求:', q);
}, 300);

// t=0ms:   search('a')  → 安排 300ms 后执行
// t=100ms: search('ab') → 清掉上次定时，重新 300ms
// t=200ms: search('abc')→ 再清、再计时
// t=500ms: 自最后一次调用起已满 300ms → 执行 fn
// 控制台: 请求: abc   （只一次，且是最后一次参数）

search('a');
setTimeout(() => search('ab'), 100);
setTimeout(() => search('abc'), 200);
```

---

## 6. throttle：实现原理

常见两种写法，本文用 **时间戳 leading**（实现短、行为好讲）：

1. 闭包记录 **上次执行时间** `lastTime`（初始为 `0`）。
2. 每次调用时，若 `now - lastTime >= wait`，则 **立刻执行** `fn`，并更新 `lastTime`。
3. 否则 **忽略** 本次调用（窗口内的多余触发被丢掉）。

这是 **leading throttle**：每个窗口的 **第一次** 有效触发会执行。若还要 **trailing**（窗口结束再补一次最后一次），需要额外 `setTimeout` + 缓存 `args`，代码会接近 lodash 的 `throttle`，可作为扩展练习。

---

## 7. throttle：代码

```typescript
// T / Parameters<T> / ThisParameterType<T> 与 debounce 相同：包装前后调用签名一致
export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0; // 上次真正执行 fn 的时间戳（ms）

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now; // 先更新时间，避免 fn 执行过久导致重入窗口错乱
      fn.apply(this, args); // 泛型保证 args、this 与 fn 定义一致
    }
    // 间隔不足 wait：直接丢弃，保证频率上限
  };
}
```

若希望 **第一次也等满 `wait` 再执行**（不要 leading 立即执行），可把 `lastTime` 初始化为 `Date.now()`，或改用定时器版 trailing 实现。

**使用示例（`wait = 200`，注释为相对时间）**：

```typescript
const reportScroll = throttle(() => {
  console.log('scroll 采样');
}, 200);

// t=0ms:   reportScroll() → 立刻执行（距上次 ∞，满足 >= 200）
// t=50ms:  reportScroll() → 忽略（距上次仅 50ms）
// t=210ms: reportScroll() → 执行（距上次 210ms）
// t=250ms: reportScroll() → 忽略
// t=420ms: reportScroll() → 执行
// 控制台: scroll 采样 @ 0ms、210ms、420ms …（约每 200ms 最多一条）

reportScroll();
setTimeout(() => reportScroll(), 50);
setTimeout(() => reportScroll(), 210);
setTimeout(() => reportScroll(), 250);
setTimeout(() => reportScroll(), 420);
```

---

## 8. 合在一起对比（同一事件流两种策略）

假设某段时间内连续 10 次触发（例如 100ms 内滚轮抖了 10 下）：

```typescript
let debounceCount = 0;
let throttleCount = 0;

const onMoveDebounce = debounce(() => {
  debounceCount++;
  console.log('debounce 执行', debounceCount);
}, 300);

const onMoveThrottle = throttle(() => {
  throttleCount++;
  console.log('throttle 执行', throttleCount);
}, 300);

// 模拟 100ms 内调用 10 次（每次间隔 10ms）
for (let i = 0; i < 10; i++) {
  setTimeout(() => {
    onMoveDebounce();
    onMoveThrottle();
  }, i * 10);
}

// 约 t=100ms 后停止触发
// debounce:  自 t=90ms 最后一次调用起再 quiet 300ms → 约 t=390ms 打印一次
//            debounce 执行 1
// throttle:  t=0 第一次就执行；t=10..90 全忽略 → 只打印一次
//            throttle 执行 1
//
// 若触发持续到 t=5000ms（一直每 10ms 来一次）：
// debounce:  仍可能 0 次（永远凑不满 quiet 300ms）
// throttle:  约每 300ms 一次 → 大约 16 次
```

---

## 9. 与 lodash 等库的差异（心里有数）

| 能力 | 本文最小版 | lodash 等 |
|------|------------|-----------|
| debounce `leading` / `trailing` | 仅 trailing | 可配置 |
| throttle trailing + 最后一次补发 | 无 | 常有 |
| `cancel` / `flush` | 无 | 常有 |
| `wait` 为 0 / `requestAnimationFrame` | 未处理 | 库内优化 |

业务里若需要 **取消防抖中的 pending 调用** 或 **滚动结束再上报一次**，在闭包上暴露 `cancel()` / 做 trailing throttle 即可，核心仍是定时器 + 闭包状态。

---

## 10. 小结

| 函数 | 一句话 | 核心状态 |
|------|--------|----------|
| debounce | 安静 `wait` 后执行 **最后一次** | 一个 `timer`，每次触发重置 |
| throttle | 每 `wait` 最多执行 **一次** | `lastTime`（或 `inThrottle` 标志） |

先想清楚场景是「等用户停手」还是「限制执行频率」，再选 debounce 或 throttle；实现上都是 **闭包 + 时间**，TypeScript 用 `Parameters<T>` / `ThisParameterType<T>` 把原函数参数和 `this` 原样传给 `fn` 即可。
