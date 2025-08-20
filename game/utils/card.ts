import { BOT } from '../../bot';
import { ApiMessageType } from '../../lib/api';
import { LatestQueue } from './queue';

export interface Mountable {
  $mount(targetId: string): Promise<void>;
  $destroy(): Promise<void>;
}

export type CardState<T extends object> = T & Mountable;

/**
 * 创建简单的状态包装
 * 只会监听首层状态变化
 */
export const $card = <T extends object>(card: Card<T>): CardState<T> => {
  return new Proxy(card['state'] as CardState<T>, {
    get(target: T & CardState<T>, prop: string | symbol) {
      if (prop === '$mount') return card.mount.bind(card);
      if (prop === '$destroy') return card.destroy.bind(card);
      return target[prop as keyof T];
    },

    set(target: T & CardState<T>, prop: string | symbol, value: any) {
      if (prop === '$mount') return false;
      if (prop === '$destroy') return false;

      // 设置新值
      (target as any)[prop] = value;

      // 动态注册或取消注册状态监听器
      if (typeof prop === 'string') {
        (card as any).registerStateListener(prop, value);
      }

      // Only update if value is object or value changed
      if (typeof value === 'object' || (target as any)[prop] !== value) {
        card['update']();
      }
      return true;
    },

    has(target: T & CardState<T>, prop: string | symbol) {
      if (prop === '$mount') return false;
      if (prop === '$destroy') return false;

      return prop in target;
    },

    ownKeys(target: CardState<T>) {
      return Object.keys(target);
    },

    getOwnPropertyDescriptor(target: CardState<T>, prop: string | symbol) {
      return Object.getOwnPropertyDescriptor(target, prop);
    },
  });
};

/**
 * 卡片消息管理
 *
 * 支持创建和更新卡片消息
 */
export abstract class Card<T extends object> {
  private queue = new LatestQueue();

  private id: string = '';
  private mounted: boolean = false;

  /** 存储状态监听器的映射，用于清理 */
  private stateListeners = new Map<string, Function>();
  private destroyed = false;

  /** 在更新消息时是否静默报错 */
  protected suppressError = false;

  /** 上次处理时间戳 */
  private lastProcessTime = 0;

  abstract render(state: T): {
    content: string;
    template_id?: string;
  };

  constructor(
    /** 卡片状态 */
    private state: T,

    /** 最小更新间隔，单位毫秒 */
    private minInterval = 250,
  ) {
    this.state = state;
    for (const [key, value] of Object.entries(this.state)) {
      this.registerStateListener(key, value);
    }
  }

  /** 注册单个状态监听器 */
  private registerStateListener(key: string, value: any) {
    if (this.destroyed) return;

    // 先清理已存在的监听器
    this.unregisterStateListener(key);

    if (value && typeof value === 'object') {
      const events = value._events_;
      if (events && events.addListener) {
        const listener = () => {
          this.update();
        };
        events.addListener(listener);
        this.stateListeners.set(key, listener);
      }
    }
  }

  /** 取消注册状态监听器 */
  private unregisterStateListener(key: string) {
    const existingListener = this.stateListeners.get(key);
    if (existingListener) {
      const currentValue = (this.state as any)[key];
      if (currentValue && typeof currentValue === 'object') {
        const events = currentValue._events_;
        if (events && events.removeListener) {
          events.removeListener(existingListener);
        }
      }
      this.stateListeners.delete(key);
    }
  }

  /** 将卡片挂载到指定频道 */
  async mount(targetId: string) {
    if (this.destroyed) throw new Error('卡片已销毁');
    if (this.mounted) throw new Error('卡片已挂载');
    this.mounted = true;

    await this.queue.push(async () => {
      const rendered = this.render(this.state);
      this.id = (
        await BOT.api.messageCreate({
          target_id: targetId,
          type: ApiMessageType.CARD,
          content: rendered.content,
          template_id: rendered.template_id,
        })
      ).msg_id;
      this.lastProcessTime = Date.now();
    });
  }

  /** 确保最小处理间隔 */
  private async ensureMinInterval() {
    const now = Date.now();
    const elapsed = now - this.lastProcessTime;
    if (elapsed < this.minInterval) {
      const delay = this.minInterval - elapsed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /** 更新卡片状态 */
  private update() {
    if (this.destroyed) return;
    if (!this.mounted) {
      // 卡片尚未挂载，不进行渲染
      return;
    }

    this.queue.push(async () => {
      await this.ensureMinInterval();
      const rendered = this.render(this.state);
      try {
        await BOT.api.messageUpdate({
          msg_id: this.id,
          content: rendered.content,
          template_id: rendered.template_id,
        });
      } catch (err) {
        if (!this.suppressError) {
          throw err;
        }
      }
      this.lastProcessTime = Date.now();
    });
  }

  /**
   * 销毁卡片
   *
   * 销毁卡片不会删除消息，因为通常是直接删除频道
   */
  async destroy() {
    if (this.destroyed) throw new Error('卡片已销毁');
    this.destroyed = true;

    // 清理所有状态监听器
    for (const key of this.stateListeners.keys()) {
      this.unregisterStateListener(key);
    }

    await this.queue.destroy(true);
  }
}
