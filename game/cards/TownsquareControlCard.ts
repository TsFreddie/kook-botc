import { $card, Card } from '../utils/card';
import { GAME } from '../../bot';
import { Phase } from '../session';
import type { CValue } from '../utils/state';
import type { ActionGroup } from '../../templates/types';
import { LOCATION_BUTTONS } from '../consts';

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
    let icon = state.phase.value === Phase.NIGHT ? '🌠' : '🌅';
    let image = GAME.assets[state.phase.value === Phase.NIGHT ? 'night' : 'day'];

    const groups: ActionGroup[] = [];

    switch (state.phase.value) {
      case Phase.WAITING_FOR_STORYTELLER:
        mode = `等待说书人`;
        status = '正在等待说书人加入游戏';
        break;
      case Phase.PREPARING:
        mode = `准备阶段`;
        status = '小镇正在准备中，请耐心等待说书人开始游戏';
        break;
      case Phase.NIGHT:
        mode = `夜晚阶段`;
        status = '夜幕降临，你回到了自己的小屋';
        break;
      case Phase.DAY:
        mode = `白天阶段 - 广场集会`;
        status = '你和其他镇民们聚集在城镇广场\n(font)可以自由发言和讨论(font)[info]';
        break;
      case Phase.ROAMING:
        mode = `白天阶段 - 自由活动`;
        status = '现在是自由活动时间\n(font)你可以前往其他地点了(font)[info]\n> 那么？要去哪里吗？';
        groups.push(...LOCATION_BUTTONS);
        break;
    }

    return {
      content: JSON.stringify({
        image,
        status: `**(font)${icon} 城镇广场(font)[warning]** (font)${mode}(font)[secondary]\n${status}`,
        invite: state.invite.value,
        groups: groups,
      }),
      template_id: GAME.templates.townsquare,
    };
  }
}

export default (state: Props) => $card(new CardRenderer(state));
