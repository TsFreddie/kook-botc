import type { Register } from './router';
import { Renderer } from './renderer';

export enum Phase {
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
  /** 存活 */
  ALIVE = 0,
  /** 死亡投票权 */
  DEAD,
  /** 死亡无投票权 */
  DEAD_VOTED,
}

export enum ListMode {
  /** 玩家状态 */
  STATUS = 0,
  /**  */
}

/** 游戏状态 */
interface GameState {
  phase: Phase;
  voting: boolean;
}

/** 玩家状态 */
interface PlayerState {
  id: string;
  status: PlayerStatus;
}

/**
 * 游戏会话
 */
export class Session {
  private state: GameState = {
    phase: Phase.INITIALIZING,
    voting: false,
  };

  private players: PlayerState[] = [];
  private register: Register;

  public readonly renderer: Renderer;

  constructor(storytellerId: string, register: Register) {
    this.renderer = new Renderer(storytellerId, register);
    this.register = register;
  }

  /**
   * 目前在语音频道活跃的玩家
   */
  private activeUsers: Set<string> = new Set();

  /**
   * 当前是否为指定状态
   * @param phases 查询的状态
   * @returns true 如果为任意一个指定状态
   */
  private phase(...phases: Phase[]) {
    for (const phase of phases) {
      if (this.state.phase === phase) return true;
    }
    return false;
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
    });
  }

  /**
   * 判断玩家是否已加入
   * @param user
   * @returns
   */
  private internalHasPlayer(user: string) {
    return this.players.find((p) => p.id === user) !== undefined;
  }

  storytellerGameStart() {
    if (!this.phase(Phase.PREPARING)) return;

    this.state.phase = Phase.NIGHT;
  }

  storytellerGameDay() {
    if (!this.phase(Phase.NIGHT, Phase.ROAMING)) return;

    this.state.phase = Phase.DAY;
  }

  storytellerGameRoaming() {
    if (!this.phase(Phase.DAY)) return;

    this.state.phase = Phase.ROAMING;
  }

  storytellerGameReset() {
    // 初始化过程中不可重置游戏状态
    if (this.phase(Phase.WAITING_FOR_STORYTELLER, Phase.INITIALIZING)) return;

    this.state.phase = Phase.PREPARING;

    // 如果重新开始时玩家没有游玩权限，则直接移除
    for (let i = this.players.length - 1; i >= 0; i--) {
      const player = this.players[i]!;
      if (!this.register.isPlayerJoined(player.id)) {
        this.players.splice(i, 1);
      }
    }
  }

  systemPlayerJoinVoiceChannel(user: string) {
    this.activeUsers.add(user);

    // 准备阶段加入语音的玩家会自动成为玩家
    if (this.phase(Phase.PREPARING) && !this.internalHasPlayer(user)) {
      this.internalAddPlayer(user);
    }
  }

  systemPlayerLeaveVoiceChannel(user: string) {
    this.activeUsers.delete(user);

    // 准备阶段退出语音的玩家会自动退出玩家列表
    if (this.phase(Phase.PREPARING) && this.internalHasPlayer(user)) {
      this.internalRemovePlayer(user);
    }
  }
}
