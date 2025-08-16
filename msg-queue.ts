import type { KookClient } from './lib/kook';

export interface MessageQueueCard {
  content: string;
  template_id?: string;
}

/** 维护消息更新，避免过量发送 与 Race Condition */
export class MessageQueue {
  private isRunning = false;
  private messages: {
    message: MessageQueueCard;
    resolve: () => void;
    reject: (reason?: any) => void;
  }[];

  private messageId: string;
  private bot: KookClient;

  constructor(bot: KookClient, messageId: string) {
    this.bot = bot;
    this.messageId = messageId;
    this.messages = [];
  }

  public update(message: MessageQueueCard) {
    return new Promise<void>((resolve, reject) => {
      this.messages.push({ message, resolve, reject });

      if (!this.isRunning) {
        this.run();
      }
    });
  }

  async run() {
    if (this.isRunning) return;

    this.isRunning = true;
    while (this.messages.length > 0) {
      const message = this.messages.shift();

      if (message) {
        // only send last message
        if (this.messages.length == 0) {
          try {
            await this.bot.api.messageUpdate({
              msg_id: this.messageId,
              content: message.message.content,
              template_id: message.message.template_id,
            });
          } catch (err) {
            // since we need this to not block, don't throw
            console.error(err);
          }
        }

        // resolve everything
        message.resolve();
      }
    }
    this.isRunning = false;
  }
}
