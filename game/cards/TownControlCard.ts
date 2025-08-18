import { $card, Card } from '../utils/card';

interface Props {
  name: string;
  invite: string;
  open: boolean;
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
                content: `**(font)${state.name}(font)[warning]** - 邀请连接：[${state.invite}](${state.invite})`,
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
                  theme: state.open ? 'warning' : 'info',
                  text: {
                    type: 'plain-text',
                    content: state.open ? '取消开放' : '开放小镇',
                  },
                  click: 'return-val',
                  value: state.open ? '[st]GameInviteOnly' : '[st]GameOpen',
                },
                {
                  type: 'button',
                  theme: 'warning',
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
              type: 'context',
              elements: [
                {
                  type: 'plain-text',
                  content: state.open ? '目前小镇对所有人开放' : '目前小镇只能通过邀请加入',
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
