import { BOT, GAME } from '../../bot';
import { SequentialQueue } from './queue';

interface User {
  roles: Set<number>;
  rolesQueue: SequentialQueue;
}

/**
 * 用户角色管理
 */
export class UserRoles {
  private users: Map<string, User> = new Map();

  private tryCleanUpUser(userId: string) {
    const user = this.users.get(userId);
    if (!user) return;

    if (user.roles.size == 0 && user.rolesQueue.size() == 0) {
      // 如果用户已经没有状态了，可以直接清理掉用户
      this.users.delete(userId);
    }
  }

  private destroyed = false;

  private getOrCreateUser(userId: string) {
    let user = this.users.get(userId);
    if (!user) {
      user = {
        roles: new Set(),
        rolesQueue: new SequentialQueue(),
      };
      this.users.set(userId, user);
    }

    return user;
  }

  grant(userId: string, roleId: number) {
    if (this.destroyed) return;
    const user = this.getOrCreateUser(userId);

    if (!user.roles.has(roleId)) {
      user.roles.add(roleId);

      user.rolesQueue.push(async () => {
        await BOT.api.roleGrant({
          guild_id: GAME.guildId,
          user_id: userId,
          role_id: roleId,
        });
      });
    }
  }

  revoke(userId: string, roleId: number) {
    if (this.destroyed) return;
    const user = this.users.get(userId);
    if (!user) return;

    if (user.roles.has(roleId)) {
      user.roles.delete(roleId);

      user.rolesQueue.push(async () => {
        await BOT.api.roleRevoke({
          guild_id: GAME.guildId,
          user_id: userId,
          role_id: roleId,
        });
        this.tryCleanUpUser(userId);
      });
    }
  }

  /**
   * 销毁角色管理，会等待所有操作结束
   *
   * 不会撤回用户角色，因为未撤回的角色会被删除，没必要手动撤回
   * 注意在 destroy 前建议先手动 await revoke 全局角色
   */
  async destroy() {
    if (this.destroyed) {
      throw new Error('用户角色管理已销毁');
    }
    this.destroyed = true;

    await Promise.allSettled([
      ...Array.from(this.users.entries()).map(([userId, user]) =>
        user.rolesQueue.push(async () => {}),
      ),
    ]);

    this.users.clear();
  }
}
