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
    let image = GAME.assets['banner_day'];

    const groups: ActionGroup[] = [];

    switch (state.phase.value) {
      case Phase.WAITING_FOR_STORYTELLER:
        mode = `(font)等待说书人(font)[secondary]`;
        status = '正在等待说书人加入游戏';
        break;
      case Phase.PREPARING:
        mode = `(font)准备阶段(font)[secondary]`;
        status = '小镇正在准备中，请耐心等待说书人开始游戏';
        break;
      case Phase.FINISH_GOOD:
        mode = `(font)游戏结束 -(font)[secondary] (font)善良阵营胜利(font)[info]`;
        status = '小镇里不再有恶魔作祟了';
        image = GAME.assets['banner_good'];
        break;
      case Phase.FINISH_BAD:
        mode = `(font)游戏结束 -(font)[secondary] (font)邪恶阵营胜利(font)[danger]`;
        status = '恶魔与爪牙已经彻底摧毁了小镇';
        image = GAME.assets['banner_bad'];
        break;
      case Phase.NIGHT:
        mode = `(font)夜晚阶段(font)[secondary]`;
        status = '夜幕降临，你回到了自己的小屋';
        image = GAME.assets['banner_night'];
        break;
      case Phase.DAY:
        mode = `(font)白天阶段 - 广场集会(font)[secondary]`;
        status = '你和其他镇民们聚集在城镇广场\n(font)可以自由发言和讨论(font)[info]';
        break;
      case Phase.ROAMING:
        mode = `(font)白天阶段 - 自由活动(font)[secondary]`;
        status = '现在是自由活动时间\n(font)你可以前往其他地点了(font)[info]\n> 那么？要去哪里吗？';
        image = GAME.assets['banner_roam'];
        groups.push(...LOCATION_BUTTONS);
        break;
    }

    return {
      content: JSON.stringify({
        image,
        status: `**(font)${icon} 城镇广场(font)[warning]** ${mode}\n${status}`,
        invite: state.invite.value,
        groups: groups,
      }),
      template_id: GAME.templates.townsquare,
    };
  }
}

export default (state: Props) => $card(new CardRenderer(state));
