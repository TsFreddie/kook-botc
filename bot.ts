import { KookClient, type KookClientConfig } from './lib/kook.ts';
import { config as dotenv } from 'dotenv';
import { storytellerTwig } from './templates/storyteller.ts';
import { townsqareTwig } from './templates/townsquare.ts';
import type { GameConfig } from './types.ts';
import { Permission } from './lib/api.ts';

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

// 快捷日志消息
export const LOG = async (msg: string) => {
  if (!process.env.LOG_CHANNEL_ID) return;
  try {
    await bot.api.messageCreate({ target_id: process.env.LOG_CHANNEL_ID, content: msg });
  } catch (err) {
    console.error('💥 日志消息发送失败：', err);
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
    process.exit(1);
  }

  console.log(`🔄 已初始化身份组: ${storytellerRoleId}`);

  const channels = await bot.api.channelList({ guild_id });

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
    process.exit(1);
  }

  // 检查鸦木布拉夫分组是否有禁止查看权限，若没有则禁止
  const gameCategoryDeny =
    Permission.VIEW_CHANNELS | Permission.SEND_MESSAGES | Permission.ADD_REACTIONS;
  if (
    !gameCategory.permission_overwrites ||
    !gameCategory.permission_overwrites.some(
      (overwrite) =>
        overwrite.role_id == 0 && (overwrite.deny & gameCategoryDeny) == gameCategoryDeny,
    )
  ) {
    const overwrite = gameCategory.permission_overwrites?.find(
      (overwrite) => overwrite.role_id == 0,
    );

    await bot.api.channelRoleUpdate({
      channel_id: gameCategory.id,
      type: 'role_id',
      value: '0',
      deny: (overwrite?.deny || 0) | gameCategoryDeny,
      allow: overwrite?.allow || 0,
    });
  }

  console.log(`🔄 已初始化鸦木布拉夫分组: ${gameCategory.id}`);

  // 检查是否存在"小屋"分组，没有的话创建一个
  let cottageCategory;

  for (const channel of channels.items) {
    if (channel.is_category && channel.name === '小屋') {
      cottageCategory = channel;
      break;
    }
  }

  if (!cottageCategory) {
    const category = await bot.api.channelCreate({
      guild_id,
      name: '小屋',
      is_category: 1,
    });
    cottageCategory = category;
  }

  if (!cottageCategory) {
    console.error('❌ 小屋分组初始化失败...');
    process.exit(1);
  }

  // 检查小屋分组是否有禁止查看权限，若没有则禁止
  const cottageCategoryDeny = Permission.VIEW_CHANNELS;
  if (
    !cottageCategory.permission_overwrites ||
    !cottageCategory.permission_overwrites.some(
      (overwrite) =>
        overwrite.role_id == 0 && (overwrite.deny & cottageCategoryDeny) == cottageCategoryDeny,
    )
  ) {
    const overwrite = cottageCategory.permission_overwrites?.find(
      (overwrite) => overwrite.role_id == 0,
    );

    await bot.api.channelRoleUpdate({
      channel_id: cottageCategory.id,
      type: 'role_id',
      value: '0',
      deny: (overwrite?.deny || 0) | cottageCategoryDeny,
      allow: overwrite?.allow || 0,
    });
  }

  console.log(`🔄 已初始化小屋分组: ${cottageCategory.id}`);

  // 检查是否存在"游戏房间"分组，没有的话创建一个
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
    process.exit(1);
  }

  // 检查游戏房间是否有禁止语音连接权限，若没有则禁止
  if (
    !roomCategory.permission_overwrites ||
    !roomCategory.permission_overwrites.some(
      (overwrite) => overwrite.role_id === 0 && !!(overwrite.deny & Permission.CONNECT_VOICE),
    )
  ) {
    const overwrite = roomCategory.permission_overwrites?.find(
      (overwrite) => overwrite.role_id === 0 && !!(overwrite.deny & Permission.CONNECT_VOICE),
    );

    await bot.api.channelRoleUpdate({
      channel_id: roomCategory.id,
      type: 'role_id',
      value: '0',
      deny: (overwrite?.deny || 0) | Permission.CONNECT_VOICE,
      allow: overwrite?.allow || 0,
    });
  }

  console.log(`🔄 已初始化游戏房间分组: ${roomCategory.id}`);

  LOG('✅ 机器人已上线');

  return {
    guildId: guild_id,
    storytellerRoleId: storytellerRoleId,
    roomCategoryId: roomCategory.id,
    gameCategoryId: gameCategory.id,
    cottageCategoryId: cottageCategory.id,
    templates,
    assets,
  } satisfies GameConfig;
};

const promise = new Promise<GameConfig>(async (resolve) => {
  bot.on('ready', async () => {
    console.log('🔄 频道初始化中！');
    try {
      resolve(await initialize());
    } catch (error) {
      console.error('💥 机器人启动失败:', error);
    }

    console.log('✅ 机器人已就位！');
  });

  await bot.connect();
});

export const BOT = bot;
export const GAME = await promise;
