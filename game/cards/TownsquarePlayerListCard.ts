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

  /** 是否为闭眼投票模式 */
  blindVoting: CValue<boolean>;

  /** 投票详情 */
  voteDescription: CValue<string>;

  /** 投票信息 */
  voteInfo: CValue<{
    count: string;
    status: string;
  }>;

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
      status =
        state.voteDescription +
        '\n' +
        (state.blindVoting.value ? '闭眼投票中...' : state.voteInfo.value.count) +
        state.voteInfo.value.status;
      if (state.votingStart.value > 0 && state.votingEnd.value > 0) {
        countdown = {
          start: state.votingStart.value,
          end: state.votingEnd.value,
        };
      }

      groups.push([
        { text: '放下手', theme: 'secondary', value: '[pl]VoteNone' },
        { text: '举手', theme: 'primary', value: '[pl]VoteOne' },
        { text: '举双手', theme: 'info', value: '[pl]VoteTwo' },
      ]);

      theme = 'primary';
    } else {
      status = '当前没有进行投票';
    }

    const transformVote = (str: string) =>
      state.blindVoting.value
        ? str.replace(/✅/, '⬛').replace(/2️⃣/, '⬛').replace(/❌/, '❓')
        : str;

    // 构建玩家列表，不包含任何操作按钮
    const players = state.list.value.map((item) => {
      return {
        info: item.preVoteInfo + transformVote(item.vote) + item.postVoteInfo,
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
