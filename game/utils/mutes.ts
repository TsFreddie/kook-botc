import { BOT, GAME } from '../../bot';
import { LatestQueue, SequentialQueue } from './queue';

interface UserMute {
  muted: boolean;
  mutedQueue: LatestQueue;
}

/**
 * 用户禁言管理
 */
class Mutes {
  private users: Map<string, UserMute> = new Map();

  private tryCleanUpUser(userId: string) {
    const user = this.users.get(userId);
    if (!user) return;

    if (!user.muted && user.mutedQueue.size() == 0) {
      // 如果用户已经没有状态了，可以直接清理掉用户
      this.users.delete(userId);
    }
  }

  private destroyed = false;

  private getOrCreateUser(userId: string) {
    let user = this.users.get(userId);
    if (!user) {
      user = {
        muted: false,
        mutedQueue: new LatestQueue(),
      };
      this.users.set(userId, user);
    }

    return user;
  }

  /**
   * 查询用户是否被禁言
   * @param userId 用户ID
   * @returns 是否被禁言
   */
  isMuted(userId: string) {
    const user = this.users.get(userId);
    return user?.muted ?? false;
  }

  /**
   * 禁言用户
   * @param userId 用户ID
   */
  mute(userId: string) {
    if (this.destroyed) return;

    const user = this.getOrCreateUser(userId);

    if (!user.muted) {
      user.muted = true;

      user.mutedQueue.push(async () => {
        await BOT.api.guildMuteCreate(GAME.guildId, userId, 1);
      });
    }
  }

  /**
   * 解除用户禁言
   * @param userId 用户ID
   */
  unmute(userId: string) {
    if (this.destroyed) return;

    const user = this.users.get(userId);
    if (!user) return;

    if (user.muted) {
      user.muted = false;

      user.mutedQueue.push(async () => {
        await BOT.api.guildMuteDelete(GAME.guildId, userId, 1);
        this.tryCleanUpUser(userId);
      });
    }
  }

  /**
   * 销毁
   *
   * 会取消所有禁言
   */
  async destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    // 取消禁言所有用户
    await Promise.allSettled(
      Array.from(this.users.entries()).map(([id, user]) => {
        user.muted = false;
        return user.mutedQueue.push(async () => {
          await BOT.api.guildMuteDelete(GAME.guildId, id, 1);
        });
      }),
    );
    this.users.clear();
  }
}

export const MUTES = new Mutes();
