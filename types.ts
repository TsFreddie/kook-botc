export interface GameConfig {
  guildId: string;
  roomCategoryId: string;
  gameCategoryId: string;
  cottageCategoryId: string;
  templates: {
    storyteller: string;
    townsquare: string;
    players: string;
  };
  assets: Record<string, string>;
}
