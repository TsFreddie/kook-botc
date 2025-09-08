import { BOT, LOG } from './bot.ts';
import { MUTES } from './game/utils/mutes.ts';
import { ROUTER } from './game/router.ts';
import { setGlobalErrorHandler } from './game/utils/error.ts';
import { onError as onQueueError } from './game/utils/queue.ts';
import { ApiMessageType } from './lib/api.ts';
import { introCard } from './templates/intro.ts';
import { createActionCard, createdCard, creatingInfo, existedCard } from './templates/create.ts';
import type { TextMessageEvent } from './lib/events.ts';
import { MessageType } from './lib/events.ts';

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

const processCardSend = async (event: TextMessageEvent) => {
  if (!process.env.ADMIN_ID || event.author_id !== process.env.ADMIN_ID) {
    return;
  }

  if (event.type !== MessageType.CARD) {
    return;
  }

  // Card message - check if first module is context with /send
  try {
    const cards = JSON.parse(event.content);
    if (Array.isArray(cards) && cards.length > 0) {
      const firstCard = cards[0];
      if (firstCard.modules && Array.isArray(firstCard.modules) && firstCard.modules.length > 0) {
        const firstModule = firstCard.modules[0];
        if (
          firstModule.type === 'context' &&
          firstModule.elements &&
          Array.isArray(firstModule.elements) &&
          firstModule.elements.length > 0
        ) {
          const firstElement = firstModule.elements[0];
          if (firstElement.content === '/send') {
            // Delete the original message
            await BOT.api.messageDelete({ msg_id: event.msg_id });

            // Create card without the first module
            const remainingModules = firstCard.modules.slice(1);
            if (remainingModules.length > 0) {
              const modifiedCard = {
                ...firstCard,
                modules: remainingModules,
              };
              await BOT.api.messageCreate({
                target_id: event.target_id,
                type: ApiMessageType.CARD,
                content: JSON.stringify([modifiedCard]),
              });
            }
          }
        }
      }
    }
  } catch (error) {
    // If parsing fails, ignore
    return;
  }
};

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

  // 处理卡片 /send 指令
  await processCardSend(event);

  // 处理 /setup 指令
  await processAdminCommand(event);
});

// 创建房间逻辑
const createRoom = async (user: string, message: string, isPrivate: boolean = false) => {
  // 更新消息为创建中
  await BOT.api.messageUpdate({
    msg_id: message,
    content: JSON.stringify(creatingInfo),
    temp_target_id: user,
  });

  const result = await ROUTER.createSession(user, !isPrivate);
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

function parseButtonValue(value: string, prefix: string) {
  const actionPart = value.slice(prefix.length);
  const [actionName, ...args] = actionPart.split('|');
  return { actionName, args };
}

// 按钮点击处理器
BOT.onMessageBtnClick(async (event) => {
  const value = event.extra.body.value;

  if (value.startsWith('[rt]')) {
    // Router 事件
    const { actionName, args } = parseButtonValue(value, '[rt]');
    const handlerName = 'action' + actionName;
    const userId = event.extra.body.user_id;
    const channelId = event.extra.body.target_id;
    const handler = (ROUTER as any)[handlerName];
    if (handler && typeof handler === 'function') {
      await handler.call(ROUTER, userId, channelId, ...args);
    }
    return;
  }

  if (value.startsWith('[st]')) {
    // 说书人操作
    const session = ROUTER.getSessionByChannelId(event.extra.body.target_id);
    if (!session) return;

    // 检查会话是否被锁定
    if (session.isLocked) return;

    const { actionName, args } = parseButtonValue(value, '[st]');
    const handlerName = 'storyteller' + actionName;
    const handler = (session as any)[handlerName];
    if (handler && typeof handler === 'function') {
      await handler.call(session, event.extra.body.user_id, ...args);
    }
    return;
  }

  if (value.startsWith('[pl]')) {
    // 玩家操作，必须玩家在会话中才能操作
    const userSession = ROUTER.getSessionByUserId(event.extra.body.user_id);
    if (!userSession) return;

    // 检查会话是否被锁定
    if (userSession.isLocked) return;

    // 只有在玩家所在的频道才能响应
    const channelSession = ROUTER.getSessionByChannelId(event.extra.body.target_id);
    if (userSession !== channelSession) return;

    // 说书人不能使用玩家操作
    if (event.extra.body.user_id === userSession.storytellerId) {
      return;
    }

    const { actionName, args } = parseButtonValue(value, '[pl]');
    const handlerName = 'player' + actionName;
    const userId = event.extra.body.user_id;
    const handler = (userSession as any)[handlerName];
    if (handler && typeof handler === 'function') {
      await handler.call(userSession, userId, ...args);
    }
    return;
  }

  if (value.startsWith('[lc]')) {
    // 位置移动
    const userSession = ROUTER.getSessionByUserId(event.extra.body.user_id);
    if (!userSession) return;

    // 检查会话是否被锁定
    if (userSession.isLocked) return;

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

    // 检查会话是否被锁定
    if (session.isLocked) return;

    const [action, targetUserId] = value.slice(4).split('|');
    if (!action || !targetUserId) return;

    const handlerName = 'storytellerSelect' + action;
    const handler = (session as any)[handlerName];
    if (handler && typeof handler === 'function') {
      await handler.call(session, targetUserId, event.extra.body.user_id);
    }
    return;
  }

  switch (value) {
    case 'createRoom':
      await createRoom(event.extra.body.user_id, event.extra.body.msg_id);
      break;
    case 'createPublicRoom':
      await createRoom(event.extra.body.user_id, event.extra.body.msg_id, false);
      break;
    case 'createPrivateRoom':
      await createRoom(event.extra.body.user_id, event.extra.body.msg_id, true);
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
