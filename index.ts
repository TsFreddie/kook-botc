import { BOT, LOG } from './bot.ts';
import { MUTES } from './game/utils/mutes.ts';
import { ROUTER } from './game/router.ts';
import { setGlobalErrorHandler } from './game/utils/error.ts';
import { onError as onQueueError } from './game/utils/queue.ts';
import { ApiMessageType } from './lib/api.ts';
import { introCard, introCardAction, creatingInfo } from './templates/intro.ts';
import { createdCard, existedCard } from './templates/created.ts';

BOT.on('error', (error) => {
  console.error('💥 机器人错误:', error);
  LOG(`💥 机器人发生错误：${error.message}`);
  shutdown();
});

// 设置全局错误处理器
setGlobalErrorHandler((error, context) => {
  const contextMsg = context ? ` (${context})` : '';
  console.error(`💥 全局错误${contextMsg}:`, error);
  LOG(`💥 全局错误${contextMsg}：${error.message}`);
  shutdown();
});

// 设置队列错误监听器
onQueueError((error) => {
  console.error('💥 队列错误:', error);
  LOG(`💥 队列发生错误：${error.message || String(error)}`);
  shutdown();
});

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;

  shuttingDown = true;
  console.log('\n🛑 正在关闭机器人...');
  LOG('🛑 机器人已下线');
  await MUTES.destroy();
  await ROUTER.destroy();
  BOT.disconnect();
};

// 处理进程信号
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// 处理未捕获的异常和Promise拒绝
process.on('uncaughtException', (error) => {
  console.error('💥 未捕获的异常:', error);
  LOG(`💥 未捕获的异常：${error.message}`);
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 未处理的Promise拒绝:', reason);
  LOG(`💥 未处理的Promise拒绝：${reason instanceof Error ? reason.message : String(reason)}`);
  shutdown();
});

// 文本消息处理器 - 处理 /setup 命令
if (process.env.ADMIN_ID) {
  BOT.onTextMessage(async (event) => {
    if (event.author_id !== process.env.ADMIN_ID || event.content !== '/setup') {
      return;
    }

    // 删除消息
    await BOT.api.messageDelete({ msg_id: event.msg_id });

    // 发送介绍卡片
    await BOT.api.messageCreate({
      target_id: event.target_id,
      type: ApiMessageType.CARD,
      content: JSON.stringify(introCard),
    });

    // 发送操作卡片
    await BOT.api.messageCreate({
      target_id: event.target_id,
      type: ApiMessageType.CARD,
      content: JSON.stringify(introCardAction),
    });
  });
}

// 创建房间逻辑
const createRoom = async (user: string, message: string) => {
  // 更新消息为创建中
  await BOT.api.messageUpdate({
    msg_id: message,
    content: JSON.stringify(creatingInfo),
    temp_target_id: user,
  });

  const result = await ROUTER.createSession(user);
  if (!result) return;

  const { session, isNew } = result;

  if (isNew) {
    // 新创建的会话，更新为导向消息
    await BOT.api.messageUpdate({
      msg_id: message,
      content: JSON.stringify(
        createdCard(session.renderer.name, session.renderer.storytellerChannelId),
      ),
      temp_target_id: user,
    });
  } else {
    // 已存在的会话，更新为指南消息
    await BOT.api.messageUpdate({
      msg_id: message,
      content: JSON.stringify(
        existedCard(session.renderer.name, session.renderer.storytellerChannelId),
      ),
      temp_target_id: user,
    });
  }
};

// 按钮点击处理器
BOT.onMessageBtnClick(async (event) => {
  const value = event.extra.body.value;

  if (value.startsWith('[st]')) {
    // 说书人操作
    const session = ROUTER.getSessionByChannelId(event.extra.body.target_id);
    if (!session) return;

    const handlerName = 'storyteller' + value.slice(4); // Convert [st]GameStart to storytellerGameStart
    const handler = (session as any)[handlerName];
    if (handler && typeof handler === 'function') {
      await handler.call(session);
    }
    return;
  }

  if (value.startsWith('[pl]')) {
    // 玩家操作
    const session = ROUTER.getSessionByChannelId(event.extra.body.target_id);
    if (!session) return;

    // 说书人不能使用玩家操作
    if (event.extra.body.user_id === session.storytellerId) {
      return;
    }

    const handlerName = 'player' + value.slice(4); // Convert [pl]GameLeave to playerGameLeave
    const userId = event.extra.body.user_id;
    const handler = (session as any)[handlerName];
    if (handler && typeof handler === 'function') {
      await handler.call(session, userId);
    }
    return;
  }

  switch (value) {
    case 'createRoom':
      await createRoom(event.extra.body.user_id, event.extra.body.msg_id);
      break;
  }
});

// 语音频道加入事件处理器
BOT.onJoinedChannel(async (event) => {
  const user = event.extra.body.user_id;
  const channel = event.extra.body.channel_id;

  const userSession = ROUTER.getSessionByUserId(user);
  const channelSession = ROUTER.getSessionByChannelId(channel);

  // 用户已经在游戏里了，且加入的是自己游戏的频道
  if (userSession && channelSession && userSession === channelSession) {
    // 通知玩家进入语音频道
    userSession.systemPlayerJoinVoiceChannel(user);
    return;
  }

  // 频道不属于任何游戏，不用管
  if (!channelSession) return;

  // 正在游戏中的玩家加入了另一个游戏的频道，踢出语音频道
  if (channelSession && userSession && userSession !== channelSession) {
    await BOT.api.channelKickout(channel, user);
    return;
  }

  // 用户不在游戏内，加入游戏
  try {
    ROUTER.addUserToSession(channelSession, user);
    channelSession.systemPlayerJoinVoiceChannel(user);
  } catch (error) {
    console.error('加入游戏失败:', error);
    // 如果加入失败，踢出语音频道
    await BOT.api.channelKickout(channel, user);
  }
});

// 语音频道退出事件处理器
BOT.onExitedChannel(async (event) => {
  const user = event.extra.body.user_id;
  const channel = event.extra.body.channel_id;

  const session = ROUTER.getSessionByChannelId(channel);
  if (!session) return;

  session.systemPlayerLeaveVoiceChannel(user);
});
