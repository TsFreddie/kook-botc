import type { KookClient } from './lib/kook';
import type { GameConfig } from './types';
import { ApiChannelType, ApiMessageType, Permission, VoiceQuality } from './lib/api.ts';
import { MessageQueue } from './msg-queue.ts';
import type { StorytellerTemplateParams } from './templates/storyteller.ts';
import type { TownsquareTemplateParams } from './templates/townsquare.ts';
import type { ActionButton } from './templates/types.ts';
import type { Router } from './manager.ts';
import { townCard, townHeader } from './templates/town.ts';
import { textCard } from './templates/text.ts';

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

  /** 自由活动 */
  ROAMING,
}

export enum PlayerStatus {
  ALIVE = 0,
  DEAD,
  DEAD_VOTED,
}

interface Player {
  id: string;
  slot: number;
  status: PlayerStatus;
  /** 玩家是否还在游戏中 */
  left: boolean;
}

/** 游戏会话 */
export class Game {
  private storytellerId: string;
  private channels: string[];
  private bot: KookClient;
  private config: GameConfig;

  private roleId: number;
  private categoryId?: string;

  private storytellerControl?: MessageQueue;
  private storytellerPlayerList?: MessageQueue;

  private townsquareControl?: MessageQueue;
  private townsquarePlayerList?: MessageQueue;
  private townCard?: MessageQueue;

  /** 请求计数，只有所有请求都处理完才会进行销毁 */
  private runCounter: number = 0;
  private destroyed: boolean = false;
  private cleanupCallback: (() => void) | null = null;
  private run = async <T>(handler: () => Promise<T>) => {
    // 不再处理事件，直接等待销毁
    if (this.destroyed) return;

    this.runCounter++;
    try {
      return await handler();
    } catch (err) {
      throw err;
    } finally {
      this.runCounter--;
      if (this.runCounter === 0 && this.cleanupCallback) {
        this.cleanupCallback();
        this.cleanupCallback = null;
      }
    }
  };

  private router: Router;

  /** 只记录正在游玩的玩家 */
  private players: Player[];

  /** 活跃用户 */
  private activeUsers: Set<string>;

  public townsquareChannelId?: string;
  public storytellerChannelId?: string;
  public voiceChannelId?: string;
  public invite?: string;
  public status: GameStatus;
  public isVoiceChannelOpen: boolean = false;

  public name: string;

  constructor(storytellerId: string, bot: KookClient, config: GameConfig, router: Router) {
    this.storytellerId = storytellerId;
    this.channels = [];
    this.bot = bot;
    this.config = config;
    this.router = router;
    this.roleId = -1;
    this.status = GameStatus.INITIALIZING;
    this.players = [];
    this.activeUsers = new Set();
    this.name = `小镇 ${Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0')}`;
  }

