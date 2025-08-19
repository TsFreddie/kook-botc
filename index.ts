import { BOT, LOG } from './bot.ts';
import { MUTES } from './game/utils/mutes.ts';
import { ROUTER } from './game/router.ts';
import { setGlobalErrorHandler } from './game/utils/error.ts';
import { onError as onQueueError } from './game/utils/queue.ts';
import { ApiMessageType } from './lib/api.ts';
import { introCard } from './templates/intro.ts';
import { createActionCard, createdCard, creatingInfo, existedCard } from './templates/create.ts';
import type { TextMessageEvent } from './lib/events.ts';

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
  console.error('💥 未处理的异步异常:', reason);
  LOG(`💥 未处理的异步异常：${reason instanceof Error ? reason.message : String(reason)}`);
  shutdown();
});

const processAdminCommand = async (event: TextMessageEvent) => {
  if (process.env.ADMIN_ID) {
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
      content: JSON.stringify(createActionCard),
    });
  }
};

const routeMessage = (event: TextMessageEvent) => {
  const channel = event.target_id;
  const user = event.author_id;
  const userSession = ROUTER.getSessionByUserId(user);
  // 说书人在说书人文本频道发言才可以托梦
  if (
    !userSession ||
    userSession.storytellerId !== user ||
    userSession.renderer.storytellerChannelId !== channel
  )
    return;

  // 通知会话处理说书人消息
  userSession.handleStorytellerMessage(event);
};

BOT.onTextMessage(async (event) => {
  // 快速跳过机器人消息
  if (event.extra.author.bot) return;

  // 处理托梦
  routeMessage(event);

  // 处理 /setup 指令
  await processAdminCommand(event);
});

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
        createdCard(session.renderer.name.value, session.renderer.storytellerChannelId),
      ),
      temp_target_id: user,
    });
  } else {
    // 已存在的会话，更新为指南消息
    await BOT.api.messageUpdate({
      msg_id: message,
      content: JSON.stringify(
        existedCard(session.renderer.name.value, session.renderer.storytellerChannelId),
      ),
      temp_target_id: user,
    });
  }
};

// 按钮点击处理器
BOT.onMessageBtnClick(async (event) => {
  const value = event.extra.body.value;

  if (value.startsWith('[rt]')) {
    // Router 事件
    const handlerName = 'action' + value.slice(4); // Convert [rt]GameLeave to actionGameLeave
    const userId = event.extra.body.user_id;
    const channelId = event.extra.body.target_id;
    const handler = (ROUTER as any)[handlerName];
    if (handler && typeof handler === 'function') {
      await handler.call(ROUTER, userId, channelId);
    }
    return;
  }

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
    // 玩家操作，必须玩家在会话中才能操作
    const userSession = ROUTER.getSessionByChannelId(event.extra.body.user_id);
    if (!userSession) return;

    // 只有在玩家所在的频道才能响应
    const channelSession = ROUTER.getSessionByChannelId(event.extra.body.target_id);
    if (userSession !== channelSession) return;

    // 说书人不能使用玩家操作
    if (event.extra.body.user_id === userSession.storytellerId) {
      return;
    }

    const handlerName = 'player' + value.slice(4); // Convert [pl]GameLeave to playerGameLeave
    const userId = event.extra.body.user_id;
    const handler = (userSession as any)[handlerName];
    if (handler && typeof handler === 'function') {
      await handler.call(userSession, userId);
    }
    return;
  }

  if (value.startsWith('[lc]')) {
    // 位置移动
    const userSession = ROUTER.getSessionByUserId(event.extra.body.user_id);
    if (!userSession) return;
    const channelSession = ROUTER.getSessionByChannelId(event.extra.body.target_id);

    // 只有在玩家所在的频道才能移动
    if (userSession !== channelSession) return;

    const location = Number(value.slice(4));
    if (isNaN(location)) return;

    userSession.locationSet(event.extra.body.user_id, location);
    return;
  }

  if (value.startsWith('[sp]')) {
    // 说书人玩家列表操作
    // 只要能访问就能按
    const session = ROUTER.getSessionByChannelId(event.extra.body.target_id);
    if (!session) return;

    const [action, userId] = value.slice(4).split('|');
    if (!action || !userId) return;

    const handlerName = 'storytellerSelect' + action;
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

  ROUTER.systemUserJoinVoiceChannel(user, channel);
});

// 语音频道退出事件处理器
BOT.onExitedChannel(async (event) => {
  const user = event.extra.body.user_id;

  ROUTER.systemUserLeaveVoiceChannel(user);
});
