export const inviteCard = (name: string, invite: string) => [
  {
    type: 'card',
    theme: 'secondary',
    size: 'lg',
    modules: [
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: `(font)已创建${name}(font)[success]，请在5分钟内通过邀请连接加入语音频道\n(font)加入语音后请回到此频道(font)[warning]\n(font)玩家可通过同样的邀请连接加入小镇(font)[secondary]`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: `邀请链接: [${invite}](${invite})`,
        },
      },
    ],
  },
];
