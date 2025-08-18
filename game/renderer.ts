import { BOT, GAME } from '../bot';
import { ApiChannelType, ApiMessageType, Permission, VoiceQuality } from '../lib/api';
import { $state } from './utils/state';
import type { Register } from './router';
import { UserRoles } from './utils/user-roles';
import { reportGlobalError } from './utils/error';

import TownControlCard from './cards/TownControlCard';
import TownHeaderCard from './cards/TownHeaderCard';
import StorytellerControlCard from './cards/StorytellerControlCard';
import TownsquareControlCard from './cards/TownsquareControlCard';
import type { GameState } from './session';
import type { CardState } from './utils/card';
import { DynamicChannels } from './utils/dynamic-channels';
import { LatestQueue, SequentialQueue } from './utils/queue';

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
  public readonly name = $state('');

  private _storytellerChannelId = '';
  private _townsquareChannelId = '';
  private _voiceChannelId = '';

  private cards: {
    storyteller: CardState<object>[];
    townsquare: CardState<object>[];
  };

  private roleId = -1;
  private rendererState = RendererState.None;

  public dynamicChannels?: DynamicChannels;

  // Public getters for accessing private properties
  get storytellerChannelId() {
    return this._storytellerChannelId;
  }
  get townsquareChannelId() {
    return this._townsquareChannelId;
  }
  get voiceChannelId() {
    return this._voiceChannelId;
  }

  private roles = new UserRoles();

  private readonly invite = $state('');
  private readonly open = $state(false);
  private readonly storytellerIdState = $state('');
  private readonly openQueue = new LatestQueue();
  private readonly messagingQueue = new SequentialQueue();

  private cleanupCallback: (() => void) | null = null;

  constructor(
    private storytellerId: string,
    private register: Register,
    private state: GameState,
  ) {
    const townName = `小镇 ${Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0')}`;
    this.name.set(townName);
    this.storytellerIdState.set(storytellerId);

    // 配置动态卡片
    this.cards = {
      storyteller: [
        TownControlCard({
          name: this.name,
          invite: this.invite,
          open: this.open,
        }),
        StorytellerControlCard({
          name: this.name,
          invite: this.invite,
          phase: this.state.phase,
          storytellerId: this.storytellerIdState,
        }),
      ],

      townsquare: [
        TownHeaderCard({
          name: this.name,
          invite: this.invite,
        }),
        TownsquareControlCard({
          invite: this.invite,
          phase: this.state.phase,
        }),
      ],
    };
  }

  /**
   * 初始化
   * 创建相关频道与初始消息
   */
  async initialize() {
    // 只允许初始化一次
    if (this.rendererState !== RendererState.None) return;
    this.rendererState = RendererState.Initializing;

    try {
      // 创建游戏所需角色
      this.roleId = (
        await BOT.api.roleCreate({
          guild_id: GAME.guildId,
          name: this.name.value,
        })
      ).role_id;

      // 创建频道
      const results = await Promise.allSettled([
        (async () => {
          this._storytellerChannelId = (
            await this.createTextChannel('🏢 城镇广场(说书人)', ChannelMode.Storyteller)
          ).id;
          this.register.addChannel(this._storytellerChannelId);

          this._townsquareChannelId = (
            await this.createTextChannel('🏢 城镇广场', ChannelMode.Player)
          ).id;
          this.register.addChannel(this._townsquareChannelId);
        })(),

        (async () => {
          this._voiceChannelId = (
            await BOT.api.channelCreate({
              guild_id: GAME.guildId,
              name: `‣ ${this.name.value}`,
              type: ApiChannelType.VOICE,
              voice_quality: VoiceQuality.HIGH,
              limit_amount: 20,
              parent_id: GAME.roomCategoryId,
            })
          ).id;
          this.register.addChannel(this._voiceChannelId);

          // 动态频道配置
          this.dynamicChannels = new DynamicChannels(
            this._voiceChannelId,
            this.storytellerId,
            this.register,
            this.roleId.toString(),
          );

          this.invite.set(
            (await BOT.api.inviteCreate({ channel_id: this._voiceChannelId, duration: 86400 })).url,
          );
        })(),
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

      // 初始化卡片
      await Promise.allSettled([
        (async () => {
          for (const card of this.cards.storyteller) {
            await card.$card.mount(this._storytellerChannelId);
          }
        })(),
        (async () => {
          for (const card of this.cards.townsquare) {
            await card.$card.mount(this._townsquareChannelId);
          }
        })(),
      ]);

      // 为说书人赋予游戏角色与说书人角色
      this.roles.grant(this.storytellerId, this.roleId);
      this.roles.grant(this.storytellerId, GAME.storytellerRoleId);

      this.rendererState = RendererState.Initialized;
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

        // 禁止说书人发言
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

  /** 为用户授予游戏角色 */
  grantUserRole(userId: string) {
    if (this.roleId == -1) return;
    this.roles.grant(userId, this.roleId);
  }

  /** 撤销用户的游戏角色 */
  revokeUserRole(userId: string) {
    if (this.roleId == -1) return;
    this.roles.revoke(userId, this.roleId);
  }

  /** 切换开放 */
  setOpen(open: boolean) {
    if (this.open.value == open) return;
    this.open.set(open);
    this.openQueue.push(async () => {
      await BOT.api.channelRoleUpdate({
        channel_id: this._voiceChannelId,
        type: 'role_id',
        value: '0',
        allow: open ? Permission.CONNECT_VOICE : 0,
      });
    });
  }

  /**
   * 向城镇广场发送消息
   */
  sendMessageToTownsquare(type: ApiMessageType, content: string) {
    this.messagingQueue.push(async () => {
      await BOT.api.messageCreate({
        target_id: this._townsquareChannelId,
        type: type,
        content: content,
      });
    });
  }

  /** 销毁渲染器，这会删除所有相关的角色与频道 */
  async destroy() {
    const state = this.rendererState;
    this.rendererState = RendererState.Destroyed;

    if (state === RendererState.None || state === RendererState.Destroyed) return;

    if (state === RendererState.Initializing) {
      await new Promise<void>((resolve) => {
        this.cleanupCallback = resolve;
      });
    }

    // 停止队列
    await this.openQueue.destroy(true);

    // 卸载邀请链接
    try {
      const url = this.invite.value.split('/');
      const code = url[url.length - 1];
      if (code) {
        await BOT.api.inviteDelete({ url_code: code, channel_id: this._voiceChannelId });
      }
    } catch (err) {
      console.error(err);
    }

    // 优先销毁所有卡片队列，不再进行更新，并且等待正在更新的消息更新完毕
    await Promise.allSettled([
      ...this.cards.storyteller.map((card) => card.$card.destroy()),
      ...this.cards.townsquare.map((card) => card.$card.destroy()),
    ]);

    // 销毁所有动态频道
    if (this.dynamicChannels) {
      await this.dynamicChannels.destroy();
    }

    // 销毁所有频道，不在乎是否失败，因为有可能是因为报错了才触发的，尽量跑就行
    const channels = [
      this._storytellerChannelId,
      this._townsquareChannelId,
      this._voiceChannelId,
    ].filter((channel) => !!channel);

    channels.forEach((channel) => {
      this.register.removeChannel(channel);
    });

    let result = await Promise.allSettled(
      channels.map((channel) => BOT.api.channelDelete(channel)),
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
