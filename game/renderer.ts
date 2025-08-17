import { BOT, GAME } from '../bot';
import { ApiChannelType, Permission, VoiceQuality } from '../lib/api';
import { $card } from './utils/card';
import { TownControlCard } from './cards/town-control';
import type { Register } from './router';
import { UserRoles } from './utils/user-roles';
import { reportGlobalError } from './utils/error';
import { TownHeaderCard } from './cards/town-header';

export enum ChannelMode {
  Everyone = 0,
  Player,
  Storyteller,
}

export enum RendererState {
  None = 0,
  Initializing,
  Initialized,
  Destroyed,
}

/**
 * 游戏"渲染"器
 * 一个会话拥有一个渲染器
 *
 * 异步管理机器人消息，将游戏状态"渲染"成机器人信息。
 * 渲染器负责频道状态管理
 */
export class Renderer {
  private storytellerChannelId = '';
  private townsquareChannelId = '';
  private voiceChannelId = '';
  private roleId = -1;
  private storytellerId;
  private name;
  private invite = '';
  private register;
  private state = RendererState.None;
  private roles = new UserRoles();

  private townControl = $card(
    new TownControlCard({
      name: '',
      invite: '',
      open: false,
    }),
  );

  private townHeader = $card(
    new TownHeaderCard({
      name: '',
      invite: '',
    }),
  );

  private cleanupCallback: (() => void) | null = null;

  constructor(storytellerId: string, register: Register) {
    this.register = register;
    this.storytellerId = storytellerId;
    this.name = `小镇 ${Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0')}`;
    this.townControl.name = this.name;
    this.townHeader.name = this.name;
  }

  /**
   * 初始化
   * 创建相关频道与初始消息
   */
  async initialize() {
    // 只允许初始化一次
    if (this.state !== RendererState.None) return;
    this.state = RendererState.Initializing;

    try {
      // 创建游戏所需角色
      this.roleId = (
        await BOT.api.roleCreate({
          guild_id: GAME.guildId,
          name: this.name,
        })
      ).role_id;

      // 为说书人赋予游戏角色与说书人角色
      this.roles.grant(this.storytellerId, this.roleId);
      this.roles.grant(this.storytellerId, GAME.storytellerRoleId);

      // 创建频道
      const results = await Promise.allSettled([
        (async () => {
          this.storytellerChannelId = (
            await this.createTextChannel('🏢 城镇广场(说书人)', ChannelMode.Storyteller)
          ).id;
          this.register.addChannel(this.storytellerChannelId);
        })(),

        (async () => {
          this.townsquareChannelId = (
            await this.createTextChannel('🏢 城镇广场', ChannelMode.Player)
          ).id;
          this.register.addChannel(this.townsquareChannelId);
        })(),

        async () => {
          this.voiceChannelId = (
            await BOT.api.channelCreate({
              guild_id: GAME.guildId,
              name: `‣ ${this.name}`,
              type: ApiChannelType.VOICE,
              voice_quality: VoiceQuality.HIGH,
              limit_amount: 20,
              parent_id: GAME.roomCategoryId,
            })
          ).id;
          this.register.addChannel(this.voiceChannelId);

          this.invite = (
            await BOT.api.inviteCreate({ channel_id: this.voiceChannelId, duration: 86400 })
          ).url;

          this.townControl.invite = this.invite;
        },
      ]);

      // 失败处理
      if (results.some((result) => result.status == 'rejected')) {
        // log every error
        results.forEach((result) => {
          if (result.status == 'rejected') {
            console.error(result.reason);
          }
        });
        throw new Error('创建游戏失败: 创建频道失败');
      }

      // 初始化城镇广场抬头卡片
      this.townControl.$card.mount(this.storytellerChannelId);
      this;

      this.state = RendererState.Initialized;
    } catch (err) {
      console.error(err);
      // 报告全局错误，触发机器人关闭
      reportGlobalError(err, '渲染器初始化');
    } finally {
      if (this.cleanupCallback) {
        this.cleanupCallback();
      }
    }
  }

  private async createTextChannel(name: string, mode: ChannelMode) {
    const channel = await BOT.api.channelCreate({
      guild_id: GAME.guildId,
      name: name,
      type: ApiChannelType.TEXT,
      parent_id: GAME.gameCategoryId,
    });

    if (mode == ChannelMode.Player) {
      const result = await Promise.allSettled([
        // 允许玩家查看
        BOT.api.channelRoleUpdate({
          channel_id: channel.id,
          type: 'role_id',
          value: this.roleId.toString(),
          allow: Permission.VIEW_CHANNELS,
        }),
        // 禁止说书人查看
        BOT.api.channelRoleUpdate({
          channel_id: channel.id,
          type: 'user_id',
          value: this.storytellerId,
          deny: Permission.VIEW_CHANNELS,
        }),
      ]);

      result.forEach((result) => {
        if (result.status == 'rejected') {
          console.error(result.reason);
        }
      });
    } else if (mode == ChannelMode.Storyteller) {
      // 仅允许说书人查看与发消息
      await BOT.api.channelRoleUpdate({
        channel_id: channel.id,
        type: 'user_id',
        value: this.storytellerId,
        allow: Permission.VIEW_CHANNELS | Permission.SEND_MESSAGES,
      });
    }
    return channel;
  }

  /** 销毁渲染器，这会删除所有相关的角色与频道 */
  async destroy() {
    const state = this.state;
    this.state = RendererState.Destroyed;

    if (state === RendererState.None || state === RendererState.Destroyed) return;

    if (state === RendererState.Initializing) {
      await new Promise<void>((resolve) => {
        this.cleanupCallback = resolve;
      });
    }

    // 优先销毁所有卡片队列，不再进行更新，并且等待正在更新的消息更新完毕
    await this.townControl.$card.destroy();

    // 销毁所有频道，不在乎是否失败，因为有可能是因为报错了才触发的，尽量跑就行
    const channels = [this.storytellerChannelId, this.townsquareChannelId, this.voiceChannelId];
    let result = await Promise.allSettled(
      channels.filter((channel) => !!channel).map((channel) => BOT.api.channelDelete(channel)),
    );
    result.forEach((result) => {
      if (result.status == 'rejected') {
        console.error(result.reason);
      }
    });

    // 撤销说书人的角色
    this.roles.revoke(this.storytellerId, GAME.storytellerRoleId);
    await this.roles.destroy();

    // 删除生成的角色
    try {
      await BOT.api.roleDelete({
        guild_id: GAME.guildId,
        role_id: this.roleId,
      });
    } catch (err) {
      console.error(err);
    }
  }
}
