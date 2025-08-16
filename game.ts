import type { KookClient } from './lib/kook';
import type { GameConfig } from './types';
import { ApiChannelType, ApiMessageType, Permission, VoiceQuality } from './lib/api.ts';
import { inviteCard } from './templates/invite.ts';
import type { User } from './lib/events.ts';

export enum ChannelMode {
  Everyone = 0,
  Player,
  Storyteller,
}

export enum GameStatus {
  /** 初始化状态，期间不能进行任何操作 */
  INITIALIZING = 0,

  /** 等待说书人加入 */
  WAITING_FOR_STORYTELLER,

  /** 准备阶段 */
  PREPARING,

  /** 夜晚阶段 */
  NIGHT,

  /** 白天阶段 */
  DAY,

  /** 提名阶段 */
  NOMINATION,
}

const run = (handler: () => Promise<any>) => handler();

/** 游戏会话 */
export class Game {
  private storytellerId: string;
  private channels: string[];
  private bot: KookClient;
  private config: GameConfig;

  private roleId: number;
  private categoryId?: string;

  public townsquareChannelId?: string;
  public storytellerChannelId?: string;
  public voiceChannelId?: string;
  public invite?: string;
  public status: GameStatus;

  public name: string;

  constructor(storytellerId: string, bot: KookClient, config: GameConfig) {
    this.storytellerId = storytellerId;
    this.channels = [];
    this.bot = bot;
    this.config = config;
    this.roleId = -1;
    this.status = GameStatus.INITIALIZING;
    this.name = `小镇 ${Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0')}`;
  }

  async init() {
    await Promise.all([
      // 赋予说书人角色
      run(async () => {
        await this.bot.api.roleGrant({
          guild_id: this.config.guildId,
          user_id: this.storytellerId,
          role_id: this.config.storytellerRoleId,
        });
      }),

      // 创建游戏所需角色
      run(async () => {
        this.roleId = (
          await this.bot.api.roleCreate({
            guild_id: this.config.guildId,
            name: this.name,
          })
        ).role_id;
      }),

      // 创建频道分组
      run(async () => {
        this.categoryId = (
          await this.bot.api.channelCreate({
            guild_id: this.config.guildId,
            name: `鸦木布拉夫`,
            is_category: 1,
          })
        ).id;

        await this.bot.api.channelRoleUpdate({
          channel_id: this.categoryId,
          type: 'role_id',
          value: '0',
          deny: Permission.VIEW_CHANNELS,
        });

        // 将小镇排序置顶
        await this.bot.api.channelUpdate({ channel_id: this.categoryId, level: 0 });

        this.channels.push(this.categoryId);
      }),
    ]);

    await Promise.all([
      // 赋予说书人游戏角色
      run(async () => {
        await this.bot.api.roleGrant({
          guild_id: this.config.guildId,
          user_id: this.storytellerId,
          role_id: this.roleId,
        });
      }),

      // 赋予分组权限
      run(async () => {
        if (!this.categoryId) throw new Error('创建游戏失败: 分组ID无效');
        await this.bot.api.channelRoleUpdate({
          channel_id: this.categoryId,
          type: 'role_id',
          value: this.roleId.toString(),
          allow: Permission.VIEW_CHANNELS,
        });
      }),

      // 创建玩家频道
      run(async () => {
        this.townsquareChannelId = (
          await this.createTextChannel('🏢 城镇广场', ChannelMode.Player)
        ).id;
      }),

      // 创建说书人频道
      run(async () => {
        this.storytellerChannelId = (
          await this.createTextChannel('🏢 城镇广场 (说书人)', ChannelMode.Storyteller)
        ).id;
      }),

      // 创建语音房间频道和邀请连接
      run(async () => {
        this.voiceChannelId = (
          await this.bot.api.channelCreate({
            guild_id: this.config.guildId,
            name: `‣ ${this.name}`,
            type: ApiChannelType.VOICE,
            voice_quality: VoiceQuality.HIGH,
            limit_amount: 20,
            parent_id: this.config.roomCategoryId,
          })
        ).id;

        this.channels.push(this.voiceChannelId);

        // 创建邀请连接
        this.invite = (
          await this.bot.api.inviteCreate({ channel_id: this.voiceChannelId, duration: 86400 })
        ).url;
      }),
    ]);

    if (!this.storytellerChannelId) throw new Error('创建游戏失败: 说书人频道ID无效');
    if (!this.invite) throw new Error('创建游戏失败: 邀请连接无效');

    // 发送邀请链接到说书人频道
    await this.bot.api.messageCreate({
      target_id: this.storytellerChannelId,
      type: ApiMessageType.CARD,
      content: JSON.stringify(inviteCard(this.name, this.invite)),
    });

    this.status = GameStatus.WAITING_FOR_STORYTELLER;
    return true;
  }

  private async createTextChannel(name: string, mode: ChannelMode) {
    const channel = await this.bot.api.channelCreate({
      guild_id: this.config.guildId,
      name: name,
      type: ApiChannelType.TEXT,
      parent_id: this.categoryId,
    });

    if (mode == ChannelMode.Player) {
      // 拒绝说书人查看
      await this.bot.api.channelRoleUpdate({
        channel_id: channel.id,
        type: 'user_id',
        value: this.storytellerId,
        deny: Permission.VIEW_CHANNELS,
      });
    } else if (mode == ChannelMode.Storyteller) {
      // 拒绝玩家查看
      await Promise.all([
        this.bot.api.channelRoleUpdate({
          channel_id: channel.id,
          type: 'role_id',
          value: this.roleId.toString(),
          deny: Permission.VIEW_CHANNELS,
        }),
        this.bot.api.channelRoleUpdate({
          channel_id: channel.id,
          type: 'role_id',
          value: this.config.storytellerRoleId.toString(),
          allow: Permission.VIEW_CHANNELS,
        }),
      ]);
    }

    this.channels.push(channel.id);
    return channel;
  }

  async cleanup() {
    // 删除所有频道
    await Promise.allSettled(
      this.channels.reverse().map((channel) => this.bot.api.channelDelete(channel)),
    );

    // 删除角色
    if (this.roleId !== -1) {
      await this.bot.api.roleDelete({
        guild_id: this.config.guildId,
        role_id: this.roleId,
      });
    }

    // 取消说书人角色
    await this.bot.api.roleRevoke({
      guild_id: this.config.guildId,
      user_id: this.storytellerId,
      role_id: this.config.storytellerRoleId,
    });
  }

  private async enterPrepareState() {
    this.status = GameStatus.PREPARING;
  }

  /**
   * 玩家加入游戏
   * @param user 正在加入的玩家
   */
  private async joinGame(player: User) {}

  async joinChannel(user: User) {
    switch (this.status) {
      case GameStatus.WAITING_FOR_STORYTELLER:
        await this.joinGame(user);

        // 如果是说书人加入，更新状态
        if (user.id === this.storytellerId) {
          await this.enterPrepareState();
        }
    }
  }
}
