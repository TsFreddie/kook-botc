import type { Register } from './router';
import { Renderer } from './renderer';
import { $array, $state, CValue, type CArray } from './utils/state';
import { CIRCLED_NUMBERS, ROAMING_LOCATIONS } from './consts';
import { ApiMessageType } from '../lib/api';
import { textCard } from '../templates/text';
import { MUTES } from './utils/mutes';
import {
  globalMessagingCard,
  privateMessagingCard,
  townSquarePrivateCardHeader,
} from '../templates/messaging';
import { MessageType, type TextMessageEvent } from '../lib/events';
import { imageModule, markdownModule, textModule } from '../templates/modules';
import { BOT } from '../bot';
import { VoteManager } from './vote';

/**
 * Deep comparison utility for arrays and objects
 */
const deepEqual = (a: any, b: any) => {
  if (a === b) return true;

  if (a == null || b == null) return a === b;

  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
};

export enum Phase {
  /** 初始化状态，期间不能进行任何操作 */
  INITIALIZING = 0,

  /** 等待说书人加入 */
  WAITING_FOR_STORYTELLER,

  /** 准备阶段 */
  PREPARING,

  /** 准备阶段（好人胜利） */
  FINISH_GOOD,

  /** 准备阶段（坏人胜利） */
  FINISH_BAD,

  /** 夜晚阶段 */
  NIGHT,

  /** 白天阶段 */
  DAY,

  /** 自由活动 */
  ROAMING,
}

export enum PlayerStatus {
  /** 存活 */
  ALIVE = 0,
  /** 死亡投票权 */
  DEAD,
  /** 死亡无投票权 */
  DEAD_VOTED,
}

export enum ListMode {
  /** 状态 */
  STATUS = 0,
  /** 换座 */
  SWAP,
  /** 旁观 */
  SPECTATE,
  /** 禁言 */
  MUTE,
  /** 踢出 */
  KICK,
  /** 上麦 */
  SPOTLIGHT,
  /** 托梦 */
  PRIVATE,
  /** 提名 */
  NOMINATE,
  /** 小屋 */
  COTTAGE,
  /** 正在投票 */
  VOTING,
}

export interface ListPlayerItem {
  type: 'player' | 'spectator' | 'storyteller';
  id: string;
  info: string;
  joined: boolean;
}

/** 游戏状态 */
export interface GameState {
  /** 当前阶段 */
  phase: CValue<Phase>;

  /** （说书人）列表模式 */
  listMode: CValue<ListMode>;

  /** （城镇广场）是否为投票模式 */
  voting: CValue<boolean>;

  /** 玩家列表 */
  list: CValue<ListPlayerItem[]>;

  /** 列表选择状态 */
  listSelected: CArray<string>;

  /** 列表参数 见 StorytellerListCard */
  listArg: CValue<number>;

  /** 投票信息 */
  voteInfo: CValue<string>;

  /** 投票倒计时 */
  votingStart: CValue<number>;
  votingEnd: CValue<number>;

  /** 城镇广场人数 */
  townsquareCount: CValue<number>;

  /** （说书人）托梦卡片数据 */
  storytellerCardHeader: CValue<any>;
  storytellerCardTheme: CValue<'warning' | 'secondary'>;
  storytellerCards: CArray<any>;

  /** （城镇广场）信息卡片数据 */
  townsquareCards: CArray<any>;
}

export enum PlayerVoteStatus {
  /** 未计入 */
  NONE = 0,
  /** 正记入 */
  COUNTING,
  /** 已计入 */
  COUNTED,
}

/** 玩家状态 */
export interface PlayerState {
  id: string;
  status: PlayerStatus;

  /** 投票状态 */
  vote: {
    /** 票数 */
    count: number;
    status: PlayerVoteStatus;
  };
}

/**
 * 游戏会话
 */
export class Session {
  private readonly state: GameState = {
    phase: $state<Phase>(Phase.INITIALIZING),
    listMode: $state(ListMode.STATUS),
    voting: $state(false),
    list: $state([]),
    listSelected: $array([]),
    voteInfo: $state(''),
    votingStart: $state(0),
    votingEnd: $state(0),
    townsquareCount: $state(0),
    listArg: $state(0),
    storytellerCardHeader: $state(globalMessagingCard),
    storytellerCardTheme: $state('secondary'),
    storytellerCards: $array([]),
    townsquareCards: $array([]),
  };

  private readonly players: PlayerState[] = [];
  private register: Register;
  private destroyed = false;
  private greeted = new Set<string>();
  private userInfoCards = new Map<string, { seq: number; card: any[] }>();

  /** 投票管理 */
  private readonly vote = new VoteManager(this.players, this.state, () => this.updatePlayerList());

  /** 是否允许旁观者在游戏过程中发言 */
  private spectatorVoice = false;

  /** 列表的选择 */
  private listSelection = new Set<string>();

  /** 禁言集合 */
  private muteSet = new Set<string>();

  public readonly storytellerId: string;
  public readonly renderer: Renderer;

  constructor(storytellerId: string, register: Register) {
    this.storytellerId = storytellerId;
    this.renderer = new Renderer(storytellerId, register, this.state);
    this.register = register;

    // 初始化完成后进入等待说书人状态
    this.updateMessagingCard();
    this.state.phase.set(Phase.WAITING_FOR_STORYTELLER);

    // 给说书人 180 秒时间加入会话，不加入的话会自动销毁
    this.setUserInactivityTimer(this.storytellerId);
    this.updatePlayerList();
  }

