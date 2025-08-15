import { ApiChannelType, ApiMessageType, Permission } from './lib/api.ts';
import { KookClient, type KookClientConfig } from './lib/kook.ts';
import { config as dotenv } from 'dotenv';
import { introCard } from './templates/intro.ts';
import { createdCard } from './templates/created.ts';

dotenv({ quiet: true });

if (!process.env.KOOK_TOKEN) {
  console.log('KOOK Token 未设置');
  process.exit(1);
}

if (!process.env.GUILD_ID) {
  console.log('KOOK 频道 ID 未设置');
  process.exit(1);
}

const guild_id = process.env.GUILD_ID;

const config: KookClientConfig = {
  token: process.env.KOOK_TOKEN,
  compress: true,
  autoReconnect: true,
  debug: process.env.BOT_DEBUG == 'true',
};

const bot = new KookClient(config);

// Event handlers
bot.on('connecting', () => {
  console.log('🔄 正在连接 Kook...');
});

bot.on('connected', () => {
  console.log('🔗 连接已建立！');
});

/** 机器人是否就位，未就位的情况下不会执行任何操作 */
let READY = false;

bot.on('ready', async () => {
  console.log('🔄 频道初始化中！');
  try {
    await initialize();
  } catch (error) {
    console.error('💥 机器人启动失败:', error);
  }

  console.log('✅ 机器人已就位！');
});

bot.on('error', (error) => {
  console.error('💥 机器人错误:', error);
  log(`💥 机器人发生错误：${error.message}`);
  shutdown();
});

// Handle graceful shutdown
let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n🛑 正在关闭机器人...');
  log('🛑 机器人已下线');
  bot.disconnect();
  await cleanup();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await bot.connect();

// 快捷日志消息
const log = async (msg: string) => {
  if (!process.env.LOG_CHANNEL_ID) return;
  try {
    await bot.api.messageCreate({ target_id: process.env.LOG_CHANNEL_ID, content: msg });
  } catch (err) {
    console.error('💥 日志消息发送失败：', err);
  }
};

interface GameConfig {
  inGameRoleId: number;
  roomCategoryId: string;
  gameCategoryId: string;
}

// 配置机器人监听
const setupListeners = (config: GameConfig) => {
  if (process.env.ADMIN_ID) {
    // 仅在有管理员ID的情况下监听
    bot.onTextMessage(async (event) => {
      if (event.author_id !== process.env.ADMIN_ID || event.content !== '/setup') {
        // 只监听 /setup 指令
        return;
      }

      // 删除消息
      await bot.api.messageDelete({ msg_id: event.msg_id });

      // 发送模版消息
      await bot.api.messageCreate({
        target_id: event.target_id,
        type: ApiMessageType.CARD,
        content: JSON.stringify(introCard),
      });
    });
  }

  /** 创建房间 */
  const createRoom = async (target_id: string, user: string) => {
    // 生成随机5位数字，用0填充
    const randomNumber = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0');
    const roomName = `组团 ${randomNumber}`;

    // 创建主页面文本频道
    const text = await bot.api.channelCreate({
      guild_id,
      name: roomName,
      type: ApiChannelType.TEXT,
      parent_id: config.gameCategoryId,
    });

    // 创建大厅语音频道
    const voice = await bot.api.channelCreate({
      guild_id,
      name: roomName,
      type: ApiChannelType.VOICE,
      limit_amount: 20,
      parent_id: config.roomCategoryId,
    });

    // 更新频道权限，拒绝所有人加入语音
    await bot.api.channelRoleUpdate({
      channel_id: voice.id,
      type: 'role_id',
      value: '0', // role id 0 表示 @everyone
      deny: Permission.CONNECT_VOICE,
    });

    // 创建频道邀请
    const invite = await bot.api.inviteCreate({
      channel_id: voice.id,
    });

    // 发送临时消息
    const msg = await bot.api.messageCreate({
      target_id: target_id,
      type: ApiMessageType.CARD,
      content: JSON.stringify(createdCard(roomName, 'https://teeworlds.cn')),
      temp_target_id: user,
    });

    // wait 3 seconds
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 删除消息
    await bot.api.messageDelete({ msg_id: msg.msg_id });
  };

  bot.onMessageBtnClick(async (event) => {
    switch (event.extra.body.value) {
      case 'createRoom':
        createRoom(event.extra.body.target_id, event.extra.body.user_id);
        break;
    }
  });
};

