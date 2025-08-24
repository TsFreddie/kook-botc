import { BOT, GAME } from '../../bot';
import { ApiChannelType, Permission, VoiceQuality } from '../../lib/api';
import type { Register } from '../router';
import { SequentialQueue } from './queue';

/**
 * 动态频道管理
 */
export class DynamicChannels {
  private channels = new Map<string, string>();
  private cottages = new Map<string, string>();
  private createdChannels = new Set<string>();
  private queue: SequentialQueue = new SequentialQueue();
  private playerThrottleTimer = new Map<string, { time: number; timer: NodeJS.Timeout }>();
  private destroyed = false;
  private taskFinishTime = 0;

  private showingLocations = false;
  private showingCottages = false;

  constructor(
    private mainChannel: string,
    private storytellerId: string,
    private register: Register,
    private roleId: string,
  ) {}

  isThrottled(userId: string) {
    return this.playerThrottleTimer.has(userId);
  }

  throttle(userId: string) {
    const timer = this.playerThrottleTimer.get(userId);
    if (timer) {
      clearTimeout(timer.timer);
    }

    this.playerThrottleTimer.set(userId, {
      time: Date.now() + 1500,
      timer: setTimeout(() => {
        this.playerThrottleTimer.delete(userId);
      }, 1500),
    });
  }

  /** 等待 */
  wait() {
    return this.queue.push(() => {
      if (this.playerThrottleTimer.size > 0 || this.taskFinishTime + 1500 > Date.now()) {
        const now = Date.now();
        const waitTime = Math.max(
          ...this.playerThrottleTimer.values().map((t) => t.time - now),
          this.taskFinishTime + 1500 - now,
        );
        return new Promise((resolve) => setTimeout(resolve, waitTime));
      }
      return Promise.resolve();
    });
  }

  kickUserFromChannel(userId: string, channelId: string) {
    if (this.destroyed) return;

    this.queue.push(async () => {
      // 不是那么重要的行为，就不用因为这个报错强关了
      try {
        await BOT.api.channelKickout(channelId, userId);
      } catch (err) {
        console.error(err);
      }
      this.taskFinishTime = Date.now();
    });
  }

  /**
   * 将用户移动到指定的频道名中，如果频道不存在则创建
   *
   * 该方法限速，玩家如果被限速则不会移动
   */
  roamUserTo(name: string, userId: string) {
    if (this.destroyed) return;
    if (this.isThrottled(userId)) return;
    this.throttle(userId);

    this.queue.push(async () => {
      const channel = this.channels.get(name);

      // 如果频道已经存在则直接加入即可
      if (channel) {
        await BOT.api.channelMoveUser(channel, [userId]);
        this.taskFinishTime = Date.now();
        return;
      }

      const newChannel = await BOT.api.channelCreate({
        guild_id: GAME.guildId,
        name: name,
        type: ApiChannelType.VOICE,
        voice_quality: VoiceQuality.HIGH,
        limit_amount: 20,
        parent_id: GAME.gameCategoryId,
      });

      this.register.addChannel(newChannel.id);
      this.createdChannels.add(newChannel.id);
      this.channels.set(name, newChannel.id);

      // 配置频道权限
      try {
        // 如果目前正在显示地点，则创建时就允许角色查看
        // 即使不能查看仍然有连接权限
        await BOT.api.channelRoleUpdate({
          channel_id: newChannel.id,
          type: 'role_id',
          value: this.roleId,
          allow: (this.showingLocations ? Permission.VIEW_CHANNELS : 0) | Permission.CONNECT_VOICE,
        });
      } catch (err) {
        console.error(err);
      }

      await BOT.api.channelMoveUser(newChannel.id, [userId]);
      this.taskFinishTime = Date.now();
    });
  }

  /**
   * 将说书人移动到指定玩家的小屋中，如果玩家没有小屋则不会移动
   *
   * 该方法限速，说书人如果被限速则不会移动
   */
  roamStorytellerToCottage(userId: string) {
    if (this.destroyed) return;
    if (this.isThrottled(this.storytellerId)) return;
    this.throttle(this.storytellerId);

    const cottage = this.cottages.get(userId);
    if (!cottage) return;

    this.queue.push(async () => {
      await BOT.api.channelMoveUser(cottage, [this.storytellerId]);
      this.taskFinishTime = Date.now();
    });
  }

