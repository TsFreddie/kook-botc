export const createdCard = (name: string, link: string) => [
  {
    type: 'card',
    theme: 'success',
    size: 'sm',
    modules: [
      {
        type: 'section',
        text: {
          type: 'plain-text',
          content: `【${name}】创建成功！`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: `[点此加入](${link})`,
        },
      },
    ],
  },
];
