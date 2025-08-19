import { BOT } from '../../bot';
import { ApiMessageType } from '../../lib/api';
import { LatestQueue } from './queue';

/**
 * 用户卡片消息管理
 *
 * 不会动态更新，可以单独给玩家发送消息
 */
export abstract class UserCard {
  private userQueue = new Map<string, LatestQueue>();

  private id: string = '';
  private mounted: boolean = false;
  private destroyed = false;

  constructor(
    /** 默认消息，会在挂载时创建 */
    private defaultMessage: { content: string; template_id?: string },
  ) {}

  /** 将卡片挂载到指定频道 */
  async mount(targetId: string) {
    if (this.destroyed) throw new Error('卡片已销毁');
    if (this.mounted) throw new Error('卡片已挂载');
    this.mounted = true;

    this.id = (
      await BOT.api.messageCreate({
        target_id: targetId,
        type: ApiMessageType.CARD,
        content: this.defaultMessage.content,
        template_id: this.defaultMessage.template_id,
      })
    ).msg_id;
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
  private update(user: string, message: { content: string; template_id?: string }) {
    if (this.destroyed) return;
    if (!this.mounted) {
      // 卡片尚未挂载，不进行渲染
      return;
    }

    const queue = this.getUserQueue(user);
    queue.push(async () => {
      await BOT.api.messageUpdate({
        msg_id: this.id,
        content: message.content,
        template_id: message.template_id,
        temp_target_id: user,
      });
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

    await Promise.allSettled(
      Array.from(this.userQueue.values()).map((queue) => queue.destroy(true)),
    );
  }
}
