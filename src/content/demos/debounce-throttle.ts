/**
 * @param fn 被包装的函数；泛型 T 从 fn 自动推断，而不是写死 any[]
 * @param wait 安静期 / 最小间隔（ms）
 *
 * 泛型要点：
 * - T extends (...args: never[]) => void → 约束「必须是可调用的函数」
 * - Parameters<T> → 取出 fn 的参数元组，返回的包装函数与之相同，search('x') 仍有类型检查
 * - ThisParameterType<T> → 保留 fn 上的 this 类型；写在形参列表里是 TS「伪参数」，编译后不存在，调用时不必多传
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    // this 来自调用方：search('a') 的 this 可能是 undefined；obj.search('a') 的 this 是 obj
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      fn.apply(this, args); // 延迟执行时把同一 this、同一 args 转给原 fn
    }, wait);
  };
}

/** 泛型设计与 debounce 相同：T / Parameters<T> / ThisParameterType<T> 保证包装前后签名一致 */
export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

/* --- 使用示例（在 Node / 浏览器控制台可粘贴运行）---

const search = debounce((q: string) => console.log('请求:', q), 300);
search('a');
setTimeout(() => search('ab'), 100);
setTimeout(() => search('abc'), 200);
// → 约 t=500ms 仅打印: 请求: abc

const reportScroll = throttle(() => console.log('scroll'), 200);
reportScroll(); // t=0  打印
setTimeout(() => reportScroll(), 50);  // 忽略
setTimeout(() => reportScroll(), 210); // 打印
*/
