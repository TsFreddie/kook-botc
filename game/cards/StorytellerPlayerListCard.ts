import { $card, Card } from '../utils/card';
import { GAME } from '../../bot';
import { ListMode, type ListPlayerItem } from '../session';
import type { CValue } from '../utils/state';
import type { ActionGroup } from '../../templates/types';
import type { PlayersTemplateParams } from '../../templates/players';
import type { ButtonTheme } from '../../lib/api';

interface Props {
  /** （说书人）列表模式 */
  listMode: CValue<ListMode>;

  /** 玩家列表 */
  list: CValue<ListPlayerItem[]>;

  /** 投票信息 */
  voteInfo: CValue<string>;

  /** 投票倒计时 */
  votingStart: CValue<number>;
  votingEnd: CValue<number>;

  /** 广场人数 */
  townsquareCount: CValue<number>;
}

/**
 * 说书人玩家列表卡片
 */
class CardRenderer extends Card<Props> {
  render(state: Props): { content: string; template_id?: string } {
    let status = '';
    const groups: ActionGroup[] = [];
    let countdown: { start: number; end: number } | undefined;
    let action: { text: string; theme: ButtonTheme } | undefined;
    let theme: ButtonTheme = 'secondary';

    // storyteller player
    let value = '';

    // 根据列表模式设置状态和按钮
    switch (state.listMode.value) {
      case ListMode.STATUS:
        status = '**状态调整**\n点击按钮切换玩家死亡状态';
        groups.push([
          { text: '换座', theme: 'primary', value: '[st]ListSwap' },
          { text: '旁观', theme: 'info', value: '[st]ListSpectate' },
          { text: '禁言', theme: 'success', value: '[st]ListMute' },
          { text: '踢出', theme: 'danger', value: '[st]ListKick' },
        ]);
        groups.push([
          { text: '托梦', theme: 'warning', value: '[st]ListPrivate' },
          { text: '提名', theme: 'danger', value: '[st]ListNominate' },
          { text: '投票', theme: 'primary', value: '[st]LiteVote' },
        ]);
        theme = 'secondary';
        action = { text: '切换', theme: 'info' };
        value = 'Status';
        break;

      case ListMode.SWAP:
        status = '**换座模式**\n选择两名玩家交换座位';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        theme = 'primary';
        action = state.list.value.some((item) => item.selected)
          ? { text: '交换', theme: 'success' }
          : { text: '选择', theme: 'primary' };
        value = 'Swap';
        break;

      case ListMode.SPECTATE:
        status = '**旁观调整**\n点击按钮切换玩家是否旁观，旁观者不能参与游戏';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        theme = 'info';
        action = { text: '移出游戏', theme: 'danger' };
        value = 'Spectate';
        break;

      case ListMode.MUTE:
        status = '**禁言调整**\n点击按钮切换玩家禁言状态';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        groups.push([{ text: '上麦模式', theme: 'warning', value: '[st]ListSpotlight' }]);
        theme = 'success';
        action = { text: '禁言', theme: 'danger' };
        value = 'Mute';
        break;

      case ListMode.KICK:
        status = '**踢出玩家**\n点击按钮踢出玩家';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        theme = 'danger';
        action = { text: '踢出', theme: 'danger' };
        value = 'Kick';
        break;

      case ListMode.SPOTLIGHT:
        status = '**上麦模式**\n选择玩家单独发言';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        groups.push([{ text: '禁言调整', theme: 'success', value: '[st]ListMute' }]);
        theme = 'warning';
        action = { text: '上麦', theme: 'warning' };
        value = 'Spotlight';
        break;

      case ListMode.PRIVATE:
        status =
          '**托梦工具**\n点击按钮选中玩家，选中后发送的聊天消息会托梦给指定玩家（玩家只能看到最新一条消息）';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        theme = 'warning';
        action = { text: '托梦', theme: 'warning' };
        value = 'Private';
        break;

      case ListMode.NOMINATE:
        status = state.list.value.some((item) => item.selected)
          ? '**发起提名**\n点击按钮发起投票是否处决指定玩家'
          : '**发起提名**\n点击按钮选择发起提名的玩家';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        theme = 'danger';
        action = { text: '选择', theme: 'info' };
        value = 'Nominate';
        break;

      case ListMode.VOTE:
        status = state.voteInfo.value || '投票进行中';
        if (state.votingStart.value > 0 && state.votingEnd.value > 0) {
          countdown = {
            start: state.votingStart.value,
            end: state.votingEnd.value,
          };
        }
        groups.push([
          { text: '退出', theme: 'danger', value: '[st]ListStatus' },
          { text: '-1', theme: 'info', value: '[st]VoteRemove' },
          { text: '+1', theme: 'info', value: '[st]VoteAdd' },
        ]);
        theme = 'primary';
        value = 'Vote';
        break;
    }

    // 构建玩家列表
    const players = state.list.value.map((item: ListPlayerItem, index: number) => {
      let info = item.info;
      let action: { text: string; theme: ButtonTheme } | 'none' | undefined;

      switch (state.listMode.value) {
        case ListMode.STATUS:
          if (item.type !== 'player') {
            action = 'none';
          }
          break;

        case ListMode.SWAP:
          if (item.type !== 'player') {
            // 不是玩家不能换座
            action = 'none';
          } else if (item.selected) {
            action = { text: '已选择', theme: 'secondary' };
          }
          break;

        case ListMode.SPECTATE:
          if (item.type === 'spectator') {
            action = { text: '加入游戏', theme: 'info' };
          } else if (item.type === 'storyteller') {
            action = 'none';
          }
          break;

        case ListMode.MUTE:
          if (item.selected) {
            action = { text: '取消禁言', theme: 'secondary' };
          }
          break;

        case ListMode.KICK:
          // 说书人和本来就不在游戏内的玩家不能被踢
          if (item.type === 'storyteller' || !item.joined) {
            action = 'none';
          }
          break;

        case ListMode.SPOTLIGHT:
          if (item.selected) {
            action = { text: '发言中', theme: 'secondary' };
          }
          break;

        case ListMode.PRIVATE:
          if (item.selected) {
            action = { text: '托梦中', theme: 'secondary' };
          }
          break;

        case ListMode.NOMINATE:
          if (item.type !== 'player') {
            action = 'none';
          } else if (item.selected) {
            action = { text: '提名者', theme: 'secondary' };
          }
          break;

        case ListMode.VOTE:
          if (item.selected) {
            action = { text: '切换', theme: 'secondary' };
          }
          break;
      }

      return { info, action, id: item.id };
    });

    const data: PlayersTemplateParams = {
      theme,
      status: `城镇广场人数：${state.townsquareCount.value} / ${state.list.value.length}\n${status}`,
      action,
      prefix: `[sp]${value}`,
      groups: groups.length > 0 ? groups : undefined,
      countdown,
      players: players.length > 0 ? players : undefined,
    };

    return {
      content: JSON.stringify(data),
      template_id: GAME.templates.players,
    };
  }
}

export default (state: Props) => $card(new CardRenderer(state));
