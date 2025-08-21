import { $card, Card } from '../utils/card';
import { GAME } from '../../bot';
import { ListMode, Phase, type ListPlayerItem } from '../session';
import type { CValue, CArray } from '../utils/state';
import type { ActionGroup } from '../../templates/types';
import type { PlayersTemplateParams } from '../../templates/players';
import type { ButtonTheme } from '../../lib/api';

interface Props {
  /** （说书人）列表模式 */
  listMode: CValue<ListMode>;

  /** 当前游戏阶段 */
  phase: CValue<Phase>;

  /** 玩家列表 */
  list: CValue<ListPlayerItem[]>;

  /** 列表选择状态 */
  listSelected: CArray<string>;

  /** 列表参数 */
  listArg: CValue<number>;

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

    // 倒计时配置
    if (state.votingStart.value > 0 && state.votingEnd.value > 0) {
      countdown = {
        start: state.votingStart.value,
        end: state.votingEnd.value,
      };
    }

    // storyteller player
    let value = '';

    // 根据列表模式设置状态和按钮
    switch (state.listMode.value) {
      case ListMode.STATUS:
        status = '**(font)状态调整(font)[body]**\n点击按钮切换玩家存活状态';
        groups.push([
          { text: '换座', theme: 'primary', value: '[st]ListSwap' },
          { text: '旁观', theme: 'info', value: '[st]ListSpectate' },
          { text: '禁言', theme: 'success', value: '[st]ListMute' },
          { text: '踢出', theme: 'danger', value: '[st]ListKick' },
        ]);
        groups.push([
          { text: '托梦', theme: 'warning', value: '[st]ListPrivate' },
          { text: '提名', theme: 'danger', value: '[st]ListNominate' },
          { text: '上麦', theme: 'info', value: '[st]ListSpotlight' },
          // 小屋按钮只在自由活动阶段显示
          state.phase.value === Phase.ROAMING || state.phase.value === Phase.NIGHT
            ? { text: '小屋', theme: 'success', value: '[st]ListCottage' }
            : { text: '　', theme: 'secondary' },
        ]);
        theme = 'secondary';
        action = { text: '切换', theme: 'info' };
        value = 'Status';
        break;

      case ListMode.SWAP:
        status = '**(font)换座模式(font)[primary]**\n选择两名玩家交换座位';
        groups.push([
          { text: '退出', theme: 'danger', value: '[st]ListStatus' },
          { text: '　', theme: 'secondary' },
          { text: '　', theme: 'secondary' },
          { text: '打乱座位', theme: 'warning', value: '[st]ShufflePlayers' },
        ]);
        theme = 'primary';
        action =
          state.listSelected.length > 0
            ? { text: '交换', theme: 'success' }
            : { text: '选择', theme: 'primary' };
        value = 'Swap';
        break;

      case ListMode.SPECTATE:
        const spectatorVoice = state.listArg.value === 1;
        status =
          '**(font)旁观调整(font)[info]**\n点击按钮切换玩家是否旁观，旁观者在游戏进行时将被禁言';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        groups.push([
          { text: '　', theme: 'secondary' },
          { text: '　', theme: 'secondary' },
          { text: '旁观语音', theme: 'secondary', value: '[st]ToggleSpectatorMute' },
          spectatorVoice
            ? { text: '设为禁止', theme: 'warning', value: '[st]ToggleSpectatorMute' }
            : { text: '设为允许', theme: 'success', value: '[st]ToggleSpectatorMute' },
        ]);
        theme = 'info';
        action = { text: '移出游戏', theme: 'danger' };
        value = 'Spectate';
        break;

      case ListMode.MUTE:
        status = '**(font)禁言调整(font)[success]**\n点击按钮切换玩家禁言状态';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        theme = 'success';
        action = { text: '禁言', theme: 'danger' };
        value = 'Mute';
        break;

      case ListMode.KICK:
        status = '**(font)踢出玩家(font)[danger]**\n点击按钮踢出玩家';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        theme = 'danger';
        action = { text: '踢出', theme: 'danger' };
        value = 'Kick';
        break;

      case ListMode.SPOTLIGHT:
        status = '**(font)上麦模式(font)[success]**\n选择玩家单独发言';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        theme = 'info';
        action = { text: '上麦', theme: 'warning' };
        value = 'Spotlight';
        break;

      case ListMode.PRIVATE:
        status = '**(font)托梦工具(font)[warning]**\n发送的聊天消息会单独发送给选择的玩家';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        theme = 'warning';
        action = { text: '托梦', theme: 'warning' };
        value = 'Private';
        break;

      case ListMode.NOMINATE:
        const voteTime = state.listArg.value;
        status =
          state.listSelected.length > 0
            ? '**(font)发起提名(font)[danger]**\n点击按钮发起投票是否处决指定玩家'
            : '**(font)发起提名(font)[danger]**\n点击按钮选择发起提名的玩家';
        groups.push([
          { text: '退出', theme: 'danger', value: '[st]ListStatus' },
          { text: '　', theme: 'secondary' },
          { text: '　', theme: 'secondary' },
          { text: '普通投票', theme: 'info', value: '[st]NormalVote' },
        ]);
        groups.push([
          { text: '每人时间', theme: 'secondary' },
          {
            text: '1秒',
            theme: voteTime === 1 ? 'info' : 'secondary',
            value: '[st]SetVoteTime|1',
          },
          {
            text: '3秒',
            theme: voteTime === 3 ? 'info' : 'secondary',
            value: '[st]SetVoteTime|3',
          },
          {
            text: '5秒',
            theme: voteTime === 5 ? 'info' : 'secondary',
            value: '[st]SetVoteTime|5',
          },
        ]);
        theme = 'danger';
        action = { text: '选择', theme: 'info' };
        value = 'Nominate';
        break;

      case ListMode.COTTAGE:
        status = '**(font)小屋模式(font)[warning]**\n点击玩家进入其小屋';
        groups.push([{ text: '退出', theme: 'danger', value: '[st]ListStatus' }]);
        theme = 'info';
        action = { text: '进入', theme: 'info' };
        value = 'Cottage';
        break;

      case ListMode.VOTING:
        status = state.voteInfo.value || '投票进行中';
        let started = state.votingStart.value > 0;
        groups.push([
          { text: '退出', theme: 'danger', value: '[st]ListStatus' },
          { text: '　', theme: 'secondary' },
          { text: '　', theme: 'secondary' },
          started
            ? { text: '重新开始', theme: 'danger', value: '[st]StopVoting' }
            : { text: '开始投票', theme: 'info', value: `[st]StartVoting` },
        ]);
        groups.push([
          { text: '　', theme: 'secondary' },
          { text: '　', theme: 'secondary' },
          { text: '-1', theme: 'info', value: '[st]VoteRemove' },
          { text: '+1', theme: 'info', value: '[st]VoteAdd' },
        ]);
        theme = 'primary';
        value = 'Voting';
        break;
    }

