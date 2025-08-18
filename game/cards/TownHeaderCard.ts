import { $card, Card } from '../utils/card';
import type { CValue } from '../utils/state';

interface Props {
  name: CValue<string>;
  invite: CValue<string>;
}

/**
 * 小镇标题，带退出按钮
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
                content: `**(font)${state.name.value}(font)[warning]**`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'kmarkdown',
                content: `> (font)游戏过程中请始终查看该频道，否则可能会错过重要消息(font)[secondary]\n> (font)若不小心退出了语音，可以点(font)[secondary][这里](${state.invite.value}})(font)重新进入城镇广场语音(font)[secondary]`,
              },
            },
            {
              type: 'action-group',
              elements: [
                {
                  type: 'button',
                  theme: 'danger',
                  text: {
                    type: 'plain-text',
                    content: '离开小镇',
                  },
                  click: 'return-val',
                  value: '[pl]GameLeave',
                },
              ],
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'plain-text',
                  content: '友善交流，文明游戏',
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
