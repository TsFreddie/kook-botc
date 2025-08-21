import { $card, Card } from '../utils/card';
import { GAME } from '../../bot';
import type { ListPlayerItem } from '../session';
import type { CValue } from '../utils/state';
import type { ActionGroup } from '../../templates/types';
import type { PlayersTemplateParams } from '../../templates/players';
import type { ButtonTheme } from '../../lib/api';

interface Props {
  /** （城镇广场）是否为投票模式 */
  voting: CValue<boolean>;

  /** 玩家列表 */
  list: CValue<ListPlayerItem[]>;

  /** 列表参数 */
  listArg: CValue<number | number[]>;

  /** 投票信息 */
  voteInfo: CValue<string>;

  /** 投票倒计时 */
  votingStart: CValue<number>;
  votingEnd: CValue<number>;

  /** 广场人数 */
  townsquareCount: CValue<number>;
}

/**
 * 城镇广场玩家列表卡片
 */
class CardRenderer extends Card<Props> {
  render(state: Props): { content: string; template_id?: string } {
    let status = '';
    const groups: ActionGroup[] = [];
    let countdown: { start: number; end: number } | undefined;
    let theme: ButtonTheme = 'secondary';

    // 根据投票模式设置状态和按钮
    if (state.voting.value) {
      status = state.voteInfo.value || '投票进行中';
      if (state.votingStart.value > 0 && state.votingEnd.value > 0) {
        countdown = {
          start: state.votingStart.value,
          end: state.votingEnd.value,
        };
      }

      // 根据 listArg 决定投票按钮
      if (state.listArg.value === 1) {
        // 三个按钮：不投票，投票，投两票
        groups.push([
          { text: '不投票', theme: 'secondary', value: '[pl]VoteNone' },
          { text: '投票', theme: 'primary', value: '[pl]VoteOne' },
          { text: '投两票', theme: 'info', value: '[pl]VoteTwo' },
        ]);
      } else {
        // 两个按钮：不投票，投票
        groups.push([
          { text: '不投票', theme: 'secondary', value: '[pl]VoteNone' },
          { text: '投票', theme: 'primary', value: '[pl]VoteOne' },
        ]);
      }
      theme = 'primary';
    } else {
      status = '当前没有进行投票';
    }

    // 构建玩家列表，不包含任何操作按钮
    const players = state.list.value.map((item) => {
      return {
        info: item.info,
        action: 'none' as const,
        id: item.id,
      };
    });

    const data: PlayersTemplateParams = {
      theme,
      header: `**玩家列表** (font)(城镇广场人数：${state.townsquareCount.value} / ${state.list.value.length})(font)[secondary]`,
      status,
      forceButton: false,
      prefix: `[pl]`,
      groups: state.voting.value && groups.length > 0 ? groups : undefined,
      countdown,
      players: players.length > 0 ? players : undefined,
    };

    return {
      content: JSON.stringify(data),
      template_id: GAME.templates.players,
    };
  }
}

export default (state: Props) => $card(new CardRenderer(state, 0, 0, true));
