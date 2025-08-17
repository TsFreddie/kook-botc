/**
 * 全局异步计数
 *
 * 方便关闭时等待全部队列清空后再进行销毁
 */
let counter = 0;
let callbacks: (() => void)[] = [];
let errorHandler: ((error: any) => void) | null = null;

export const onError = (handler: (error: any) => void) => {
  errorHandler = handler;
};

export const waitQueue = () => {
  return new Promise<void>((resolve) => {
    callbacks.push(resolve);
  });
};

const resolveCounter = () => {
  if (counter !== 0) return;
  callbacks.forEach((cb) => cb());
  callbacks = [];
};

/**
 * 异步事件队列
 * - Sequential 模式保证事件按顺序执行
 */
export class SequentialQueue {
  private running = false;
  private destroyed = false;
  private stopped = false;
  private queue: (() => Promise<void>)[] = [];

  public size() {
    return this.queue.length;
  }

  public push(task: () => Promise<void>): Promise<void> {
    if (this.destroyed) return Promise.resolve();

    return new Promise<void>((resolve) => {
      this.queue.push(async () => {
        counter++;
        try {
          if (this.stopped) {
            resolve();
            return;
          }
          await task();
          resolve();
        } catch (e) {
          // log the error and notify the global handler
          console.error(e);
          errorHandler?.(e);
        } finally {
          counter--;
        }
      });

      if (!this.running) {
        this.run();
      }
    });
  }

  async run() {
    if (this.running) return;
    this.running = true;

    await new Promise<void>((resolve) => {
      // run next tick
      setTimeout(async () => {
        let task;
        while ((task = this.queue.shift())) {
          await task();
        }

        this.running = false;
        resolveCounter();
        resolve();
      });
    });
  }

  /**
   * 销毁队列，销毁的队列不再接受新的任务
   *
   * @param stop 是否停止队列中剩余的任务
   */
  async destroy(stop: boolean) {
    if (this.destroyed) {
      throw new Error('队列已销毁');
    }

    this.stopped ||= stop;
    this.destroyed = true;

    // 确认队尾完成
    await this.push(async () => {});
  }
}

/**
 * 异步事件队列
 * - Latest 模式在任务堆积时会忽略中间的事件，只执行最新的事件
 *
 * Latest 模式不可以返回值
 */
export class LatestQueue {
  private running = false;
  private destroyed = false;
  private stopped = false;
  private queue: {
    task: () => Promise<void>;
    resolve: () => void;
    reject: (reason?: any) => void;
  }[] = [];

  public size() {
    return this.queue.length;
  }

  public push(task: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      counter++;
      if (!this.running) {
        this.run();
      }
    });
  }

  async run() {
    if (this.running) return;
    this.running = true;

    await new Promise<void>((resolve) => {
      // run next tick
      setTimeout(async () => {
        let data;

        // 直接 resolve 所有中间过程，并清理剩余最后一个
        while (this.queue.length > 0) {
          // 清理剩余最后一个
          while (this.queue.length > 1 && (data = this.queue.shift())) {
            const { resolve } = data;
            resolve();
          }

          // 执行最后一个任务
          data = this.queue.shift()!;
          const { task, resolve } = data;
          try {
            if (this.destroyed) {
              // 直接 resolve
              resolve();
            }
            await task();
            resolve();
          } catch (e) {
            // log the error and notify the global handler
            console.error(e);
            errorHandler?.(e);
          } finally {
            counter--;
          }
        }

        this.running = false;
        resolveCounter();
        resolve();
      });
    });
  }

  /**
   * 销毁队列，销毁的队列不再接受新的任务
   *
   * @param stop 是否停止队列中剩余的任务
   */
  async destroy(stop: boolean) {
    if (this.destroyed) {
      throw new Error('队列已销毁');
    }

    this.stopped ||= stop;
    this.destroyed = true;

    // 确认队尾完成
    return this.push(async () => {});
  }
}
