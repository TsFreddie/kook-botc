import { $card, Card } from '../utils/card';
import { GAME } from '../../bot';
import { Phase } from '../session';
import type { CValue } from '../utils/state';

interface Props {
  invite: CValue<string>;
  phase: CValue<Phase>;
}

/**
 * 城镇广场控制台卡片
 */
class CardRenderer extends Card<Props> {
  render(state: Props) {
    let status: string = '';
    let mode: string = '';
    let buttons: any[] = [];
    let icon = state.phase.value === Phase.NIGHT ? '🌠' : '🌅';
    let image = GAME.assets[state.phase.value === Phase.NIGHT ? 'night' : 'day'];

    switch (state.phase.value) {
      case Phase.WAITING_FOR_STORYTELLER:
        mode = `等待说书人`;
        status = '等待说书人加入游戏';
        buttons = [];
        break;
      case Phase.PREPARING:
        mode = `准备阶段`;
        status = '小镇正在准备中，请耐心等待说书人开始游戏';
        buttons = [];
        break;
      case Phase.NIGHT:
        mode = `夜晚阶段`;
        status = '夜幕降临，镇民们回到各自的小屋休息';
        buttons = [];
        break;
      case Phase.DAY:
        mode = `白天阶段 - 广场集会`;
        status = '镇民们聚集在广场中进行讨论\n(font)可以自由发言和讨论(font)[info]';
        buttons = [];
        break;
      case Phase.ROAMING:
        mode = `白天阶段 - 自由活动`;
        status = '现在是自由活动时间\n(font)可以前往各地进行私下交流(font)[info]';
        buttons = [];
        break;
    }

    const buttonGroups: any[] = [];

    if (buttons.length > 0) {
      buttonGroups.push(buttons);
    }

    return {
      content: JSON.stringify({
        image,
        status: `**(font)${icon} 城镇广场(font)[warning]** (font)${mode}(font)[secondary]\n${status}`,
        invite: state.invite.value,
        groups: buttonGroups.length > 0 ? buttonGroups : undefined,
      }),
      template_id: GAME.templates.townsquare,
    };
  }
}

export default (state: Props) => $card(new CardRenderer(state));
