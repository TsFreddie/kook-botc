import { BOT } from '../../bot';
import { ApiMessageType } from '../../lib/api';
import type { Mountable } from './card';
import { LatestQueue, SequentialQueue } from './queue';

/**
 * 用户卡片消息管理
 *
 * 不会动态更新，可以单独给玩家发送消息
 */
export class UserCard implements Mountable {
  private userQueue = new Map<string, LatestQueue>();
  private globalQueue = new SequentialQueue();
  private id: string = '';
  private mounted: boolean = false;
  private destroyed = false;

  constructor(
    /** 默认消息，会在挂载时创建 */
    private defaultMessage: { content: string; template_id?: string },
  ) {}

  /** 将卡片挂载到指定频道 */
  async $mount(targetId: string) {
    if (this.destroyed) throw new Error('卡片已销毁');
    if (this.mounted) throw new Error('卡片已挂载');
    this.mounted = true;

    this.globalQueue.push(async () => {
      this.id = (
        await BOT.api.messageCreate({
          target_id: targetId,
          type: ApiMessageType.CARD,
          content: this.defaultMessage.content,
          template_id: this.defaultMessage.template_id,
        })
      ).msg_id;
    });
  }

  private getUserQueue(user: string) {
    let queue = this.userQueue.get(user);
    if (!queue) {
      queue = new LatestQueue();
      this.userQueue.set(user, queue);
    }
    return queue;
  }

  /** 向玩家发送卡片信息 */
  update(user: string, message: { content: string; template_id?: string }) {
    if (this.destroyed) return;
    if (!this.mounted) {
      // 卡片尚未挂载，不进行渲染
      return;
    }

    this.globalQueue.push(async () => {
      const queue = this.getUserQueue(user);
      // 不 await 所以整个 queue 可以很快的处理过去
      queue.push(async () => {
        try {
          await BOT.api.messageUpdate({
            msg_id: this.id,
            content: message.content,
            template_id: message.template_id,
            temp_target_id: user,
          });
        } catch (err) {
          // 用户卡片包含用户提供的数据，有可能被用户删除，不用管报错
          console.error(err);
        }
      });
    });
  }

  /** 更新卡片来重置玩家的消息 */
  reset() {
    if (this.destroyed) return;
    if (!this.mounted) {
      // 卡片尚未挂载，不进行渲染
      return;
    }

    this.globalQueue.push(async () => {
      // 停止所有用户 queue 并等待结束
      await Promise.allSettled(
        Array.from(this.userQueue.values()).map((queue) => queue.destroy(true)),
      );
      this.userQueue.clear();

      try {
        await BOT.api.messageUpdate({
          msg_id: this.id,
          content: this.defaultMessage.content,
          template_id: this.defaultMessage.template_id,
        });
      } catch (err) {
        // 用户卡片包含用户提供的数据，有可能被用户删除，不用管报错
        console.error(err);
      }
    });
  }

  /**
   * 销毁卡片
   *
   * 销毁卡片不会删除消息，因为通常是直接删除频道
   */
  async $destroy() {
    if (this.destroyed) throw new Error('卡片已销毁');
    this.destroyed = true;

    await Promise.allSettled(
      Array.from(this.userQueue.values()).map((queue) => queue.destroy(true)),
    );
  }
}
