import { $card, Card } from '../utils/card';
import { GAME } from '../../bot';
import { Phase } from '../session';

interface Props {
  name: string;
  invite: string;
  phase: Phase;
  storytellerId: string;
}

/**
 * 说书人控制台卡片
 */
class CardRenderer extends Card<Props> {
  render(state: Props) {
    let status: string = '';
    let mode: string = '';
    let buttons: any[] = [];
    let met: string = '';
    let icon = state.phase === Phase.NIGHT ? '🌠' : '🌅';
    let image = GAME.assets[state.phase === Phase.NIGHT ? 'night' : 'day'];

    switch (state.phase) {
      case Phase.WAITING_FOR_STORYTELLER:
        mode = `等待说书人`;
        status = `已创建${state.name}，请说书人使用[邀请链接](${state.invite})加入语音\n(font)加入后请回到这个频道进行后续操作(font)[warning]`;
        buttons = [];
        break;
      case Phase.PREPARING:
        mode = `准备阶段`;
        met = ` (met)${state.storytellerId}(met)`;
        status =
          '小镇已就绪，在此发送的内容将转发给所有玩家\n(font)建议利用现在这个时机向玩家发送剧本和需要解释的规则等(font)[warning]';
        buttons = [
          { text: '⭐ 开始游戏', theme: 'info', value: '[st]GameStart' },
          { text: '踢出玩家', theme: 'info', value: '[st]ListKick' },
        ];
        break;
      case Phase.NIGHT:
        mode = `夜晚阶段`;
        status =
          '城镇广场空无一人，镇民回到各自小屋睡觉了\n(font)使用托梦功能为镇民提供信息，亦可前往小屋与镇民语音(font)[warning]';
        buttons = [
          { text: '🌅 黎明初生', theme: 'info', value: '[st]GameDay' },
          { text: '前往小屋', theme: 'success', value: '[st]ListGoto' },
        ];
        break;
      case Phase.DAY:
        mode = `白天阶段 - 广场集会`;
        status = '镇民聚集在广场中\n(font)使用发起投票功能可发起提名(font)[warning]';
        buttons = [
          { text: '🌄 夜幕降临', theme: 'info', value: '[st]GameNight' },
          { text: '自由活动', theme: 'primary', value: '[st]GameRoaming' },
          { text: '发起投票', theme: 'warning', value: '[st]ListVote' },
        ];
        break;
      case Phase.ROAMING:
        mode = `白天阶段 - 自由活动`;
        status =
          '现在是自由活动时间\n(font)你和镇民一样可以前往各地，同时你还可以前往玩家小屋(font)[warning]';
        buttons = [
          { text: '🌄 夜幕降临', theme: 'info', value: '[st]GameNight' },
          { text: '广场集会', theme: 'warning', value: '[st]GameDay' },
          { text: '前往小屋', theme: 'success', value: '[st]ListGoto' },
        ];
        break;
    }

    // Build button groups as simple arrays
    const buttonGroups: any[] = [];

    // Add phase-specific buttons if any
    if (buttons.length > 0) {
      buttonGroups.push(buttons);
    }

    // Always show utility buttons
    buttonGroups.push([
      { text: '状态', theme: 'primary', value: '[st]ListStatus' },
      { text: '托梦', theme: 'warning', value: '[st]ListPrivate' },
      { text: '换座', theme: 'info', value: '[st]ListSwap' },
      { text: '禁言', theme: 'success', value: '[st]ListMute' },
    ]);

    // Only show restart button when restart is allowed (not in early states)
    if (state.phase !== Phase.INITIALIZING && state.phase !== Phase.WAITING_FOR_STORYTELLER) {
      buttonGroups.push([
        { text: '重新开始', theme: 'danger', value: '[st]GameRestart' },
      ]);
    }

    console.log({
      content: JSON.stringify({
        image,
        status: `**(font)${icon} 说书人控制台(font)[warning]** (font)${mode}(font)[secondary]${met}\n${status}`,
        groups: buttonGroups,
      }),
      template_id: GAME.templates.storyteller,
    });

    return {
      content: JSON.stringify({
        image,
        status: `**(font)${icon} 说书人控制台(font)[warning]** (font)${mode}(font)[secondary]${met}\n${status}`,
        groups: buttonGroups,
      }) + "aistne",
      template_id: GAME.templates.storyteller,
    };
  }
}

export default (state: Props) => $card(new CardRenderer(state));
