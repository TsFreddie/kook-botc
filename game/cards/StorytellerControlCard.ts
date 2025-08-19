import { $card, Card } from '../utils/card';
import { GAME } from '../../bot';
import { Phase } from '../session';
import type { CValue } from '../utils/state';
import type { ActionGroup } from '../../templates/types';
import { LOCATION_BUTTONS } from '../consts';

interface Props {
  name: CValue<string>;
  invite: CValue<string>;
  phase: CValue<Phase>;
  storytellerId: CValue<string>;
}

/**
 * 说书人控制台卡片
 */
class CardRenderer extends Card<Props> {
  render(state: Props) {
    let status: string = '';
    let mode: string = '';
    let met: string = '';
    let icon = state.phase.value === Phase.NIGHT ? '🌠' : '🌅';
    let image = GAME.assets[state.phase.value === Phase.NIGHT ? 'night' : 'day'];

    const groups: ActionGroup[] = [];

    switch (state.phase.value) {
      case Phase.WAITING_FOR_STORYTELLER:
        mode = `等待说书人`;
        status = `已创建${state.name.value}，请说书人使用[邀请链接](${state.invite.value})加入语音\n(font)加入后请回到这个频道进行后续操作(font)[warning]`;
        break;
      case Phase.PREPARING:
        mode = `准备阶段`;
        met = ` (met)${state.storytellerId.value}(met)`;
        status =
          '小镇已就绪，在频道中发送的内容将转发给所有玩家\n(font)建议利用现在这个时机向玩家发送剧本和需要解释的规则等(font)[warning]';
        groups.push([{ text: '⭐ 开始游戏', theme: 'info', value: '[st]GameStart' }]);
        break;
      case Phase.NIGHT:
        mode = `夜晚阶段`;
        status =
          '城镇广场空无一人，镇民回到各自小屋睡觉了\n(font)使用托梦功能为镇民提供信息，亦可前往小屋与镇民语音(font)[warning]';
        groups.push([{ text: '🌅 黎明', theme: 'info', value: '[st]GameDay' }]);
        break;
      case Phase.DAY:
        mode = `白天阶段 - 广场集会`;
        status = '镇民聚集在广场中\n(font)使用发起投票功能可发起提名(font)[warning]';
        groups.push([
          { text: '🌠 夜幕', theme: 'info', value: '[st]GameNight' },
          { text: '自由活动', theme: 'primary', value: '[st]GameRoaming' },
        ]);
        break;
      case Phase.ROAMING:
        mode = `白天阶段 - 自由活动`;
        status =
          '现在是自由活动时间\n(font)你和镇民一样可以前往各地，同时你还可以前往玩家小屋(font)[warning]';
        groups.push([
          { text: '🌠 夜幕', theme: 'info', value: '[st]GameNight' },
          { text: '广场集会', theme: 'warning', value: '[st]GameDay' },
        ]);
        groups.push(...LOCATION_BUTTONS);
        break;
    }

    return {
      content: JSON.stringify({
        image,
        status: `**(font)${icon} 说书人控制台(font)[warning]** (font)${mode}(font)[secondary]${met}\n${status}`,
        groups: groups,
      }),
      template_id: GAME.templates.storyteller,
    };
  }
}

export default (state: Props) => $card(new CardRenderer(state));
