import { BOT, GAME, LOG } from './bot.ts';
import { MUTES } from './game/utils/mutes.ts';
import { ROUTER } from './game/router.ts';
import { setGlobalErrorHandler } from './game/utils/error.ts';
import { onError as onQueueError } from './game/utils/queue.ts';

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
  BOT.disconnect();

  MUTES.destroy();
  ROUTER.destroy();
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

BOT.onMessageBtnClick(async (event) => {
  if (event.extra.body.value == 'createRoom') {
    const session = await ROUTER.createSession(event.extra.body.user_id);
    if (session) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      session.session.renderer['townControl'].open = true;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      session.session.renderer['townControl'].open = false;
      await new Promise((resolve) => setTimeout(resolve, 500));
      session.session.renderer['townControl'].open = true;
      await new Promise((resolve) => setTimeout(resolve, 500));
      session.session.renderer['townControl'].open = false;
      await new Promise((resolve) => setTimeout(resolve, 250));
      session.session.renderer['townControl'].open = true;
      session.session.renderer['townControl'].open = false;
      session.session.renderer['townControl'].open = true;

      ROUTER.removeSession(session.session);
    }
  }
});
