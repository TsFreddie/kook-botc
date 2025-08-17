import { Session } from './session';

/** 回话处理回调 */
export interface Register {
  addChannel: (channel: string) => void;
  removeChannel: (channel: string) => void;
  isPlayerJoined: (user: string) => boolean;
}

interface SessionData {
  users: Set<string>;
  channels: Set<string>;
}

/**
 * 游戏会话管理
 * 玩家是否属于一个 Session，即权限管理由 SessionRegister 负责
 */
export class Router {
  private userMap: Map<string, Session> = new Map();
  private channelMap: Map<string, Session> = new Map();
  private sessions: Map<Session, SessionData> = new Map();

  private destroyed = false;

  /**
   * 创建新会话
   */
  async createSession(storyteller: string) {
    if (this.destroyed) return null;

    if (this.userMap.has(storyteller)) {
      return {
        session: this.userMap.get(storyteller)!,
        isNew: false,
      };
    }

    const data = {
      users: new Set(),
      channels: new Set(),
    } satisfies SessionData;

    const session = new Session(storyteller, {
      addChannel: (channel) => {
        if (!this.sessions.has(session)) {
          throw new Error('会话不存在');
        }
        if (this.channelMap.has(channel)) {
          throw new Error('频道已加入会话');
        }
        this.channelMap.set(channel, session);
        data.channels.add(channel);
      },
      removeChannel: (channel) => {
        if (!this.sessions.has(session)) {
          throw new Error('会话不存在');
        }
        if (this.channelMap.get(channel) !== session) {
          throw new Error('频道不属于当前会话');
        }
        this.channelMap.delete(channel);
        data.channels.delete(channel);
      },
      isPlayerJoined: (user) => {
        if (!this.sessions.has(session)) {
          throw new Error('会话不存在');
        }
        return data.users.has(user);
      },
    });

    // 说书人始终属于其创建的会话
    data.users.add(storyteller);
    this.userMap.set(storyteller, session);

    this.sessions.set(session, data);

    await session.renderer.initialize();

    return { session, isNew: true };
  }

  /**
   * 删除会话
   */
  removeSession(session: Session) {
    if (this.destroyed) return null;

    const data = this.sessions.get(session);
    if (!data) {
      throw new Error('会话不存在');
    }

    // 通知 Renderer 进行销毁
    session.renderer.destroy();

    for (const user of data.users) {
      this.userMap.delete(user);
    }
    for (const channel of data.channels) {
      this.channelMap.delete(channel);
    }
    this.sessions.delete(session);
  }

  /**
   * 销毁所有会话
   */
  destroy() {
    if (this.destroyed) return;

    this.destroyed = true;

    for (const session of this.sessions.keys()) {
      session.renderer.destroy();
    }
  }
}

export const ROUTER = new Router();
