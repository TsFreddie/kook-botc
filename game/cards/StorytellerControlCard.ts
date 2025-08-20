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
    let icon = state.phase.value === Phase.NIGHT ? '🌠' : '🌅';
    let image = GAME.assets['banner_day'];

    const groups: ActionGroup[] = [];

    switch (state.phase.value) {
      case Phase.WAITING_FOR_STORYTELLER:
        mode = `(font)等待说书人(font)[secondary]`;
        status = `已创建${state.name.value}，请说书人使用[邀请链接](${state.invite.value})加入语音\n(font)加入后请回到这个频道进行后续操作(font)[warning]`;
        break;
      case Phase.FINISH_GOOD:
      case Phase.FINISH_BAD:
      case Phase.PREPARING:
        switch (state.phase.value) {
          case Phase.FINISH_GOOD:
            mode = `(font)游戏结束 -(font)[secondary] (font)善良阵营胜利(font)[info]`;
            status = '游戏已结束\n(font)玩家的托梦数据与存活状态已被重置(font)[warning]';
            image = GAME.assets['banner_good'];
            break;
          case Phase.FINISH_BAD:
            mode = `(font)游戏结束 -(font)[secondary] (font)邪恶阵营胜利(font)[danger]`;
            status = '游戏已结束\n(font)玩家的托梦数据与存活状态已被重置(font)[warning]';
            image = GAME.assets['banner_bad'];
            break;
          default:
            mode = `(font)准备阶段(font)[secondary]`;
            status =
              '小镇已就绪，在频道中发送的内容将转发给所有玩家\n(font)建议利用现在这个时机向玩家发送剧本和需要解释的规则等(font)[warning]';
            break;
        }
        groups.push([
          { text: '🌠 开始', theme: 'info', value: '[st]GameStart' },
          { text: '　', theme: 'secondary' },
          state.phase.value == Phase.FINISH_GOOD
            ? { text: '　', theme: 'secondary' }
            : { text: '好人胜利', theme: 'info', value: '[st]GameRestart|good' },
          state.phase.value == Phase.FINISH_BAD
            ? { text: '　', theme: 'secondary' }
            : { text: '坏人胜利', theme: 'danger', value: '[st]GameRestart|bad' },
        ]);
        break;
      case Phase.NIGHT:
        mode = `(font)夜晚阶段(font)[secondary]`;
        status =
          '城镇广场空无一人，镇民回到各自小屋睡觉了\n(font)使用托梦功能为镇民提供信息，亦可前往小屋与镇民语音(font)[warning]';
        image = GAME.assets['banner_night'];
        groups.push([
          { text: '🌅 黎明', theme: 'info', value: '[st]GameDay' },
          { text: '　', theme: 'secondary' },
          { text: '好人胜利', theme: 'info', value: '[st]GameRestart|good' },
          { text: '坏人胜利', theme: 'danger', value: '[st]GameRestart|bad' },
        ]);
        break;
      case Phase.DAY:
        mode = `(font)白天阶段 - 广场集会(font)[secondary]`;
        status = '镇民聚集在广场中\n(font)使用发起投票功能可发起提名(font)[warning]';
        groups.push([
          { text: '🌠 夜幕', theme: 'info', value: '[st]GameNight' },
          { text: '自由活动', theme: 'success', value: '[st]GameRoaming' },
          { text: '好人胜利', theme: 'info', value: '[st]GameRestart|good' },
          { text: '坏人胜利', theme: 'danger', value: '[st]GameRestart|bad' },
        ]);
        break;
      case Phase.ROAMING:
        mode = `(font)白天阶段 - 自由活动(font)[secondary]`;
        status =
          '现在是自由活动时间\n(font)你和镇民一样可以前往各地，同时你还可以前往玩家小屋(font)[warning]';
        image = GAME.assets['banner_roam'];
        groups.push([
          { text: '🌠 夜幕', theme: 'info', value: '[st]GameNight' },
          { text: '广场集会', theme: 'warning', value: '[st]GameDay' },
          { text: '好人胜利', theme: 'info', value: '[st]GameRestart|good' },
          { text: '坏人胜利', theme: 'danger', value: '[st]GameRestart|bad' },
        ]);
        groups.push(...LOCATION_BUTTONS);
        break;
    }

    return {
      content: JSON.stringify({
        image,
        status: `**(font)${icon} 说书人控制台(font)[warning]** ${mode}\n${status}`,
        groups: groups,
      }),
      template_id: GAME.templates.storyteller,
    };
  }
}

export default (state: Props) => $card(new CardRenderer(state));