// 清理流程
const cleanup = async () => {
  if (!READY) return;

  READY = false;
};

// 初始化流程（配置身份组和频道分组）
const initialize = async () => {
  // 检查是否存在"游戏中"身份，没有的话创建一个
  const roles = await bot.api.roleList({ guild_id });

  let inGameRoleId = roles.items.filter((role) => role.name === '游戏中')[0]?.role_id;
  if (!inGameRoleId) {
    const role = await bot.api.roleCreate({ guild_id, name: '游戏中' });
    console.log(role);
    inGameRoleId = role.role_id;
  }

  if (!inGameRoleId) {
    console.error('❌ 身份组初始化失败...');
    shutdown();
    return;
  }

  console.log(`🔄 已初始化身份组: ${inGameRoleId}`);

  // 检查是否存在"游戏房间"分组，没有的话创建一个
  const channels = await bot.api.channelList({ guild_id });

  let roomCategory;

  for (const channel of channels.items) {
    if (channel.is_category && channel.name === '游戏房间') {
      roomCategory = channel;
      break;
    }
  }

  if (!roomCategory) {
    const category = await bot.api.channelCreate({
      guild_id,
      name: '游戏房间',
      is_category: 1,
    });
    roomCategory = category;
  }

  if (!roomCategory) {
    console.error('❌ 游戏房间分组初始化失败...');
    shutdown();
    return;
  }

  console.log(`🔄 已初始化游戏房间分组: ${roomCategory.id}`);

  // 检查分组是否禁用了身份组查看的权限，没有的话设置一下
  const roomPermissions = await bot.api.channelRoleIndex(roomCategory.id);
  let roomRole = roomPermissions.permission_overwrites.find(
    (overwrite) => overwrite.role_id === inGameRoleId,
  );
  if (!roomRole) {
    await bot.api.channelRoleCreate({
      channel_id: roomCategory.id,
      type: 'role_id',
      value: inGameRoleId.toString(),
    });
  }

  if (!roomRole || !(roomRole.deny & Permission.VIEW_CHANNELS)) {
    await bot.api.channelRoleUpdate({
      channel_id: roomCategory.id,
      type: 'role_id',
      value: inGameRoleId.toString(),
      deny: (roomRole?.deny || 0) | Permission.VIEW_CHANNELS,
    });
  }

  // 检查是否存在"鸦木布拉夫"分组，没有的话创建一个
  let gameCategory;

  for (const channel of channels.items) {
    if (channel.is_category && channel.name === '鸦木布拉夫') {
      gameCategory = channel;
      break;
    }
  }

  if (!gameCategory) {
    const category = await bot.api.channelCreate({
      guild_id,
      name: '鸦木布拉夫',
      is_category: 1,
    });
    gameCategory = category;
  }

  if (!gameCategory) {
    console.error('❌ 鸦木布拉夫分组初始化失败...');
    shutdown();
    return;
  }

  // 设置鸦木布拉夫分组权限
  const gamePermissions = await bot.api.channelRoleIndex(gameCategory.id);
  let gameRole = gamePermissions.permission_overwrites.find(
    (overwrite) => overwrite.role_id === inGameRoleId,
  );
  if (!gameRole) {
    await bot.api.channelRoleCreate({
      channel_id: gameCategory.id,
      type: 'role_id',
      value: inGameRoleId.toString(),
    });
  }

  if (!gameRole || !(gameRole.allow & Permission.VIEW_CHANNELS)) {
    await bot.api.channelRoleUpdate({
      channel_id: gameCategory.id,
      type: 'role_id',
      value: inGameRoleId.toString(),
      allow: (gameRole?.allow || 0) | Permission.VIEW_CHANNELS,
    });
  }

  let gameEveryoneRole = gamePermissions.permission_overwrites.find(
    (overwrite) => overwrite.role_id === 0,
  );

  if (!gameEveryoneRole || !(gameEveryoneRole.deny & Permission.VIEW_CHANNELS)) {
    await bot.api.channelRoleUpdate({
      channel_id: gameCategory.id,
      type: 'role_id',
      value: '0',
      deny: (gameEveryoneRole?.deny || 0) | Permission.VIEW_CHANNELS,
    });
  }

  console.log(`🔄 已初始化鸦木布拉夫分组: ${gameCategory.id}`);

  setupListeners({
    inGameRoleId,
    roomCategoryId: roomCategory.id,
    gameCategoryId: gameCategory.id,
  });
  READY = true;
  log('✅ 机器人已上线');
};
