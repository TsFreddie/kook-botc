import { Game } from './game_old';
import type { KookClient } from './lib/kook';
import type { GameConfig } from './types';

export interface Router {
  routeChannel: (channelId: string) => void;
  routeUser: (userId: string) => void;
  unrouteChannel: (channelId: string) => void;
  unrouteUser: (userId: string) => void;
}

/** 会话管理 */
export class SessionRouter {
  private user2Game: Map<string, Game>;
  private channel2Game: Map<string, Game>;
  private bot: KookClient;
  private config: GameConfig;

  constructor(bot: KookClient, config: GameConfig) {
    this.user2Game = new Map();
    this.channel2Game = new Map();
    this.bot = bot;
    this.config = config;
  }

  async createGame(storytellerId: string) {
    if (this.user2Game.has(storytellerId)) {
      return this.user2Game.get(storytellerId)!;
    }

    const game = new Game(storytellerId, this.bot, this.config, {
      routeChannel: (id) => this.routeChannel(id, game),
      routeUser: (id) => this.routeUser(id, game),
      unrouteChannel: (id) => this.unrouteChannel(id, game),
      unrouteUser: (id) => this.unrouteUser(id, game),
    });
    await game.init();
    return game;
  }

  getGameByUserId(userId: string) {
    return this.user2Game.get(userId);
  }

  getGameByChannelId(channelId: string) {
    return this.channel2Game.get(channelId);
  }

  routeChannel(channelId: string, game: Game) {
    if (this.channel2Game.has(channelId)) {
      throw new Error('Channel already routed');
    }
    this.channel2Game.set(channelId, game);
  }

  routeUser(userId: string, game: Game) {
    if (this.user2Game.has(userId)) {
      throw new Error('User already routed');
    }
    this.user2Game.set(userId, game);
  }

  unrouteChannel(channelId: string, game: Game) {
    const routedGame = this.channel2Game.get(channelId);
    if (routedGame !== game) {
      throw new Error('Channel not routed to game');
    }
    this.channel2Game.delete(channelId);
  }

  unrouteUser(userId: string, game: Game) {
    const routedGame = this.user2Game.get(userId);
    if (routedGame !== game) {
      throw new Error('User not routed to game');
    }
    this.user2Game.delete(userId);
  }

  async cleanup() {
    await Promise.allSettled(Array.from(this.user2Game.values()).map((game) => game.cleanup()));
  }
}
