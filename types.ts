export interface GameConfig {
  guildId: string;
  storytellerRoleId: number;
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