  /**
   * 目前在语音频道活跃的玩家
   *
   * 玩家 -> 频道
   */
  private activeUsers = new Map<string, string>();

  /**
   * 目前在城镇广场语音频道的玩家
   */
  private townsquareUsers = new Set<string>();

  /**
   * 用户不活跃移除定时器
   * 用户ID -> 定时器
   */
  private userInactivityTimers = new Map<string, NodeJS.Timeout>();

  /**
   * 会话空闲销毁定时器
   */
  private sessionIdleTimer?: NodeJS.Timeout;

  /**
   * 当前是否为指定状态
   * @param phases 查询的状态
   * @returns true 如果为任意一个指定状态
   */
  private phase(...phases: Phase[]) {
    for (const phase of phases) {
      if (this.state.phase.value == phase) return true;
    }
    return false;
  }

  /**
   * 清除用户的不活跃定时器
   */
  private clearUserInactivityTimer(userId: string) {
    const timer = this.userInactivityTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.userInactivityTimers.delete(userId);
    }
  }

  /**
   * 设置用户不活跃定时器（180秒后移除用户）
   */
  private setUserInactivityTimer(userId: string) {
    // 清除现有定时器
    this.clearUserInactivityTimer(userId);

    const timer = setTimeout(() => {
      if (this.destroyed) return;
      if (userId === this.storytellerId) {
        // 说书人不活跃则销毁整个会话
        this.register.destroy();
      } else {
        // 普通用户不活跃则踢出游戏
        this.register.kick(userId);
      }
      this.userInactivityTimers.delete(userId);
    }, 180000); // 180 seconds

    this.userInactivityTimers.set(userId, timer);
  }

  /**
   * 清除会话空闲定时器
   */
  private clearSessionIdleTimer() {
    if (this.sessionIdleTimer) {
      clearTimeout(this.sessionIdleTimer);
      this.sessionIdleTimer = undefined;
    }
  }

  /**
   * 设置会话空闲定时器（10秒后销毁会话）
   */
  private setSessionIdleTimer() {
    // 清除现有定时器
    this.clearSessionIdleTimer();

    this.sessionIdleTimer = setTimeout(() => {
      if (this.destroyed) return;

      // 如果会话仍然没有活跃用户，销毁会话

      this.register.destroy();
      this.sessionIdleTimer = undefined;
    }, 10000); // 10 seconds
  }

  /**
   * 将玩家移除玩家列表
   * 若玩家不存在会 throw
   * 调用前注意维护状态
   */
  private internalRemovePlayer(user: string) {
    const index = this.players.findIndex((p) => p.id === user);
    if (index === -1) {
      throw new Error('玩家未加入游戏');
    }

    this.players.splice(index, 1);
    this.updatePlayerList();
  }

  /**
   * 添加玩家到玩家列表
   * 新添加的玩家会成为存活玩家
   * 若玩家已存在会 throw
   * 调用前注意维护状态
   */
  private internalAddPlayer(user: string) {
    if (this.players.find((p) => p.id === user)) {
      throw new Error('玩家已加入游戏');
    }

    this.players.push({
      id: user,
      status: PlayerStatus.ALIVE,
      vote: {
        count: 0,
        status: PlayerVoteStatus.NONE,
      },
    });
    this.updatePlayerList();
  }

  /**
   * 判断玩家是否已加入
   * @param user
   * @returns
   */
  private internalHasPlayer(user: string) {
    return this.players.find((p) => p.id === user) !== undefined;
  }

  private internalPlayerToCottage() {
    // 移动所有玩家到小木屋
    const dynamicChannels = this.renderer.dynamicChannels;
    if (!dynamicChannels) return;

    const players = this.players.map((p) => p.id);
    dynamicChannels.moveUsersToCottage(players);
  }

  private internalPlayerToTownsquare(forceAll: boolean = false) {
    // 移动所有玩家到广场
    const dynamicChannels = this.renderer.dynamicChannels;
    if (!dynamicChannels) return;

    const players = new Set(this.players.map((p) => p.id));

    // 说书人也应该回到广场
    players.add(this.storytellerId);

    // 也将所有在语音频道的玩家都拉回广场
    for (const userId of this.activeUsers.keys()) {
      players.add(userId);
    }

    // 如果不是强制拉回，则仅拉会已知不在广场的玩家
    if (!forceAll) {
      for (const userId of this.townsquareUsers) {
        players.delete(userId);
      }
    }

    dynamicChannels.moveUsersToMainChannel([...players.values()]);
  }

  /**
   * 更新禁言状态
   */
  private updateMuteState() {
    // 对于在禁言集合中的用户，如果他们在活跃用户列表中，则禁言
    // 对于不在禁言集合中的用户，如果他们在活跃用户列表中，则解除禁言
    // 特殊情况：旁观者在非准备阶段也会被禁言
    for (const userId of this.activeUsers.keys()) {
      const shouldMute = this.shouldUserBeMuted(userId);

      if (shouldMute) {
        MUTES.mute(userId);
      } else {
        MUTES.unmute(userId);
      }
    }
  }

  /**
   * 判断用户是否应该被禁言
   */
  private shouldUserBeMuted(userId: string): boolean {
    // 说书人永远不会被禁言
    if (userId === this.storytellerId) return false;

    // 如果目前为上麦模式
    if (this.state.listMode.value === ListMode.SPOTLIGHT) {
      // 只有上麦用户可以发言，这种情况下，即使是被禁言的玩家，此时也可发言
      return !this.listSelection.has(userId);
    }

    // 如果用户在禁言集合中，则应该被禁言
    if (this.muteSet.has(userId)) return true;

    // 如果禁止旁观者发言，且旁观者不在准备阶段，则应该被禁言
    const isSpectator = !this.internalHasPlayer(userId) && userId !== this.storytellerId;
    if (!this.spectatorVoice && isSpectator && !this.isPreparing()) return true;

    return false;
  }

  /**
   * 更新托梦卡片
   */
  private updateMessagingCard() {
    let privateTarget: string | undefined;
    if (this.state.listMode.value === ListMode.PRIVATE) {
      // 托梦中，查找正在托梦的用户
      privateTarget = this.listSelection.values().next().value;
    }

    if (privateTarget) {
      // 托梦中，显示托梦信息
      this.state.storytellerCardHeader.set(privateMessagingCard(privateTarget));
      this.state.storytellerCards.length = 0;
      this.state.storytellerCards.push(...(this.userInfoCards.get(privateTarget)?.card ?? []));
      this.state.storytellerCardTheme.set('warning');
    } else {
      // 非托梦中，显示公共信息
      this.state.storytellerCardHeader.set(globalMessagingCard);
      this.state.storytellerCards.length = 0;
      this.state.storytellerCards.push(...this.state.townsquareCards);
      this.state.storytellerCardTheme.set('secondary');
    }
  }

  /**
   * 更新玩家列表数据
   */
  private updatePlayerList() {
    // 玩家顺序：按槽位游戏玩家 -> 说书人 -> 旁观玩家
    const joinedPlayers = new Set(this.register.getJoinedPlayers());

    const SEP = '　';
    const mute = (userId: string) => {
      const canSpeak = this.activeUsers.has(userId) && !this.shouldUserBeMuted(userId);
      return canSpeak ? '🎙' : '🚫';
    };
    const slot = (userId: string, text: string, color: string) => {
      return `(font)${text}(font)[${this.townsquareUsers.has(userId) ? color : 'tips'}]`;
    };
    const status = (player: PlayerState) => {
      switch (player.status) {
        case PlayerStatus.ALIVE:
          return `　${SEP}　`;
        case PlayerStatus.DEAD:
          if (
            this.vote.isNomination() &&
            player.vote.status === PlayerVoteStatus.COUNTED &&
            player.vote.count > 0
          ) {
            // 提示该玩家投票权会被使用
            return `(font)亡(font)[danger]${SEP}(font)票(font)[tips]`;
          } else {
            return `(font)亡(font)[danger]${SEP}(font)票(font)[success]`;
          }
        case PlayerStatus.DEAD_VOTED:
          return `(font)亡(font)[danger]${SEP}　`;
      }
    };
    const vote = (vote: { count: number; status: PlayerVoteStatus }) => {
      if (!this.state.voting.value) return null;
      if (vote.status === PlayerVoteStatus.COUNTING) {
        return `➡️ ${vote.count === 0 ? '⬛' : vote.count === 1 ? '✅' : '2️⃣'}`;
      } else if (vote.status === PlayerVoteStatus.COUNTED) {
        return `🔒 ${vote.count === 0 ? '❌' : vote.count === 1 ? '✅' : '2️⃣'}`;
      } else {
        return `🔹 ${vote.count === 0 ? '⬛' : vote.count === 1 ? '✅' : '2️⃣'}`;
      }
    };

    const players: typeof this.state.list.value = [...this.players].map((p, index) => {
      const infoColumns = [
        mute(p.id),
        slot(p.id, CIRCLED_NUMBERS[index + 1] || '⓪', 'success'),
        status(p),
        vote(p.vote),
        `(met)${p.id}(met)`,
      ];

      return {
        type: 'player',
        id: p.id,
        joined: joinedPlayers.has(p.id),
        info: infoColumns.filter((item) => item !== null).join(SEP),
      };
    });

    const storytellerInfoColumns = [
      slot(this.storytellerId, '说书人', 'warning'),
      `(met)${this.storytellerId}(met)`,
    ];

    players.push({
      type: 'storyteller',
      id: this.storytellerId,
      joined: joinedPlayers.has(this.storytellerId),
      info: storytellerInfoColumns.join(SEP),
    });

    // 添加旁观玩家（有会话权限但不在游戏中的用户）
    const playerIds = new Set(this.players.map((p) => p.id));
    const spectators: string[] = [];
    for (const userId of joinedPlayers) {
      if (userId !== this.storytellerId && !playerIds.has(userId)) {
        spectators.push(userId);
      }
    }

    // 按用户ID排序旁观者
    spectators.sort().forEach((userId) => {
      // Build spectator info using array for consistency
      const spectatorInfoColumns = [
        slot(this.storytellerId, '旁观者', 'purple'),
        `(met)${userId}(met)`,
      ];

      players.push({
        type: 'spectator',
        id: userId,
        joined: true,
        info: spectatorInfoColumns.join(SEP),
      });
    });

    // 更新城镇广场人数
    this.state.townsquareCount.set(this.townsquareUsers.size);

    // 只有在玩家列表实际发生变化时才更新
    if (!deepEqual(this.state.list.value, players)) {
      this.state.list.set(players);
    }

    // 更新选择状态
    if (this.state.listMode.value === ListMode.VOTING) {
      this.state.listSelected.length = 0;
      // 投票状态时选择列表为玩家是否已锁定
      this.state.listSelected.push(
        ...this.players.filter((p) => p.vote.status === PlayerVoteStatus.COUNTED).map((p) => p.id),
      );
    } else if (this.state.listMode.value === ListMode.COTTAGE) {
      this.state.listSelected.length = 0;
      // 小屋模式时检查说书人当前是否在某个玩家的小屋中
      const dynamicChannels = this.renderer.dynamicChannels;
      if (dynamicChannels) {
        const storytellerChannelId = this.activeUsers.get(this.storytellerId);
        if (storytellerChannelId) {
          const cottageOwnerId = dynamicChannels.getStorytellerInCottage(storytellerChannelId);
          if (cottageOwnerId) {
            this.state.listSelected.push(cottageOwnerId);
          }
        }
      }
    } else {
      this.state.listSelected.length = 0;
      this.state.listSelected.push(...Array.from(this.listSelection));
    }
  }

  protected storytellerGameStart() {
    if (!this.phase(Phase.PREPARING, Phase.FINISH_GOOD, Phase.FINISH_BAD)) return;

    // 进入夜晚阶段
    this.state.phase.set(Phase.NIGHT);
    this.internalPlayerToCottage();
    this.renderer.dynamicChannels?.hideLocations();
    this.renderer.dynamicChannels?.showCottages();
    this.updateMuteState();
    this.updatePlayerList();

    // 自动切换到小屋模式
    this.storytellerListCottage();
  }

  protected storytellerGameDay() {
    if (!this.phase(Phase.NIGHT, Phase.ROAMING)) return;
    if (this.renderer.dynamicChannels?.isBusy()) return;

    // 如果当前是小屋模式，切换回状态模式
    if (this.state.listMode.value === ListMode.COTTAGE) {
      this.storytellerListStatus();
    }

    this.state.phase.set(Phase.DAY);
    this.internalPlayerToTownsquare();
    this.renderer.dynamicChannels?.hideLocations();
    this.renderer.dynamicChannels?.hideCottages();
    this.updateMuteState();
    this.updatePlayerList();
  }

  protected storytellerGameRoaming() {
    if (!this.phase(Phase.DAY)) return;
    if (this.renderer.dynamicChannels?.isBusy()) return;

    this.state.phase.set(Phase.ROAMING);
    this.renderer.dynamicChannels?.showLocations();
    this.renderer.dynamicChannels?.showCottages();
    this.updateMuteState();
    this.updatePlayerList();
  }

  protected storytellerGameNight() {
    if (!this.phase(Phase.DAY, Phase.ROAMING)) return;
    if (this.renderer.dynamicChannels?.isBusy()) return;

    this.state.phase.set(Phase.NIGHT);
    this.internalPlayerToCottage();
    this.renderer.dynamicChannels?.hideLocations();
    this.renderer.dynamicChannels?.showCottages();
    this.updateMuteState();
    this.updatePlayerList();

    // 自动切换到小屋模式
    this.storytellerListCottage();
  }

  protected storytellerGameRestart(winner?: 'good' | 'bad') {
    // 初始化过程中不可重置游戏状态
    if (this.phase(Phase.WAITING_FOR_STORYTELLER, Phase.INITIALIZING)) return;
    if (this.renderer.dynamicChannels?.isBusy()) return;

    // 如果重新开始时玩家没有游玩权限，则直接移除
    for (let i = this.players.length - 1; i >= 0; i--) {
      const player = this.players[i]!;
      if (!this.register.isUserJoined(player.id)) {
        this.players.splice(i, 1);
      }
    }

    // 重置玩家状态
    this.players.forEach((p) => {
      p.status = PlayerStatus.ALIVE;
    });

    // 强制将所有玩家拉回广场语音
    this.internalPlayerToTownsquare();

    this.renderer.dynamicChannels?.hideLocations();
    this.renderer.dynamicChannels?.hideCottages();

    switch (winner) {
      case 'good':
        this.state.phase.set(Phase.FINISH_GOOD);
        break;
      case 'bad':
        this.state.phase.set(Phase.FINISH_BAD);
        break;
      default:
        this.state.phase.set(Phase.PREPARING);
        break;
    }

    this.updateMuteState();
    this.updatePlayerList();

    // 还原列表
    this.storytellerListStatus();

    // 清除所有玩家卡片
    for (const userId of this.userInfoCards.keys()) {
      this.userInfoCards.delete(userId);
    }
    this.renderer.userCard.reset();
  }

  protected storytellerForceVoiceChannel() {
    if (this.renderer.dynamicChannels?.isBusy()) return;

    if (this.phase(Phase.NIGHT)) {
      this.internalPlayerToCottage();
    } else {
      this.internalPlayerToTownsquare(true);
    }
  }

  protected storytellerGameOpen() {
    this.renderer.setOpen(true);
  }

  protected storytellerGameInviteOnly() {
    this.renderer.setOpen(false);
  }

  protected storytellerGameDelete() {
    if (this.destroyed) return;

    this.register.destroy();
  }

  protected storytellerListStatus() {
    const previousListMode = this.state.listMode.value;

    this.listSelection = new Set();
    this.state.listArg.set(0);
    this.state.listMode.set(ListMode.STATUS);

    // 从上麦状态退出时需要更新禁言状态
    if (previousListMode === ListMode.SPOTLIGHT) {
      this.updateMuteState();
      this.updatePlayerList();
      return;
    }

    // 从托梦状态退出时需要更新托梦卡片
    if (previousListMode === ListMode.PRIVATE) {
      this.updateMessagingCard();
    }

    // 从投票中退出时
    if (previousListMode === ListMode.VOTING) {
      this.vote.exit();
      // exit 中会更新，不用更新两次
      return;
    }

    this.updatePlayerList();
  }

  protected storytellerListSwap() {
    this.listSelection = new Set();
    this.state.listArg.set(0);
    this.state.listMode.set(ListMode.SWAP);
    this.updatePlayerList();
  }

  protected storytellerListSpectate() {
    this.listSelection = new Set();
    this.state.listArg.set(this.spectatorVoice ? 1 : 0);
    this.state.listMode.set(ListMode.SPECTATE);
    this.updatePlayerList();
  }

  protected storytellerToggleSpectatorMute() {
    if (this.state.listMode.value !== ListMode.SPECTATE) return;

    this.spectatorVoice = !this.spectatorVoice;
    this.state.listArg.set(this.spectatorVoice ? 1 : 0);
    this.updateMuteState();
    this.updatePlayerList();
  }

  protected storytellerListKick() {
    this.listSelection = new Set();
    this.state.listArg.set(0);
    this.state.listMode.set(ListMode.KICK);
    this.updatePlayerList();
  }

  protected storytellerListMute() {
    this.listSelection = this.muteSet;
    this.state.listArg.set(0);
    this.state.listMode.set(ListMode.MUTE);
    this.updateMuteState();
    this.updatePlayerList();
  }

  protected storytellerListSpotlight() {
    this.listSelection = new Set();
    this.state.listArg.set(0);
    this.state.listMode.set(ListMode.SPOTLIGHT);
    this.updateMuteState();
    this.updatePlayerList();
  }

  protected storytellerListPrivate() {
    this.listSelection = new Set();
    this.state.listArg.set(0);
    this.state.listMode.set(ListMode.PRIVATE);
    this.updatePlayerList();

    // 进入托梦状态时需要更新托梦卡片
    this.updateMessagingCard();
  }

  protected storytellerListNominate() {
    this.listSelection = new Set();
    this.state.listArg.set(3); // 默认每人3秒
    this.vote.voteTime = 3;
    this.state.listMode.set(ListMode.NOMINATE);
    this.updatePlayerList();
  }

  protected storytellerListCottage() {
    // 小屋模式只在自由活动阶段可用
    if (!this.phase(Phase.ROAMING, Phase.NIGHT)) return;

    this.listSelection = new Set();
    this.state.listArg.set(0);
    this.state.listMode.set(ListMode.COTTAGE);
    this.updatePlayerList();
  }

  protected storytellerSelectStatus(userId: string) {
    if (this.state.listMode.value !== ListMode.STATUS) return;

    const player = this.players.find((p) => p.id === userId);
    if (!player) return;

    switch (player.status) {
      case PlayerStatus.ALIVE:
        player.status = PlayerStatus.DEAD;
        break;
      case PlayerStatus.DEAD:
        player.status = PlayerStatus.DEAD_VOTED;
        break;
      case PlayerStatus.DEAD_VOTED:
        player.status = PlayerStatus.ALIVE;
        break;
    }

    this.updatePlayerList();
  }

  protected storytellerSelectSwap(userId: string) {
    if (this.state.listMode.value !== ListMode.SWAP) return;

    if (!this.internalHasPlayer(userId)) return;

    if (this.listSelection.has(userId)) {
      this.listSelection.delete(userId);
    } else {
      this.listSelection.add(userId);
    }

    if (this.listSelection.size === 2) {
      const selectedPlayers = Array.from(this.listSelection);
      const player1Index = this.players.findIndex((p) => p.id === selectedPlayers[0]);
      const player2Index = this.players.findIndex((p) => p.id === selectedPlayers[1]);

      if (player1Index !== -1 && player2Index !== -1) {
        [this.players[player1Index], this.players[player2Index]] = [
          this.players[player2Index]!,
          this.players[player1Index]!,
        ];
      }

      this.listSelection.clear();
    }

    this.updatePlayerList();
  }

  protected storytellerShufflePlayers() {
    if (this.state.listMode.value !== ListMode.SWAP) return;

    // Fisher-Yates shuffle algorithm
    for (let i = this.players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.players[i], this.players[j]] = [this.players[j]!, this.players[i]!];
    }

    // Clear any current selection
    this.listSelection.clear();
    this.updatePlayerList();
  }

  protected storytellerSelectSpectate(userId: string) {
    if (this.state.listMode.value !== ListMode.SPECTATE) return;

    if (userId === this.storytellerId) return;

    if (this.internalHasPlayer(userId)) {
      this.internalRemovePlayer(userId);
    } else if (this.townsquareUsers.has(userId)) {
      this.internalAddPlayer(userId);
    }

    // 更改旁观状态后刷新禁言状态
    this.updateMuteState();
    this.updatePlayerList();
  }

  protected storytellerSelectKick(userId: string) {
    if (this.state.listMode.value !== ListMode.KICK) return;

    // 不可以踢出说书人
    if (userId === this.storytellerId) return;

    this.register.kick(userId);
  }

  protected storytellerSelectMute(userId: string) {
    if (this.state.listMode.value !== ListMode.MUTE) return;

    // 不可以禁言说书人
    if (userId === this.storytellerId) return;

    if (this.muteSet.has(userId)) {
      this.muteSet.delete(userId);
    } else {
      this.muteSet.add(userId);
    }

    this.updateMuteState();
    this.updatePlayerList();
  }

  protected storytellerSelectSpotlight(userId: string) {
    if (this.state.listMode.value !== ListMode.SPOTLIGHT) return;

    // 说书人始终可以说话，所以说书人不能上麦
    if (userId === this.storytellerId) return;

    if (this.listSelection.has(userId)) {
      this.listSelection.delete(userId);
    } else {
      this.listSelection.add(userId);
    }

    this.updateMuteState();
    this.updatePlayerList();
  }

  protected storytellerSelectPrivate(userId: string) {
    if (this.state.listMode.value !== ListMode.PRIVATE) return;

    // 说书人不能托梦给自己
    if (userId === this.storytellerId) return;

    if (this.listSelection.has(userId)) {
      this.listSelection.delete(userId);
    } else {
      this.listSelection.clear(); // 托梦只能选择一个玩家
      this.listSelection.add(userId);
    }

    this.updatePlayerList();

    // 更新托梦卡片
    this.updateMessagingCard();
  }

  protected storytellerSelectNominate(userId: string) {
    if (this.state.listMode.value !== ListMode.NOMINATE) return;

    // 只有玩家可以被提名
    if (!this.internalHasPlayer(userId)) return;

    // 无选择，选中
    if (this.listSelection.size == 0) {
      this.listSelection.add(userId);
      this.updatePlayerList();
      return;
    }

    // 可以投自己，所以不需要判断是否已选中，可以直接开启投票
    const nominator = this.listSelection.values().next().value;
    if (!nominator) return;

    // 切换到投票模式
    this.listSelection = new Set();
    this.state.listMode.set(ListMode.VOTING);
    this.state.listArg.set(1);

    this.vote.enterNomination(nominator, userId);
    this.updatePlayerList();
    return;
  }

  /**
   * 进入普通投票模式
   */
  protected storytellerNormalVote() {
    if (this.state.listMode.value === ListMode.VOTING) return;

    this.listSelection = new Set();
    this.state.listMode.set(ListMode.VOTING);
    this.state.listArg.set(0);

    this.vote.enterNormal();
    this.updatePlayerList();
  }

  /**
   * 说书人可以更改玩家投票
   */
  protected storytellerSelectCottage(userId: string) {
    if (this.state.listMode.value !== ListMode.COTTAGE) return;

    // 只有玩家有小屋
    if (!this.internalHasPlayer(userId)) return;

    const dynamicChannels = this.renderer.dynamicChannels;
    if (!dynamicChannels) return;

    // 检查说书人当前是否已经在这个玩家的小屋中
    const storytellerChannelId = this.activeUsers.get(this.storytellerId);
    if (storytellerChannelId) {
      const currentCottageOwnerId = dynamicChannels.getStorytellerInCottage(storytellerChannelId);
      if (currentCottageOwnerId === userId) {
        // 说书人已经在这个玩家的小屋中，返回主频道
        dynamicChannels.roamUserToMainChannel(this.storytellerId);
        return;
      }
    }

    // 说书人进入玩家的小屋
    dynamicChannels.roamStorytellerToCottage(userId);
  }

  protected storytellerSelectVoting(userId: string) {
    if (this.state.listMode.value !== ListMode.VOTING) return;

    this.vote.voteToggle(userId);
    this.updatePlayerList();
  }

  protected storytellerSetVoteTime(time: string) {
    if (this.state.listMode.value !== ListMode.NOMINATE) return;

    const voteTime = parseInt(time);
    if (isNaN(voteTime) || voteTime <= 0) return;

    this.state.listArg.set(voteTime);
    this.vote.voteTime = voteTime;
  }

  /**
   * 开始投票
   * @param time 投票时间（秒）
   */
  protected storytellerStartVoting() {
    // 必须已经在投票状态才能开始
    if (this.state.listMode.value !== ListMode.VOTING) return;
    this.vote.start();
  }

  /**
   * 停止投票（不会退出投票状态，只是重置投票，方便重新开始）
   */
  protected storytellerStopVoting() {
    if (this.state.listMode.value !== ListMode.VOTING) return;
    this.vote.reset();
  }

  protected storytellerVoteAdd() {
    if (this.state.listMode.value !== ListMode.VOTING) return;
    this.vote.voteAdd();
  }

  protected storytellerVoteRemove() {
    if (this.state.listMode.value !== ListMode.VOTING) return;
    this.vote.voteRemove();
  }

  protected storytellerClearGlobalCard() {
    if (this.state.listMode.value === ListMode.PRIVATE) return;
    this.state.townsquareCards.length = 0;
    this.updateMessagingCard();
  }

  protected storytellerClearPrivateCard() {
    if (this.state.listMode.value !== ListMode.PRIVATE) return;

    const privateTarget = this.listSelection.values().next().value;
    if (!privateTarget) return;

    this.userInfoCards.delete(privateTarget);
    this.sendPrivateCard(privateTarget);
    this.updateMessagingCard();
  }

  // Player voting actions
  protected playerVoteNone(userId: string) {
    if (!this.state.voting.value) return;

    // 只有玩家可以投票
    if (!this.internalHasPlayer(userId)) return;
    this.vote.playerVoteNone(userId);
  }

  protected playerVoteOne(userId: string) {
    if (!this.state.voting.value) return;

    // 只有玩家可以投票
    if (!this.internalHasPlayer(userId)) return;
    this.vote.playerVoteOne(userId);
  }

  protected playerVoteTwo(userId: string) {
    if (!this.state.voting.value) return;

    // 只有玩家可以投票
    if (!this.internalHasPlayer(userId)) return;
    this.vote.playerVoteTwo(userId);
  }

  /**
   * 玩家点击了刷新按钮
   */
  protected playerRefreshPrivate(userId: string, seq: string) {
    const info = this.userInfoCards.get(userId);
    if (!info) {
      if (seq !== '0') {
        this.sendPrivateCard(userId);
      }
      return;
    }

    // 玩家的消息已经是最新的什么都不用干
    if (info.seq.toString() === seq) {
      return;
    }
    this.sendPrivateCard(userId);
  }

  // Location actions
  locationSet(userId: string, locationId: number) {
    if (this.destroyed) return;

    // 只有自由活动时可以使用地点按钮
    if (!this.phase(Phase.ROAMING)) return;

    const dynamicChannels = this.renderer.dynamicChannels;
    if (!dynamicChannels) return;

    const location = ROAMING_LOCATIONS[locationId];
    if (!location) return;

    if (location.isMain) {
      dynamicChannels.roamUserToMainChannel(userId);
    } else if (location.isCottage) {
      if (userId == this.storytellerId) {
        // 说书人点击小屋按钮时切换到小屋模式
        this.storytellerListCottage();
      } else {
        dynamicChannels.roamUserToCottage(userId);
      }
    } else {
      dynamicChannels.roamUserTo(location.name, userId);
    }
  }

  systemPlayerJoinVoiceChannel(userId: string, channelId: string) {
    if (this.destroyed) return;

    this.activeUsers.set(userId, channelId);

    // 清除用户的不活跃定时器
    this.clearUserInactivityTimer(userId);

    // 如果这是第一个活跃用户，清除会话空闲定时器
    this.clearSessionIdleTimer();

    if (channelId === this.renderer.voiceChannelId) {
      this.townsquareUsers.add(userId);
      this.updatePlayerList();
    }

    // 说书人加入语音频道时，进入准备阶段
    if (userId === this.storytellerId) {
      if (this.phase(Phase.WAITING_FOR_STORYTELLER)) {
        this.state.phase.set(Phase.PREPARING);
      }

      if (!this.greeted.has(userId)) {
        this.greeted.add(userId);
        this.renderer.sendMessageToVoiceChannel(
          ApiMessageType.CARD,
          JSON.stringify(
            textCard(
              `说书人 (met)${userId}(met) 已加入小镇\n请说书人前往：(chn)${this.renderer.storytellerChannelId}(chn)`,
            ),
          ),
        );
      }

      // 更新禁言状态
      this.updateMuteState();
      this.updatePlayerList();

      // 说书人不会加入游戏
      return;
    }

    // 更新禁言状态
    this.updateMuteState();
    this.updatePlayerList();

    // 准备阶段加入语音的玩家会自动成为玩家
    if (this.isPreparing() && !this.internalHasPlayer(userId)) {
      this.internalAddPlayer(userId);

      if (!this.greeted.has(userId)) {
        this.greeted.add(userId);
        this.renderer.sendMessageToVoiceChannel(
          ApiMessageType.CARD,
          JSON.stringify(
            textCard(
              `镇民 (met)${userId}(met) 已加入小镇\n请镇民前往：(chn)${this.renderer.townsquareChannelId}(chn)`,
            ),
          ),
        );
      }
    }

    // 如果加入频道的是玩家，且现在是夜晚，但是玩家加入的主频道，将玩家移动到小屋
    if (
      this.internalHasPlayer(userId) &&
      this.state.phase.value === Phase.NIGHT &&
      channelId === this.renderer.voiceChannelId
    ) {
      this.renderer.dynamicChannels?.roamUserToCottage(userId);
    }
  }

  systemPlayerLeaveVoiceChannel(userId: string) {
    if (this.destroyed) return;

    this.activeUsers.delete(userId);
    this.townsquareUsers.delete(userId);
    this.updatePlayerList();

    // 用户离开语音频道时解除禁言
    MUTES.unmute(userId);

    // 设置用户不活跃定时器（包括说书人）
    this.setUserInactivityTimer(userId);

    // 如果没有活跃用户了，设置会话空闲定时器
    if (this.activeUsers.size === 0) {
      this.setSessionIdleTimer();
    }

    // 说书人不会退出游戏（但会有不活跃检查）
    if (userId === this.storytellerId) return;

    // 准备阶段退出语音的玩家会自动退出玩家列表并退出游戏
    if (this.isPreparing() && this.internalHasPlayer(userId)) {
      this.internalRemovePlayer(userId);
    }
  }

  /**
   * 若玩家目前在语音频道中，将玩家踢出语音频道
   * @param userId
   * @returns
   */
  kickoutUser(userId: string) {
    if (this.destroyed) return;

    const channelId = this.activeUsers.get(userId);
    if (!channelId) return;

    this.renderer.dynamicChannels?.kickUserFromChannel(userId, channelId);
  }

  notifyUserJoin(userId: string) {
    if (this.destroyed) return;
    this.updatePlayerList();
  }

  notifyUserLeave(userId: string) {
    if (this.destroyed) return;

    // 用户已经退出，清理用户非活跃计时
    this.clearUserInactivityTimer(userId);

    // 如果在准备阶段，退出的玩家会自动退出游戏
    if (this.isPreparing() && this.internalHasPlayer(userId)) {
      this.internalRemovePlayer(userId);
    }

    // 如果存在的话，删除玩家的小屋
    this.renderer.dynamicChannels?.destroyCottageForUser(userId);
    this.updatePlayerList();
  }

  /**
   * @returns true 如果目前的状态允许玩家自动退出
   */
  isPreparing() {
    return this.phase(
      Phase.PREPARING,
      Phase.WAITING_FOR_STORYTELLER,
      Phase.INITIALIZING,
      Phase.FINISH_GOOD,
      Phase.FINISH_BAD,
    );
  }

  /**
   * 查询玩家是否是正在游戏的玩家
   */
  isPlaying(userId: string) {
    // 说书人是重要玩家
    if (userId === this.storytellerId) return true;

    return this.internalHasPlayer(userId);
  }

  private sendPrivateCard(userId: string) {
    const privateInfo = this.userInfoCards.get(userId) ?? {
      seq: 0,
      card: [],
    };
    this.renderer.userCard.update(userId, {
      content: JSON.stringify([
        {
          type: 'card',
          theme: 'warning',
          size: 'lg',
          modules: [
            ...townSquarePrivateCardHeader(privateInfo.seq.toString(), userId),
            ...(privateInfo.card.length == 0
              ? [
                  {
                    type: 'section',
                    text: {
                      type: 'kmarkdown',
                      content: `(font)卡片上空空如也...(font)[tips]`,
                    },
                  },
                ]
              : privateInfo.card),
          ],
        },
      ]),
    });
  }

  async handleStorytellerMessage(event: TextMessageEvent) {
    if (this.destroyed) return;

    // 删除消息，作为已经接收的响应
    this.renderer.deleteMessage(event.msg_id);

    let privateTarget: string | undefined;

    if (this.state.listMode.value === ListMode.PRIVATE) {
      // 托梦中，查找正在托梦的用户
      privateTarget = this.listSelection.values().next().value;
    }

    // 处理消息
    let modules: any[] = [];

    const linkMatch = event.content.match(
      /https:\/\/www\.kookapp\.cn\/direct\/anchor\/[0-9]+\/[0-9]+\/([0-9a-z-]{36})/,
    );

    if (linkMatch) {
      try {
        const msg_id = linkMatch[1];
        if (msg_id) {
          const message = await BOT.api.messageView({ msg_id });
          switch (message.type) {
            case ApiMessageType.TEXT:
              modules.push(textModule(message.content));
              break;
            case ApiMessageType.IMAGE:
              modules.push(imageModule(message.content));
              break;
            case ApiMessageType.KMARKDOWN:
              modules.push(markdownModule(message.content));
              break;
            case ApiMessageType.CARD:
              try {
                const cards = JSON.parse(message.content);
                for (const card of cards) {
                  modules.push(...(card.modules ?? []));
                }
              } catch (error: any) {
                modules.push(textModule(error?.message ?? error.toString() ?? '未知错误'));
              }
              break;
          }
        }
      } catch (error: any) {
        modules.push(textModule(error?.message ?? error.toString() ?? '未知错误'));
      }
    } else {
      switch (event.type) {
        case MessageType.TEXT:
          modules.push(textModule(event.content));
          break;
        case MessageType.IMAGE:
          modules.push(imageModule(event.content));
          break;
        case MessageType.KMARKDOWN:
          modules.push(markdownModule(event.content));
          break;
        case MessageType.CARD:
          try {
            const cards = JSON.parse(event.content);
            for (const card of cards) {
              modules.push(...(card.modules ?? []));
            }
          } catch {
            // ignored
          }
          break;
      }
    }

    // 不支持的消息，无视
    if (!modules) return;

    if (privateTarget) {
      let privateInfo = this.userInfoCards.get(privateTarget);
      if (!privateInfo) {
        privateInfo = {
          seq: 1,
          card: [],
        };
        this.userInfoCards.set(privateTarget, privateInfo);
      }
      if (privateInfo.card.length >= 10) {
        privateInfo.card.shift();
      }
      privateInfo.card.push(...modules);
      privateInfo.seq++;
      this.sendPrivateCard(privateTarget);
    } else {
      if (this.state.townsquareCards.length >= 10) {
        this.state.townsquareCards.shift();
      }
      this.state.townsquareCards.push(...modules);
    }

    // 说书人发言时，更新托梦卡片
    this.updateMessagingCard();
  }

  async destroy() {
    if (this.destroyed) return;

    this.destroyed = true;

    // 解除所有活跃用户的禁言
    for (const userId of this.activeUsers.keys()) {
      MUTES.unmute(userId);
    }

    // 清理所有用户不活跃定时器
    for (const timer of this.userInactivityTimers.values()) {
      clearTimeout(timer);
    }
    this.userInactivityTimers.clear();

    // 清理会话空闲定时器
    this.clearSessionIdleTimer();

    return this.renderer.destroy();
  }
}