  /**
   * 将用户移动到城镇广场
   *
   * 该方法限速，玩家如果被限速则不会移动
   */
  roamUserToMainChannel(userId: string) {
    if (this.destroyed) return;
    if (this.isThrottled(userId)) return;
    this.throttle(userId);

    this.queue.push(async () => {
      await BOT.api.channelMoveUser(this.mainChannel, [userId]);
      this.taskFinishTime = Date.now();
    });
  }

  /**
   * 将用户移动到自己的小屋
   *
   * 该方法限速，玩家如果被限速则不会移动
   */
  roamUserToCottage(userId: string) {
    if (this.destroyed) return;
    if (this.isThrottled(userId)) return;
    this.throttle(userId);

    this.moveUserToCottage(userId);
  }

  /**
   * 将用户移动到城镇广场
   */
  moveUsersToMainChannel(users: string[]) {
    if (this.destroyed) return;

    this.queue.push(async () => {
      if (users.length > 0) await BOT.api.channelMoveUser(this.mainChannel, users);

      this.taskFinishTime = Date.now();
    });
  }

  /**
   * 将用户移动到各自的小屋
   */
  moveUsersToCottage(users: string[]) {
    if (this.destroyed) return;

    users.forEach((user) => {
      this.moveUserToCottage(user);
    });
  }

  private moveUserToCottage(userId: string) {
    if (this.destroyed) return;
    this.queue.push(async () => {
      // 如果小屋已经存在，则直接加入即可
      const cottage = this.cottages.get(userId);
      if (cottage) {
        await BOT.api.channelMoveUser(cottage, [userId]);
        this.taskFinishTime = Date.now();
        return;
      }

      // 获取用户信息
      const user = await BOT.api.userView({ user_id: userId, guild_id: GAME.guildId });
      // 创建频道
      const newChannel = await BOT.api.channelCreate({
        guild_id: GAME.guildId,
        name: `🏠 ${user.nickname} 的小屋`,
        type: ApiChannelType.VOICE,
        voice_quality: VoiceQuality.HIGH,
        limit_amount: 20,
        parent_id: GAME.cottageCategoryId,
      });
      this.register.addChannel(newChannel.id);
      this.createdChannels.add(newChannel.id);

      // 配置频道权限(仅用户自己与说书人可见)
      const permissionUpdates = [
        BOT.api.channelRoleUpdate(
          this.showingCottages
            ? {
                channel_id: newChannel.id,
                type: 'user_id',
                value: userId,
                allow: Permission.VIEW_CHANNELS | Permission.CONNECT_VOICE,
              }
            : {
                channel_id: newChannel.id,
                type: 'user_id',
                value: userId,
                deny: Permission.VIEW_CHANNELS | Permission.CONNECT_VOICE,
              },
        ),
        BOT.api.channelRoleUpdate(
          this.showingCottages
            ? {
                channel_id: newChannel.id,
                type: 'user_id',
                value: this.storytellerId,
                allow: Permission.VIEW_CHANNELS | Permission.CONNECT_VOICE,
              }
            : {
                channel_id: newChannel.id,
                type: 'user_id',
                value: this.storytellerId,
                deny: Permission.VIEW_CHANNELS | Permission.CONNECT_VOICE,
              },
        ),
      ];

      const result = await Promise.allSettled(permissionUpdates);
      result.forEach((result) => {
        if (result.status === 'rejected') {
          console.error(result.reason);
        }
      });

      await BOT.api.channelMoveUser(newChannel.id, [userId]);
      this.cottages.set(userId, newChannel.id);
      this.taskFinishTime = Date.now();
    });
  }

  /**
   * 允许角色查看所有动态频道
   */
  showLocations() {
    if (this.destroyed) return;

    this.showingLocations = true;

    this.queue.push(async () => {
      const permissionUpdates: Promise<any>[] = [];

      // 为所有动态频道添加角色权限
      this.channels.forEach((channelId) => {
        permissionUpdates.push(
          BOT.api.channelRoleUpdate({
            channel_id: channelId,
            type: 'role_id',
            value: this.roleId,
            allow: Permission.VIEW_CHANNELS,
          }),
        );
      });

      const result = await Promise.allSettled(permissionUpdates);
      result.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(result.reason);
        }
      });

