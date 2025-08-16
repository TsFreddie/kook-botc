import { Game } from './game';
import type { KookClient } from './lib/kook';
import type { GameConfig } from './types';

/** 会话管理 */
export class Manager {
  private games: Map<string, Game>;
  private user2Game: Map<string, Game>;
  private bot: KookClient;
  private config: GameConfig;

  constructor(bot: KookClient, config: GameConfig) {
    this.games = new Map();
    this.user2Game = new Map();
    this.bot = bot;
    this.config = config;
  }

  async createGame(storytellerId: string) {
    if (this.games.has(storytellerId)) {
      return this.games.get(storytellerId)!;
    }

    const game = new Game(storytellerId, this.bot, this.config);
    await game.init();
    this.games.set(storytellerId, game);

    return game;
  }

  async cleanup() {
    await Promise.allSettled(Array.from(this.games.values()).map((game) => game.cleanup()));
  }
}
