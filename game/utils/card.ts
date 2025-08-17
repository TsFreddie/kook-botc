import { BOT } from '../../bot';
import { ApiMessageType } from '../../lib/api';
import { LatestQueue } from './queue';

type CardState<T extends object> = T & { $card: Card<T> };

/**
 * 创建简单的状态包装
 * 只会监听首层状态变化
 */
export const $card = <T extends object>(card: Card<T>): CardState<T> => {
  return new Proxy(card['state'] as CardState<T>, {
    get(target: T & CardState<T>, prop: string | symbol) {
      if (prop === '$card') return card;
      return target[prop as keyof T];
    },

    set(target: T & CardState<T>, prop: string | symbol, value: any) {
      if (prop === '$card') return false;

      (target as any)[prop] = value;
      card['update']();
      return true;
    },

    has(target: T & CardState<T>, prop: string | symbol) {
      if (prop === '$card') return false;

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

  /** 当前的状态 */
  private state: T;

  private id: string = '';
  private mounted: boolean = false;

  abstract render(state: T): {
    content: string;
    template_id?: string;
  };

  constructor(state: T) {
    this.state = state;
  }

  /** 将卡片挂载到指定频道 */
  mount(targetId: string) {
    if (this.mounted) throw new Error('卡片已挂载');
    this.mounted = true;

    this.queue.push(async () => {
      const rendered = this.render(this.state);
      this.id = (
        await BOT.api.messageCreate({
          target_id: targetId,
          type: ApiMessageType.CARD,
          content: rendered.content,
          template_id: rendered.template_id,
        })
      ).msg_id;
    });
  }

  /** 更新卡片状态 */
  private update() {
    if (!this.mounted) {
      // 卡片尚未挂载，不进行渲染
      return;
    }

    this.queue.push(async () => {
      const rendered = this.render(this.state);
      await BOT.api.messageUpdate({
        msg_id: this.id,
        content: rendered.content,
        template_id: rendered.template_id,
      });
    });
  }

  /**
   * 销毁卡片
   *
   * 销毁卡片不会删除消息，因为通常是直接删除频道
   */
  async destroy() {
    await this.queue.destroy(true);
  }
}
