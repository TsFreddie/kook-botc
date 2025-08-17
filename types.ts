export interface GameConfig {
  guildId: string;
  storytellerRoleId: number;
  roomCategoryId: string;
  gameCategoryId: string;
  templates: {
    storyteller: string;
    townsquare: string;
  };
  assets: Record<string, string>;
}
