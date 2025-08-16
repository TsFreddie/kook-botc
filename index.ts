import { ApiMessageType } from './lib/api.ts';
import { KookClient, type KookClientConfig } from './lib/kook.ts';
import { config as dotenv } from 'dotenv';
import { creatingInfo, introCard, introCardAction } from './templates/intro.ts';
import { createdCard, existedCard } from './templates/created.ts';
import { SessionRouter } from './manager.ts';
import type { GameConfig } from './types.ts';
import { GameStatus } from './game.ts';
import { storytellerTwig } from './templates/storyteller.ts';
import { townsqareTwig } from './templates/townsquare.ts';
import { AsyncQueue } from './async-queue.ts';

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

let GLOBAL_MANAGER: SessionRouter | undefined;

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

      // 发送模版消息
      await bot.api.messageCreate({
        target_id: event.target_id,
        type: ApiMessageType.CARD,
        content: JSON.stringify(introCardAction),
      });
    });
  }

  // 游戏会话管理
  const MANAGER = new SessionRouter(bot, config);
  GLOBAL_MANAGER = MANAGER;

  const asyncQueue = new AsyncQueue();

  /** 创建房间 */
  const createRoom = async (target: string, user: string, message: string) => {
    // 更新消息为创建中
    await bot.api.messageUpdate({
      msg_id: message,
      content: JSON.stringify(creatingInfo),
      temp_target_id: user,
    });

    // 同时只能创建一个房间
    const game = await asyncQueue.push(() => MANAGER.createGame(user));

    if (game.status === GameStatus.INITIALIZING) {
      // 初始化中，不要干任何事情
      return;
    }

    if (game.status === GameStatus.WAITING_FOR_STORYTELLER) {
      // 更新为导向消息
      await bot.api.messageUpdate({
        msg_id: message,
        content: JSON.stringify(createdCard(game.name, game.storytellerChannelId!)),
        temp_target_id: user,
      });
    } else {
      // 更新为指南消息
      await bot.api.messageUpdate({
        msg_id: message,
        content: JSON.stringify(existedCard(game.name, game.storytellerChannelId!)),
        temp_target_id: user,
      });
    }
  };

  bot.onMessageBtnClick(async (event) => {
    const value = event.extra.body.value;

    if (value.startsWith('[st]')) {
      // 尝试执行说书人操作，只要能点到就允许操作
      const game = MANAGER.getGameByChannelId(event.extra.body.target_id);
      const handlerName = value.slice(4);

      const handler = (game as any)[handlerName];
      if (handler && typeof handler === 'function') {
        await handler.call(game);
      }
      return;
    }

    switch (value) {
      case 'createRoom':
        await createRoom(
          event.extra.body.target_id,
          event.extra.body.user_id,
          event.extra.body.msg_id,
        );
        break;
    }
  });

  bot.onJoinedChannel(async (event) => {
    const user = event.extra.body.user_id;
    const channel = event.extra.body.channel_id;
    const userGame = MANAGER.getGameByUserId(user);
    // 用户已经在游戏里了，暂时不需要处理任何事情
    if (userGame && userGame.isGameChannel(channel)) {
      // 通知玩家加入游戏频道
      await userGame.joinChannel(user);
      return;
    }

    const game = MANAGER.getGameByChannelId(channel);
    // 频道不属于任何游戏，不用管
    if (!game) return;

    // 正在游戏中的玩家加入了另一个游戏的频道，踢出语音频道
    if (game && userGame) {
      await bot.api.channelKickout(channel, user);
      return;
    }

    // 用户不在游戏内，加入游戏
    await game.joinGame(event.extra.body.user_id);
  });

  bot.onExitedChannel(async (event) => {
    const user = event.extra.body.user_id;
    const channel = event.extra.body.channel_id;
    const game = MANAGER.getGameByChannelId(channel);
    if (!game) return;

    await game.leaveChannel(user);
  });
};

// 清理流程
const cleanup = async () => {
  if (!READY) return;
  READY = false;

  if (GLOBAL_MANAGER) {
    await GLOBAL_MANAGER.cleanup();
  }
};

// 初始化流程（配置身份组和频道分组）
const initialize = async () => {
  // 上传 Assets 文件夹
  let existingAssets: Record<string, string> | null = null;

  try {
    existingAssets = JSON.parse(await Bun.file('.assets.json').text());
  } catch (e) {}

  const uploadAsset = async (name: string, filename: string) => {
    if (existingAssets && existingAssets[name]) {
      return existingAssets[name];
    }

    const file = Bun.file(`./assets/${filename}`);
    const response = await bot.api.assetCreate({ file });
    console.log(`🔄 已上传素材: ${name}(${filename})`);
    return response.url;
  };

  const assets = {
    day: await uploadAsset('day', 'banner_day.png'),
    night: await uploadAsset('night', 'banner_night.png'),
  };

  // 保存 Assets 数据
  await Bun.write('.assets.json', JSON.stringify(assets));
  console.log(`🔄 已初始化素材`);

  // 检查是否存在模版
  const templateList = await bot.api.templateList();
  const templateMap = new Map(templateList.items.map((template) => [template.title, template]));

  const checkOrCreateTwig = async (name: string, content: () => Promise<string>) => {
    const template = templateMap.get(name);
    const text = await content();

    if (template) {
      if (template.content === text) {
        return template.id;
      }

      await bot.api.templateUpdate({
        id: template.id,
        content: await content(),
      });

      console.log(`🔄 已更新模版: ${name}`);
      return template.id;
    }

    const newTemplate = await bot.api.templateCreate({
      title: name,
      content: await content(),
      type: 0,
      msgtype: 2,
    });

    console.log(`🔄 已创建模版: ${name}`);
    return newTemplate.model.id;
  };

  // 处理模版ID
  const templates = {
    storyteller: await checkOrCreateTwig('storyteller', storytellerTwig),
    townsquare: await checkOrCreateTwig('townsquare', townsqareTwig),
  };

  console.log(`🔄 已初始化消息模版`);

  // 检查是否存在"说书人"身份，没有的话创建一个
  const roles = await bot.api.roleList({ guild_id });

  let storytellerRoleId = roles.items.filter((role) => role.name === '说书人')[0]?.role_id;
  if (!storytellerRoleId) {
    const role = await bot.api.roleCreate({ guild_id, name: '说书人' });
    console.log(role);
    storytellerRoleId = role.role_id;
  }

  if (!storytellerRoleId) {
    console.error('❌ 身份组初始化失败...');
    shutdown();
    return;
  }

  console.log(`🔄 已初始化身份组: ${storytellerRoleId}`);

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

  setupListeners({
    guildId: guild_id,
    storytellerRoleId: storytellerRoleId,
    roomCategoryId: roomCategory.id,
    templates,
    assets,
  });
  READY = true;
  log('✅ 机器人已上线');
};
