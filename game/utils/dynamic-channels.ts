import { BOT, GAME } from '../../bot';
import { ApiChannelType, Permission, VoiceQuality } from '../../lib/api';
import type { Register } from '../router';
import { SequentialQueue } from './queue';

/**
 * 动态频道管理
 */
export class DynamicChannels {
  private channels: Map<string, string> = new Map();
  private cottages: Map<string, string> = new Map();
  private queue: SequentialQueue = new SequentialQueue();
  private destroyed = false;

  constructor(
    private mainChannel: string,
    private storytellerId: string,
    private register: Register,
  ) {}

  /**
   * 将用户移动到指定的频道名中，如果频道不存在则创建
   * @param name
   * @param users
   * @returns
   */
  moveUsersTo(name: string, users: string[]) {
    if (this.destroyed) return;

    const channel = this.channels.get(name);
    if (channel) {
      this.queue.push(async () => {
        await BOT.api.channelMoveUser(channel, users);
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
      await BOT.api.channelMoveUser(newChannel.id, users);
    });
  }

  moveUsersToMainChannel(users: string[]) {
    if (this.destroyed) return;

    this.queue.push(async () => {
      await BOT.api.channelMoveUser(this.mainChannel, users);
    });
  }

  moveUserToCottage(userId: string) {
    if (this.destroyed) return;

    const cottage = this.cottages.get(userId);
    if (cottage) {
      this.queue.push(async () => {
        await BOT.api.channelMoveUser(cottage, [userId]);
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