      this.taskFinishTime = Date.now();
    });
  }

  /**
   * 禁止角色查看所有动态频道
   */
  hideLocations() {
    if (this.destroyed) return;

    this.showingLocations = false;

    this.queue.push(async () => {
      const permissionUpdates: Promise<any>[] = [];

      // 为所有动态频道移除角色权限
      this.channels.forEach((channelId) => {
        permissionUpdates.push(
          BOT.api.channelRoleUpdate({
            channel_id: channelId,
            type: 'role_id',
            value: this.roleId,
            deny: Permission.VIEW_CHANNELS,
          }),
        );
      });

      const result = await Promise.allSettled(permissionUpdates);
      result.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(result.reason);
        }
      });

      this.taskFinishTime = Date.now();
    });
  }

  /**
   * 允许用户查看自己的小屋
   */
  showCottages() {
    if (this.destroyed) return;

    this.showingCottages = true;

    this.queue.push(async () => {
      const permissionUpdates: Promise<any>[] = [];

      // 为所有小屋添加用户权限
      this.cottages.forEach((channelId, userId) => {
        permissionUpdates.push(
          BOT.api.channelRoleUpdate({
            channel_id: channelId,
            type: 'user_id',
            value: userId,
            allow: Permission.VIEW_CHANNELS | Permission.CONNECT_VOICE,
          }),
          BOT.api.channelRoleUpdate({
            channel_id: channelId,
            type: 'user_id',
            value: this.storytellerId,
            allow: Permission.VIEW_CHANNELS | Permission.CONNECT_VOICE,
          }),
        );
      });

      const result = await Promise.allSettled(permissionUpdates);
      result.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(result.reason);
        }
      });

      this.taskFinishTime = Date.now();
    });
  }

  /**
   * 禁止用户查看自己的小屋
   */
  hideCottages() {
    if (this.destroyed) return;

    this.showingCottages = false;

    this.queue.push(async () => {
      const permissionUpdates: Promise<any>[] = [];

      // 为所有小屋移除用户权限
      this.cottages.forEach((channelId, userId) => {
        permissionUpdates.push(
          BOT.api.channelRoleUpdate({
            channel_id: channelId,
            type: 'user_id',
            value: userId,
            deny: Permission.VIEW_CHANNELS | Permission.CONNECT_VOICE,
          }),
          BOT.api.channelRoleUpdate({
            channel_id: channelId,
            type: 'user_id',
            value: this.storytellerId,
            deny: Permission.VIEW_CHANNELS | Permission.CONNECT_VOICE,
          }),
        );
      });

      const result = await Promise.allSettled(permissionUpdates);
      result.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(result.reason);
        }
      });

      this.taskFinishTime = Date.now();
    });
  }

  /**
   * 检查频道是否是某个玩家的小屋
   * @param channelId 要检查的频道ID
   * @returns 如果是小屋，返回小屋主人的用户ID，否则返回null
   */
  getCottageOwner(channelId: string): string | null {
    for (const [ownerId, cottageChannelId] of this.cottages.entries()) {
      if (cottageChannelId === channelId) {
        return ownerId;
      }
    }
    return null;
  }

  /**
   * 检查说书人当前是否在某个玩家的小屋中
   * @param storytellerChannelId 说书人当前所在的频道ID
   * @returns 如果在小屋中，返回小屋主人的用户ID，否则返回null
   */
  getStorytellerInCottage(storytellerChannelId: string): string | null {
    return this.getCottageOwner(storytellerChannelId);
  }

  /** 如果用户离开了小镇，可以删除他的小屋 */
  destroyCottageForUser(userId: string) {
    const cottage = this.cottages.get(userId);
    if (!cottage) return;

    this.cottages.delete(userId);
    this.createdChannels.delete(cottage);
    this.register.removeChannel(cottage);

    this.queue.push(async () => {
      try {
        await BOT.api.channelDelete(cottage);
      } catch (err) {
        console.error(err);
      }
      this.taskFinishTime = Date.now();
    });
  }

  async destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    await this.queue.destroy(true);

    // 销毁所有频道
    const channels = [...this.createdChannels.values()];

    channels.forEach((channel) => {
      this.register.removeChannel(channel);
    });

    const result = await Promise.allSettled(
      channels.map((channel) => BOT.api.channelDelete(channel)),
    );

    this.cottages.clear();
    this.channels.clear();

    result.forEach((result) => {
      if (result.status == 'rejected') {
        console.error(result.reason);
      }
    });
  }
}
