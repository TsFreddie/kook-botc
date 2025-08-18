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
  private queue: SequentialQueue = new SequentialQueue();
  private playerThrottleTimer = new Map<string, NodeJS.Timeout>();
  private destroyed = false;
  private taskFinishTime = 0;

  constructor(
    private mainChannel: string,
    private storytellerId: string,
    private register: Register,
  ) {}

  isThrottled(userId: string) {
    return this.playerThrottleTimer.has(userId);
  }

  throttle(userId: string) {
    const timer = this.playerThrottleTimer.get(userId);
    if (timer) {
      clearTimeout(timer);
    }

    this.playerThrottleTimer.set(
      userId,
      setTimeout(() => {
        this.playerThrottleTimer.delete(userId);
      }, 1500),
    );
  }

  /** 动态语音系统是否正忙，如果正忙不推荐游戏进行状态转换 */
  isBusy() {
    return (
      this.queue.size() > 0 ||
      this.playerThrottleTimer.size > 0 ||
      this.taskFinishTime + 1500 > Date.now()
    );
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

    const channel = this.channels.get(name);
    if (channel) {
      this.queue.push(async () => {
        await BOT.api.channelMoveUser(channel, [userId]);
        this.taskFinishTime = Date.now();
      });
      return;
    }

    this.queue.push(async () => {
      const newChannel = await BOT.api.channelCreate({
        guild_id: GAME.guildId,
        name: name,
        type: ApiChannelType.VOICE,
        voice_quality: VoiceQuality.HIGH,
        limit_amount: 20,
        parent_id: GAME.gameCategoryId,
      });
      this.register.addChannel(newChannel.id);
      this.channels.set(name, newChannel.id);

      // 配置频道权限
      await BOT.api.channelRoleUpdate({
        channel_id: newChannel.id,
        type: 'role_id',
        value: '0',
        deny: Permission.VIEW_CHANNELS,
      });
      await BOT.api.channelMoveUser(newChannel.id, [userId]);
      this.taskFinishTime = Date.now();
    });
  }

  /**
   * 将用户移动到指定的小屋中，如果玩家没有小屋则不会移动
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
      await BOT.api.channelMoveUser(this.mainChannel, [userId]);
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
      await BOT.api.channelMoveUser(this.mainChannel, users);
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

    const cottage = this.cottages.get(userId);
    if (cottage) {
      this.queue.push(async () => {
        await BOT.api.channelMoveUser(cottage, [userId]);
        this.taskFinishTime = Date.now();
      });
      return;
    }

    this.queue.push(async () => {
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

      // 配置频道权限(仅用户自己与说书人可见)
      await BOT.api.channelRoleUpdate({
        channel_id: newChannel.id,
        type: 'user_id',
        value: userId,
        allow: Permission.VIEW_CHANNELS,
      });
      await BOT.api.channelRoleUpdate({
        channel_id: newChannel.id,
        type: 'user_id',
        value: this.storytellerId,
        allow: Permission.VIEW_CHANNELS,
      });
      await BOT.api.channelMoveUser(newChannel.id, [userId]);
      this.cottages.set(userId, newChannel.id);
      this.taskFinishTime = Date.now();
    });
  }

  async destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    await this.queue.destroy(true);

    // 销毁所有频道
    const channels = [...this.channels.values(), ...this.cottages.values()];

    channels.forEach((channel) => {
      this.register.removeChannel(channel);
    });

    const result = await Promise.allSettled(
      channels.map((channel) => BOT.api.channelDelete(channel)),
    );

    result.forEach((result) => {
      if (result.status == 'rejected') {
        console.error(result.reason);
      }
    });
  }
}