    // 确保所有按钮组都是4个
    if (groups.length < 2) {
      groups.push([]);
    }
    groups.forEach((group) => {
      while (group.length < 4) {
        (group as any).push({ text: '　', theme: 'secondary' });
      }
    });

    // 构建玩家列表
    const selectedSet = new Set(state.listSelected);
    const players = state.list.value.map((item: ListPlayerItem) => {
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
          } else if (selectedSet.has(item.id)) {
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
          if (item.type === 'storyteller') {
            // 不能禁言说书人
            action = 'none';
          } else if (selectedSet.has(item.id)) {
            action = { text: '取消禁言', theme: 'success' };
          }
          break;

        case ListMode.KICK:
          // 说书人和本来就不在游戏内的玩家不能被踢
          if (item.type === 'storyteller' || !item.joined) {
            action = 'none';
          }
          break;

        case ListMode.SPOTLIGHT:
          if (item.type === 'storyteller') {
            // 说书人始终可以发言
            action = 'none';
          } else if (selectedSet.has(item.id)) {
            action = { text: '取消上麦', theme: 'secondary' };
          }
          break;

        case ListMode.PRIVATE:
          if (item.type === 'storyteller') {
            // 说书人不能被托梦
            action = 'none';
          } else if (selectedSet.has(item.id)) {
            action = { text: '托梦中', theme: 'secondary' };
          }
          break;

        case ListMode.NOMINATE:
          if (item.type !== 'player') {
            action = 'none';
          } else if (selectedSet.has(item.id)) {
            action = { text: '提名者', theme: 'secondary' };
          }
          break;

        case ListMode.COTTAGE:
          if (item.type !== 'player') {
            action = 'none';
          } else if (selectedSet.has(item.id)) {
            action = { text: '离开', theme: 'danger' };
          }
          break;

        case ListMode.VOTING:
          if (selectedSet.has(item.id)) {
            action = { text: '切换', theme: 'info' };
          }
          break;
      }

      return { info, action, id: item.id };
    });

    const data: PlayersTemplateParams = {
      theme,
      header: `**玩家列表** (font)(城镇广场人数：${state.townsquareCount.value} / ${state.list.value.length})(font)[secondary]`,
      status,
      action,
      forceButton: true,
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

export default (state: Props) => $card(new CardRenderer(state, 100, 250, true));
