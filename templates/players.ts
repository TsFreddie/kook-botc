import type { ButtonTheme } from '../lib/api';
import type { ActionGroup } from './types';

export interface PlayersTemplateParams {
  /** 主题 */
  theme: ButtonTheme;

  /** 卡片标题 */
  header: string;

  /** 状态信息 */
  status: string;

  /** 按钮分组 */
  groups?: ActionGroup[];

  /** 操作 */
  action?: { text: string; theme: ButtonTheme };

  /** 强制在玩家列表中显示按钮 */
  forceButton?: boolean;

  /** 倒计时 */
  countdown?: {
    start: number;
    end: number;
  };

  /** 按钮前缀 */
  prefix: string;

  /** 玩家列表 */
  players?: {
    /** 玩家信息 */
    info: string;
    id: string;
    /** 操作 */
    action?: { text: string; theme: ButtonTheme } | 'none';
  }[];
}

export const playersTwig = async () => {
  return await Bun.file('./templates/players.twig').text();
};
