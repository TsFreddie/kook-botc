import { BOT } from '../bot';
import { Session } from './session';

/** 回话处理回调 */
export interface Register {
  addChannel: (channel: string) => void;
  removeChannel: (channel: string) => void;
  isUserJoined: (user: string) => boolean;
  getJoinedPlayers: () => string[];
  kick: (userId: string) => void;
  destroy: () => void;
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
          return null;
        }

        if (this.channelMap.has(channel)) {
          throw new Error('频道已加入会话');
        }

        this.channelMap.set(channel, session);
        data.channels.add(channel);
      },
      removeChannel: (channel) => {
        if (!this.sessions.has(session)) {
          return null;
        }

        if (this.channelMap.get(channel) !== session) {
          throw new Error('频道不属于当前会话');
        }
        this.channelMap.delete(channel);
        data.channels.delete(channel);
      },
      isUserJoined: (user) => {
        if (!this.sessions.has(session)) {
          return false;
        }
        return data.users.has(user);
      },
      destroy: () => {
        this.removeSession(session);
      },
      getJoinedPlayers: () => {
        return [...data.users.values()];
      },
      kick: (user) => {
        this.kick(user, session);
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
   * 将用户加入会话
   */
  addUserToSession(session: Session, userId: string) {
    const data = this.sessions.get(session);
    if (!data) {
      throw new Error('会话不存在');
    }

    const userSession = this.userMap.get(userId);
    if (userSession === session) {
      // 已经在这个会话中了
      return;
    }

    if (userSession) {
      throw new Error('用户已属于其他会话');
    }

    data.users.add(userId);
    this.userMap.set(userId, session);

    // 通知渲染器更新用户角色
    session.renderer.grantUserRole(userId);
    session.notifyUserJoin(userId);
  }

  /**
   * 将用户从会话中移除
   */
  removeUserFromSession(session: Session, userId: string) {
    const data = this.sessions.get(session);
    if (!data) {
      throw new Error('会话不存在');
    }

    const userRemovedFromSession = data.users.delete(userId);
    const userRemovedFromRouter = this.userMap.delete(userId);

    if (!userRemovedFromSession && !userRemovedFromRouter) return;

    // 通知渲染器更新用户角色
    session.renderer.revokeUserRole(userId);
    session.notifyUserLeave(userId);
  }

  /**
   * 根据频道ID获取会话
   */
  getSessionByChannelId(channelId: string): Session | null {
    return this.channelMap.get(channelId) || null;
  }

  /**
   * 根据用户ID获取会话
   */
  getSessionByUserId(userId: string): Session | null {
    return this.userMap.get(userId) || null;
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

    // 销毁会话
    session.destroy();

    for (const user of data.users) {
      this.userMap.delete(user);
    }
    for (const channel of data.channels) {
      this.channelMap.delete(channel);
    }
    this.sessions.delete(session);
  }

  /**
   * 用户加入语音频道
   */
  systemUserJoinVoiceChannel(user: string, channel: string) {
    let userSession = this.getSessionByUserId(user);
    const channelSession = this.getSessionByChannelId(channel);

    // 正在游戏中的玩家加入了另一个游戏的频道
    if (channelSession && userSession && userSession !== channelSession) {
      if (userSession.isPlaying(user)) {
        // 玩家正在游戏，不能加入其他会话，直接踢出玩家，不用在乎报错
        BOT.api.channelKickout(channel, user).catch(console.error);
        return;
      }

      // 检测玩家为旁观玩家，直接退出正在旁观的会话
      this.removeUserFromSession(userSession, user);
      userSession = null;
    }

    // 用户已经在游戏里了，且加入的是自己游戏的频道
    if (userSession && channelSession && userSession === channelSession) {
      // 通知玩家进入语音频道
      userSession.systemPlayerJoinVoiceChannel(user, channel);
      return;
    }

    // 频道不属于任何游戏，不用管
    if (!channelSession) return;

    // 用户不在游戏内，加入游戏
    this.addUserToSession(channelSession, user);
    channelSession.systemPlayerJoinVoiceChannel(user, channel);
  }

  /**
   * 用户退出语音频道
   */
  systemUserLeaveVoiceChannel(user: string) {
    const session = this.getSessionByUserId(user);

    // 用户不在游戏内，不用管
    if (!session) return;

    // 通知玩家退出语音频道
    session.systemPlayerLeaveVoiceChannel(user);

    // 说书人不会退出会话
    if (user === session.storytellerId) {
      return;
    }

    // 准备阶段退出的玩家将自动退出游戏
    if (session.isPreparing()) {
      this.removeUserFromSession(session, user);
    }
  }

  kick(user: string, session: Session) {
    const userSession = this.getSessionByUserId(user);
    if (!userSession || userSession !== session) return;

    userSession.kickoutUser(user);
    this.removeUserFromSession(session, user);
  }

  /**
   * 用户点击离开游戏，离开时会尝试将用户从当前语音频道中移除
   */
  actionGameLeave(user: string, channel: string) {
    const userSession = this.getSessionByUserId(user);
    if (!userSession) return;

    const channelSession = this.getSessionByChannelId(channel);
    if (userSession !== channelSession) return;

    this.kick(user, userSession);
  }

  /**
   * 销毁所有会话
   */
  async destroy() {
    if (this.destroyed) return;

    this.destroyed = true;

    for (const session of this.sessions.keys()) {
      await session.destroy();
    }
  }
}

export const ROUTER = new Router();