  async init() {
    await this.run(async () => {
      await Promise.all([
        // 赋予说书人角色
        (async () => {
          await this.bot.api.roleGrant({
            guild_id: this.config.guildId,
            user_id: this.storytellerId,
            role_id: this.config.storytellerRoleId,
          });
        })(),

        // 创建游戏所需角色
        (async () => {
          this.roleId = (
            await this.bot.api.roleCreate({
              guild_id: this.config.guildId,
              name: this.name,
            })
          ).role_id;
        })(),

        // 创建频道分组
        (async () => {
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
            deny: Permission.VIEW_CHANNELS | Permission.SEND_MESSAGES,
          });

          // 将小镇排序置顶
          await this.bot.api.channelUpdate({ channel_id: this.categoryId, level: 0 });

          this.channels.push(this.categoryId);
          this.router.routeChannel(this.categoryId);
        })(),
      ]);

      await Promise.all([
        // 赋予说书人游戏角色
        (async () => {
          await this.bot.api.roleGrant({
            guild_id: this.config.guildId,
            user_id: this.storytellerId,
            role_id: this.roleId,
          });
        })(),

        // 赋予分组权限
        (async () => {
          if (!this.categoryId) throw new Error('创建游戏失败: 分组ID无效');
          await this.bot.api.channelRoleUpdate({
            channel_id: this.categoryId,
            type: 'role_id',
            value: this.roleId.toString(),
            allow: Permission.VIEW_CHANNELS,
            deny: Permission.SEND_MESSAGES,
          });
        })(),

        // 创建文本频道
        (async () => {
          this.storytellerChannelId = (
            await this.createTextChannel('🏢 说书人控制台', ChannelMode.Storyteller)
          )?.id;
          this.townsquareChannelId = (
            await this.createTextChannel('🏢 城镇广场', ChannelMode.Player)
          )?.id;
        })(),

        // 创建语音房间频道和邀请连接
        (async () => {
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
          this.router.routeChannel(this.voiceChannelId);

          // 创建邀请连接
          this.invite = (
            await this.bot.api.inviteCreate({ channel_id: this.voiceChannelId, duration: 86400 })
          ).url;
        })(),
      ]);

      if (!this.storytellerChannelId) throw new Error('创建游戏失败: 说书人频道ID无效');
      if (!this.townsquareChannelId) throw new Error('创建游戏失败: 城镇广场频道ID无效');
      if (!this.invite) throw new Error('创建游戏失败: 邀请连接无效');

      // 初始化城镇广场抬头卡片
      this.townCard = new MessageQueue(
        this.bot,
        (
          await this.bot.api.messageCreate({
            target_id: this.storytellerChannelId!,
            type: ApiMessageType.CARD,
            content: JSON.stringify(townCard(this.name, this.invite!, this.isVoiceChannelOpen)),
          })
        ).msg_id,
      );

      await this.bot.api.messageCreate({
        target_id: this.townsquareChannelId!,
        type: ApiMessageType.CARD,
        content: JSON.stringify(townHeader(this.name, this.invite!)),
      });

      // 初始化说书人频道
      this.storytellerControl = new MessageQueue(
        this.bot,
        (
          await this.bot.api.messageCreate({
            target_id: this.storytellerChannelId,
            type: ApiMessageType.CARD,
            content: JSON.stringify({
              image: this.config.assets['day']!,
              status: `**(font)🌅 说书人控制台(font)[warning]**\n(font)已创建${this.name}(font)[success]，请说书人使用[邀请链接](${this.invite})加入语音\n(font)加入后请回到这个频道进行后续操作(font)[warning]`,
            } satisfies StorytellerTemplateParams),
            template_id: this.config.templates.storyteller,
          })
        ).msg_id,
      );

      // 初始化城镇广场控制台
      this.townsquareControl = new MessageQueue(
        this.bot,
        (
          await this.bot.api.messageCreate({
            target_id: this.townsquareChannelId,
            type: ApiMessageType.CARD,
            content: JSON.stringify({
              image: this.config.assets['day']!,
              status: `**(font)🌅 城镇广场(font)[warning]**\n(font)已创建${this.name}(font)[success]，请使用[邀请链接](${this.invite})加入语音`,
              invite: this.invite!,
            } satisfies TownsquareTemplateParams),
            template_id: this.config.templates.townsquare,
          })
        ).msg_id,
      );

      this.status = GameStatus.WAITING_FOR_STORYTELLER;

      if (!this.storytellerId) throw new Error('创建游戏失败: 说书人ID无效');
      this.router.routeUser(this.storytellerId);
    });

    return;
  }

  private async createTextChannel(name: string, mode: ChannelMode) {
    return await this.run(async () => {
      const channel = await this.bot.api.channelCreate({
        guild_id: this.config.guildId,
        name: name,
        type: ApiChannelType.TEXT,
        parent_id: this.categoryId,
      });

      if (mode == ChannelMode.Player) {
        // 拒绝说书人发言
        await this.bot.api.channelRoleUpdate({
          channel_id: channel.id,
          type: 'user_id',
          value: this.storytellerId,
          deny: Permission.SEND_MESSAGES,
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
            type: 'user_id',
            value: this.storytellerId,
            allow: Permission.VIEW_CHANNELS,
          }),
        ]);
      }

      this.channels.push(channel.id);
      this.router.routeChannel(channel.id);
      return channel;
    });
  }

  async cleanup() {
    if (this.destroyed) return;

    this.destroyed = true;

    const routine = async () => {
      // 注销说书人
      this.router.unrouteUser(this.storytellerId);

      // 注销频道
      for (const channel of this.channels) {
        this.router.unrouteChannel(channel);
      }

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
    };

    if (this.runCounter > 0) {
      return new Promise<void>((resolve, reject) => {
        this.cleanupCallback = () => {
          routine().then(resolve).catch(reject);
        };
      });
    } else {
      await routine();
    }
  }

  private async updateStoryTellerControl() {
    let status: string = '';
    let mode: string = '';
    let buttons: ActionButton[] = [];
    let met: string = '';
    let icon = this.status === GameStatus.NIGHT ? '🌠' : '🌅';

    switch (this.status) {
      case GameStatus.PREPARING:
        mode = `准备阶段`;
        met = ` (met)${this.storytellerId}(met)`;
        status =
          '小镇已就绪，在此发送的内容将转发给所有玩家\n(font)建议利用现在这个时机向玩家发送剧本和需要解释的规则等(font)[warning]';
        buttons = [
          { text: '⭐ 开始游戏', theme: 'info', value: '[st]gameStart' },
          { text: '踢出玩家', theme: 'info', value: '[st]listKick' },
        ];
        break;
      case GameStatus.NIGHT:
        mode = `夜晚阶段`;
        status =
          '城镇广场空无一人，镇民回到各自小屋睡觉了\n(font)使用托梦功能为镇民提供信息，亦可前往小屋与镇民语音(font)[warning]';
        buttons = [
          { text: '🌅 黎明初生', theme: 'info', value: '[st]gameDay' },
          { text: '前往小屋', theme: 'success', value: '[st]listGoto' },
        ];
        break;
      case GameStatus.DAY:
        mode = `白天阶段 - 广场集会`;
        status = '镇民聚集在广场中\n(font)使用发起投票功能可发起提名(font)[warning]';
        buttons = [
          { text: '🌄 夜幕降临', theme: 'info', value: '[st]gameNight' },
          { text: '自由活动', theme: 'primary', value: '[st]gameRoam' },
          { text: '发起投票', theme: 'warning', value: '[st]listVote' },
        ];
        break;
      case GameStatus.ROAMING:
        mode = `白天阶段 - 自由活动`;
        status =
          '现在是自由活动时间\n(font)你和镇民一样可以前往各地，同时你还可以前往玩家小屋(font)[warning]';
        buttons = [
          { text: '🌄 夜幕降临', theme: 'info', value: '[st]gameNight' },
          { text: '广场集会', theme: 'warning', value: '[st]gameDay' },
          { text: '前往小屋', theme: 'success', value: '[st]listGoto' },
        ];
        break;
    }

    this.run(async () =>
      this.storytellerControl!.update({
        content: JSON.stringify({
          image: this.config.assets[this.status === GameStatus.NIGHT ? 'night' : 'day']!,
          status: `**(font)${icon} 说书人控制台(font)[warning]** (font)${mode}(font)[secondary]${met}\n${status}`,
          groups: [
            buttons as any,
            [
              { text: '状态', theme: 'primary', value: '[st]listStatus' },
              { text: '托梦', theme: 'warning', value: '[st]listPrivate' },
              { text: '换座', theme: 'info', value: '[st]listSwap' },
              { text: '禁言', theme: 'success', value: '[st]listMute' },
            ],
          ],
        } satisfies StorytellerTemplateParams),
        template_id: this.config.templates.storyteller,
      }),
    );
  }

  private async updateTownsquareControl() {
    let status: string = '';
    let mode: string = '';
    let buttons: ActionButton[] = [];
    let icon = this.status === GameStatus.NIGHT ? '🌠' : '🌅';

    switch (this.status) {
      case GameStatus.PREPARING:
        mode = `准备阶段`;
        status = '小镇正在准备中，请耐心等待说书人开始游戏';
        buttons = [];
        break;
      case GameStatus.NIGHT:
        mode = `夜晚阶段`;
        status = '夜幕降临，镇民们回到各自的小屋休息';
        buttons = [];
        break;
      case GameStatus.DAY:
        mode = `白天阶段 - 广场集会`;
        status = '镇民们聚集在广场中进行讨论\n(font)可以自由发言和讨论(font)[info]';
        buttons = [];
        break;
      case GameStatus.ROAMING:
        mode = `白天阶段 - 自由活动`;
        status = '现在是自由活动时间\n(font)可以前往各地进行私下交流(font)[info]';
        buttons = [];
        break;
    }

    this.run(async () =>
      this.townsquareControl!.update({
        content: JSON.stringify({
          image: this.config.assets[this.status === GameStatus.NIGHT ? 'night' : 'day']!,
          status: `**(font)${icon} 城镇广场(font)[warning]** (font)${mode}(font)[secondary]\n${status}`,
          invite: this.invite!,
          groups: buttons.length > 0 ? [buttons as any] : undefined,
        } satisfies TownsquareTemplateParams),
        template_id: this.config.templates.townsquare,
      }),
    );
  }

  async gameStart() {
    await this.gameNight();
  }

  async gameDelete() {
    await this.cleanup();
  }

  async gameLeave(userId: string) {
    await this.playerLeave(userId);
  }

  async gameDay() {
    this.status = GameStatus.DAY;

    // TODO: move people into the town square
    await Promise.all([this.updateStoryTellerControl(), this.updateTownsquareControl()]);
  }

  async gameNight() {
    this.status = GameStatus.NIGHT;

    // TODO: move people into their cottages
    await Promise.all([this.updateStoryTellerControl(), this.updateTownsquareControl()]);
  }

  async gameRoam() {
    this.status = GameStatus.ROAMING;

    // TODO: notify game status changes
    await Promise.all([this.updateStoryTellerControl(), this.updateTownsquareControl()]);
  }

  async gameOpen() {
    if (!this.voiceChannelId) return;

    this.isVoiceChannelOpen = true;

    // 允许所有人查看语音频道
    this.run(() =>
      Promise.all([
        this.bot.api.channelRoleUpdate({
          channel_id: this.voiceChannelId!,
          type: 'role_id',
          value: '0',
          allow: Permission.CONNECT_VOICE,
        }),
        this.updateTownCard(),
      ]),
    );
  }

  async gameInviteOnly() {
    if (!this.voiceChannelId) return;

    this.isVoiceChannelOpen = false;

    // 拒绝所有人查看语音频道
    this.run(() =>
      Promise.all([
        this.bot.api.channelRoleUpdate({
          channel_id: this.voiceChannelId!,
          type: 'role_id',
          value: '0',
          allow: 0,
        }),
        this.updateTownCard(),
      ]),
    );
  }

  private async updateTownCard() {
    if (!this.townCard || !this.invite) return;

    await this.townCard.update({
      content: JSON.stringify(townCard(this.name, this.invite, this.isVoiceChannelOpen)),
    });
  }

  private async enterPrepareState() {
    this.status = GameStatus.PREPARING;
    await Promise.all([this.updateStoryTellerControl(), this.updateTownsquareControl()]);
  }

  private async playerJoin(user: string) {
    // 加入玩家队列
    this.players.push({
      id: user,
      slot: this.players.length,
      status: PlayerStatus.ALIVE,
      left: false,
    });

    this.router.routeUser(user);

    // 赋予玩家游戏角色
    await this.run(() =>
      this.bot.api.roleGrant({
        guild_id: this.config.guildId,
        user_id: user,
        role_id: this.roleId,
      }),
    );

    // 发送消息提醒玩家
    await this.run(() =>
      this.bot.api.messageCreate({
        target_id: this.voiceChannelId!,
        type: ApiMessageType.CARD,
        content: JSON.stringify(
          textCard(
            `(met)${user}(met) 加入了 ${this.name}。请前往 (chn)${this.townsquareChannelId}(chn) 参与游戏。`,
          ),
        ),
      }),
    );
  }

  private async playerLeave(user: string) {
    // 从游戏中移除
    this.players = this.players.filter((player) => player.id !== user);
    this.router.unrouteUser(user);

    // 移除玩家游戏角色
    await this.run(() =>
      this.bot.api.roleRevoke({
        guild_id: this.config.guildId,
        user_id: user,
        role_id: this.roleId,
      }),
    );
  }

  private async addSpectator(user: string) {
    this.activeUsers.add(user);
    this.router.routeUser(user);

    // TODO: mute user
  }

  private async removeSpectator(user: string) {
    this.activeUsers.delete(user);
    this.router.unrouteUser(user);

    // TODO: unmute user
  }

  /** 检查频道是否属于该游戏 */
  isGameChannel(channel: string) {
    return this.channels.includes(channel);
  }

  /** 已加入玩家加入游戏频道事件 */
  async joinChannel(user: string) {
    this.activeUsers.add(user);
    const player = this.players.find((player) => player.id === user);
    if (player) {
      player.left = false;
    }

    if (user === this.storytellerId) {
      await this.enterPrepareState();
    }

    console.log(this.activeUsers);
  }

  /** 已加入玩家离开游戏频道事件 */
  async leaveChannel(user: string) {
    this.activeUsers.delete(user);
    const player = this.players.find((player) => player.id === user);
    if (player) {
      player.left = true;
    }

    // 说书人不能退出自己的小镇
    if (user === this.storytellerId) return;

    if (
      this.status === GameStatus.PREPARING ||
      this.status === GameStatus.WAITING_FOR_STORYTELLER
    ) {
      // 准备阶段退出频道视为退出游戏
      await this.playerLeave(user);
    }
  }

  /**
   * 未加入游戏玩家加入游戏
   * @param user 正在加入的玩家
   */
  async joinGame(user: string) {
    // 说书人不需要加入游戏
    if (user !== this.storytellerId) {
      if (
        this.status === GameStatus.PREPARING ||
        this.status === GameStatus.WAITING_FOR_STORYTELLER
      ) {
        // 只有在准备阶段才会自动加入游戏玩家中
        await this.playerJoin(user);
      } else {
        // 其他阶段只加入到旁观者阵营（禁言)
        await this.addSpectator(user);
      }
    }
  }
}
