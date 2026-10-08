/**
 * 重试函数
 * @param fn 函数
 * @param times 重试次数
 * @returns
 */
export function retry(fn: () => Promise<any>, times: number): Promise<any> {
  return fn().catch((error) => {
    if (times > 0) {
      return retry(fn, times - 1);
    }
    throw error;
  });
}

/** 队列里存的是「执行一次并在外部 Promise 上 settle」的 runner，不是原始 task */
type Task = () => Promise<void>;

/**
 * 并发限制请求池
 * 使用方式：new 之后，无脑 add,同时请求数量不会超过 limit
 * @param limit 最大并发数
 */
export class RequestPool {
  private readonly limit: number;
  private running = 0;
  private queue: Task[] = [];
  constructor(limit: number) {
    this.limit = limit;
  }
  /** 返回 Promise，可以 await 等待任务结果 */
  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => task().then(resolve).catch(reject));
      this.run();
    });
  }
  private run() {
    while (this.running < this.limit && this.queue.length > 0) {
      const item = this.queue.shift();
      this.running++;
      item?.().finally(() => {
        this.running--;
        this.run();
      });
    }
  }
}
