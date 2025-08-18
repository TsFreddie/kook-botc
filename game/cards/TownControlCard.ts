import { $card, Card } from '../utils/card';
import type { CValue } from '../utils/state';

interface Props {
  name: CValue<string>;
  invite: CValue<string>;
  open: CValue<boolean>;
}

/**
 * 小镇管理工具
 */
class CardRenderer extends Card<Props> {
  render(state: Props) {
    return {
      content: JSON.stringify([
        {
          type: 'card',
          theme: 'secondary',
          size: 'lg',
          modules: [
            {
              type: 'section',
              text: {
                type: 'kmarkdown',
                content: `**(font)${state.name.value}(font)[warning]** - 邀请连接：[${state.invite.value}](${state.invite.value})`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'kmarkdown',
                content:
                  '> (font)游戏过程中请始终查看该频道，否则可能会错过重要消息(font)[secondary]\n> (font)若不小心退出了语音，可以使用邀请连接重新进入城镇广场语音(font)[secondary]',
              },
            },
            {
              type: 'action-group',
              elements: [
                {
                  type: 'button',
                  theme: state.open.value ? 'warning' : 'info',
                  text: {
                    type: 'plain-text',
                    content: state.open.value ? '取消开放' : '开放小镇',
                  },
                  click: 'return-val',
                  value: state.open.value ? '[st]GameInviteOnly' : '[st]GameOpen',
                },
                {
                  type: 'button',
                  theme: 'success',
                  text: {
                    type: 'plain-text',
                    content: '重新开始',
                  },
                  click: 'return-val',
                  value: '[st]GameRestart',
                },
                {
                  type: 'button',
                  theme: 'danger',
                  text: {
                    type: 'plain-text',
                    content: '拆除',
                  },
                  click: 'return-val',
                  value: '[st]GameDelete',
                },
              ],
            },
            {
              type: 'divider',
            },
            {
              type: 'section',
              text: {
                type: 'kmarkdown',
                content:
                  '(font)若玩家白天没能加入广场或晚上没能回到小屋(font)[secondary]\n(font)可以按这个按钮强制修正(font)[secondary]',
              },
              mode: 'right',
              accessory: {
                type: 'button',
                theme: 'primary',
                text: {
                  type: 'plain-text',
                  content: '频道修正',
                },
                click: 'return-val',
                value: '[st]ForceVoiceChannel',
              },
            },
            {
              type: 'divider',
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'plain-text',
                  content: state.open.value ? '目前小镇对所有人开放' : '目前小镇只能通过邀请加入',
                },
              ],
            },
          ],
        },
      ]),
    };
  }
}

export default (state: Props) => $card(new CardRenderer(state));
