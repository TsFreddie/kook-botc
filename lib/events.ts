// Kook Event Type Definitions
// Based on official documentation: https://developer.kookapp.cn/doc/event/event-introduction

/**
 * Channel types for events
 */
export enum ChannelType {
  GROUP = 'GROUP', // Group/Guild channel
  PERSON = 'PERSON', // Direct message
  BROADCAST = 'BROADCAST', // Broadcast message
}

/**
 * Message types
 */
export enum MessageType {
  TEXT = 1, // Text message
  IMAGE = 2, // Image message
  VIDEO = 3, // Video message
  FILE = 4, // File message
  AUDIO = 8, // Audio message
  KMARKDOWN = 9, // KMarkdown message
  CARD = 10, // Card message
  SYSTEM = 255, // System message
}

/**
 * System event types
 */
export enum SystemEventType {
  // User events
  JOINED_CHANNEL = 'joined_channel',
  EXITED_CHANNEL = 'exited_channel',
  USER_UPDATED = 'user_updated',
  SELF_JOINED_GUILD = 'self_joined_guild',
  SELF_EXITED_GUILD = 'self_exited_guild',
  MESSAGE_BTN_CLICK = 'message_btn_click',

  // Guild events
  UPDATED_GUILD = 'updated_guild',
  DELETED_GUILD = 'deleted_guild',
  ADDED_BLOCK_LIST = 'added_block_list',
  DELETED_BLOCK_LIST = 'deleted_block_list',
  ADDED_EMOJI = 'added_emoji',
  REMOVED_EMOJI = 'removed_emoji',
  UPDATED_EMOJI = 'updated_emoji',

  // Channel events
  ADDED_REACTION = 'added_reaction',
  DELETED_REACTION = 'deleted_reaction',
  UPDATED_MESSAGE = 'updated_message',
  DELETED_MESSAGE = 'deleted_message',
  ADDED_CHANNEL = 'added_channel',
  UPDATED_CHANNEL = 'updated_channel',
  DELETED_CHANNEL = 'deleted_channel',
  PINNED_MESSAGE = 'pinned_message',
  UNPINNED_MESSAGE = 'unpinned_message',
}

/**
 * Base event structure
 */
export interface BaseEvent {
  channel_type: ChannelType;
  type: MessageType;
  target_id: string;
  author_id: string;
  content: string;
  msg_id: string;
  msg_timestamp: number;
  nonce: string;
  verify_token?: string;
  extra?: any; // Extra data varies by event type
}

/**
 * User information object
 */
export interface User {
  id: string;
  username: string;
  identify_num: string;
  online: boolean;
  avatar: string;
  nickname: string;
  roles: number[];
  bot: boolean;
}

/**
 * Text message extra data
 */
export interface TextMessageExtra {
  type: MessageType;
  guild_id: string;
  channel_name: string;
  mention: string[];
  mention_all: boolean;
  mention_roles: number[];
  mention_here: boolean;
  author: User;
}

/**
 * System message extra data
 */
export interface SystemMessageExtra<T = SystemEventType, B = any> {
  type: T;
  body: B; // Specific to each event type
}

/**
 * Text message event
 */
export interface TextMessageEvent extends BaseEvent {
  type:
    | MessageType.TEXT
    | MessageType.IMAGE
    | MessageType.VIDEO
    | MessageType.FILE
    | MessageType.AUDIO
    | MessageType.KMARKDOWN
    | MessageType.CARD;
  extra: TextMessageExtra;
}

/**
 * System message event
 */
export interface SystemMessageEvent extends BaseEvent {
  type: MessageType.SYSTEM;
  extra: SystemMessageExtra;
}

/**
 * Union type for all message events
 */
export type MessageEvent = TextMessageEvent | SystemMessageEvent;

// User Events
export interface JoinedChannelEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.JOINED_CHANNEL,
    {
      user_id: string;
      channel_id: string;
      joined_at: number;
    }
  >;
}

export interface ExitedChannelEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.EXITED_CHANNEL,
    {
      user_id: string;
      channel_id: string;
      exited_at: number;
    }
  >;
}

export interface UserUpdatedEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.USER_UPDATED,
    {
      user_id: string;
      username: string;
      avatar: string;
    }
  >;
}

export interface SelfJoinedGuildEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.SELF_JOINED_GUILD,
    {
      guild_id: string;
      state?: string;
    }
  >;
}

export interface SelfExitedGuildEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.SELF_EXITED_GUILD,
    {
      guild_id: string;
    }
  >;
}

export interface MessageBtnClickEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.MESSAGE_BTN_CLICK,
    {
      msg_id: string;
      user_id: string;
      value: string;
      target_id: string;
      user_info: User;
    }
  >;
}

// Guild Events
export interface Guild {
  id: string;
  name: string;
  user_id: string;
  icon: string;
  notify_type: number;
  region: string;
  enable_open: number;
  open_id: number;
  default_channel_id: string;
  welcome_channel_id: string;
}

export interface UpdatedGuildEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<SystemEventType.UPDATED_GUILD, Guild>;
}

export interface DeletedGuildEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<SystemEventType.DELETED_GUILD, Guild>;
}

export interface AddedBlockListEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.ADDED_BLOCK_LIST,
    {
      operator_id: string;
      remark: string;
      user_id: string[];
    }
  >;
}

export interface DeletedBlockListEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.DELETED_BLOCK_LIST,
    {
      operator_id: string;
      user_id: string[];
    }
  >;
}

export interface EmojiEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.ADDED_EMOJI | SystemEventType.REMOVED_EMOJI | SystemEventType.UPDATED_EMOJI,
    {
      id: string;
      name: string;
    }
  >;
}

// Channel Events
export interface Emoji {
  id: string;
  name: string;
}

export interface ReactionEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.ADDED_REACTION | SystemEventType.DELETED_REACTION,
    {
      msg_id: string;
      user_id: string;
      channel_id: string;
      emoji: Emoji;
      channel_type: number;
    }
  >;
}

export interface UpdatedMessageEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.UPDATED_MESSAGE,
    {
      msg_id: string;
      content: string;
      channel_id: string;
      mention: string[];
      mention_all: boolean;
      mention_here: boolean;
      mention_roles: number[];
      updated_at: number;
      channel_type: number;
    }
  >;
}

export interface DeletedMessageEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.DELETED_MESSAGE,
    {
      msg_id: string;
      channel_id: string;
      channel_type: number;
    }
  >;
}

export interface PinnedMessageEvent extends SystemMessageEvent {
  extra: SystemMessageExtra<
    SystemEventType.PINNED_MESSAGE | SystemEventType.UNPINNED_MESSAGE,
    {
      channel_id: string;
      operator_id: string;
      msg_id: string;
      channel_type: number;
    }
  >;
}

/**
 * Union types for specific event categories
 */
export type UserEvent =
  | JoinedChannelEvent
  | ExitedChannelEvent
  | UserUpdatedEvent
  | SelfJoinedGuildEvent
  | SelfExitedGuildEvent
  | MessageBtnClickEvent;
export type GuildEvent =
  | UpdatedGuildEvent
  | DeletedGuildEvent
  | AddedBlockListEvent
  | DeletedBlockListEvent
  | EmojiEvent;
export type ChannelEvent =
  | ReactionEvent
  | UpdatedMessageEvent
  | DeletedMessageEvent
  | PinnedMessageEvent;

/**
 * All system events
 */
export type SystemEvent = UserEvent | GuildEvent | ChannelEvent;

/**
 * All possible events
 */
export type KookEvent = TextMessageEvent | SystemEvent;

/**
 * Event parser and router for handling different Kook events
 */
export class EventParser {
  private debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * Parse raw event data into typed event
   */
  parseEvent(eventData: any): KookEvent | null {
    try {
      // Validate basic event structure
      if (!this.isValidEvent(eventData)) {
        if (this.debug) {
          console.warn('[EventParser] Invalid event structure:', eventData);
        }
        return null;
      }

      const event = eventData as BaseEvent;

      if (this.debug) {
        console.log(
          `[EventParser] Parsing event: type=${event.type}, channel_type=${event.channel_type}`,
        );
      }

      // Route based on message type
      if (event.type === MessageType.SYSTEM) {
        return this.parseSystemEvent(event);
      } else {
        return this.parseTextEvent(event);
      }
    } catch (error) {
      if (this.debug) {
        console.error('[EventParser] Failed to parse event:', error);
      }
      return null;
    }
  }

  /**
   * Validate basic event structure
   */
  private isValidEvent(data: any): boolean {
    return (
      data &&
      typeof data.channel_type === 'string' &&
      typeof data.type === 'number' &&
      typeof data.target_id === 'string' &&
      typeof data.author_id === 'string' &&
      typeof data.content === 'string' &&
      typeof data.msg_id === 'string' &&
      typeof data.msg_timestamp === 'number'
    );
  }

  /**
   * Parse text/media message events
   */
  private parseTextEvent(event: BaseEvent): TextMessageEvent | null {
    if (!event.extra || typeof event.extra !== 'object') {
      if (this.debug) {
        console.warn('[EventParser] Text event missing extra data');
      }
      return null;
    }

    return event as TextMessageEvent;
  }

  /**
   * Parse system message events
   */
  private parseSystemEvent(event: BaseEvent): SystemEvent | null {
    if (!event.extra || !event.extra.type || !event.extra.body) {
      if (this.debug) {
        console.warn('[EventParser] System event missing extra data or type');
      }
      return null;
    }

    const systemEvent = event as SystemMessageEvent;
    const eventType = systemEvent.extra.type;

    if (this.debug) {
      console.log(`[EventParser] System event type: ${eventType}`);
    }

    // Validate system event type
    if (!Object.values(SystemEventType).includes(eventType)) {
      if (this.debug) {
        console.warn(`[EventParser] Unknown system event type: ${eventType}`);
      }
      return null;
    }

    return systemEvent as SystemEvent;
  }

  /**
   * Get event category
   */
  getEventCategory(event: KookEvent): 'text' | 'user' | 'guild' | 'channel' | 'unknown' {
    if (event.type !== MessageType.SYSTEM) {
      return 'text';
    }

    const systemEvent = event as SystemEvent;
    const eventType = systemEvent.extra.type;

    // User events
    if (
      [
        SystemEventType.JOINED_CHANNEL,
        SystemEventType.EXITED_CHANNEL,
        SystemEventType.USER_UPDATED,
        SystemEventType.SELF_JOINED_GUILD,
        SystemEventType.SELF_EXITED_GUILD,
        SystemEventType.MESSAGE_BTN_CLICK,
      ].includes(eventType)
    ) {
      return 'user';
    }

    // Guild events
    if (
      [
        SystemEventType.UPDATED_GUILD,
        SystemEventType.DELETED_GUILD,
        SystemEventType.ADDED_BLOCK_LIST,
        SystemEventType.DELETED_BLOCK_LIST,
        SystemEventType.ADDED_EMOJI,
        SystemEventType.REMOVED_EMOJI,
        SystemEventType.UPDATED_EMOJI,
      ].includes(eventType)
    ) {
      return 'guild';
    }

    // Channel events
    if (
      [
        SystemEventType.ADDED_REACTION,
        SystemEventType.DELETED_REACTION,
        SystemEventType.UPDATED_MESSAGE,
        SystemEventType.DELETED_MESSAGE,
        SystemEventType.ADDED_CHANNEL,
        SystemEventType.UPDATED_CHANNEL,
        SystemEventType.DELETED_CHANNEL,
        SystemEventType.PINNED_MESSAGE,
        SystemEventType.UNPINNED_MESSAGE,
      ].includes(eventType)
    ) {
      return 'channel';
    }

    return 'unknown';
  }

  /**
   * Check if event is a direct message
   */
  isDirectMessage(event: KookEvent): boolean {
    return event.channel_type === ChannelType.PERSON;
  }

  /**
   * Check if event is from a guild
   */
  isGuildMessage(event: KookEvent): boolean {
    return event.channel_type === ChannelType.GROUP;
  }

  /**
   * Check if event mentions the bot
   */
  isBotMentioned(event: KookEvent, botId: string): boolean {
    if (event.type === MessageType.SYSTEM) {
      return false;
    }

    const textEvent = event as TextMessageEvent;
    return textEvent.extra.mention_all || textEvent.extra.mention.includes(botId);
  }
}

/**
 * Event handler type definitions
 */
export type TextMessageHandler = (event: TextMessageEvent) => void | Promise<void>;
export type SystemEventHandler = (event: SystemEvent) => void | Promise<void>;
export type UserEventHandler = (event: UserEvent) => void | Promise<void>;
export type GuildEventHandler = (event: GuildEvent) => void | Promise<void>;
export type ChannelEventHandler = (event: ChannelEvent) => void | Promise<void>;

/**
 * Event filter function type
 */
export type EventFilter = (event: KookEvent) => boolean | Promise<boolean>;

/**
 * Event middleware function type
 */
export type EventMiddleware = (event: KookEvent, next: () => Promise<void>) => Promise<void>;

// Specific event handlers
export type JoinedChannelHandler = (event: JoinedChannelEvent) => void | Promise<void>;
export type ExitedChannelHandler = (event: ExitedChannelEvent) => void | Promise<void>;
export type UserUpdatedHandler = (event: UserUpdatedEvent) => void | Promise<void>;
export type MessageBtnClickHandler = (event: MessageBtnClickEvent) => void | Promise<void>;
export type ReactionHandler = (event: ReactionEvent) => void | Promise<void>;
export type MessageUpdatedHandler = (event: UpdatedMessageEvent) => void | Promise<void>;
export type MessageDeletedHandler = (event: DeletedMessageEvent) => void | Promise<void>;

/**
 * Event emitter for handling Kook events with type safety and concurrent execution
 */
export class TypedEventManager extends EventTarget {
  private parser: EventParser;
  private debug: boolean;
  private onError?: (error: Error) => void;

  // Filters and middleware
  private filters: EventFilter[] = [];
  private middleware: EventMiddleware[] = [];

  constructor(debug: boolean = false) {
    super();
    this.parser = new EventParser(debug);
    this.debug = debug;
  }

  /**
   * Set error handler for when event handlers throw
   */
  setErrorHandler(handler: (error: Error) => void): void {
    this.onError = handler;
  }

  /**
   * Handle raw event data
   */
  async handleEvent(eventData: any): Promise<void> {
    const event = this.parser.parseEvent(eventData);
    if (!event) {
      return;
    }

    try {
      // Apply filters
      if (!(await this.applyFilters(event))) {
        return;
      }

      // Apply middleware and handle event
      await this.applyMiddleware(event, async () => {
        // Emit events concurrently - no need to wait for handlers
        this.emitEvent(event);
      });
    } catch (error) {
      if (this.debug) {
        console.error('[TypedEventManager] Error handling event:', error);
      }
    }
  }

  /**
   * Emit events to all registered listeners
   */
  private emitEvent(event: KookEvent): void {
    if (this.debug) {
      console.log(
        `[TypedEventManager] Emitting event: ${event.type === MessageType.SYSTEM ? (event as SystemEvent).extra.type : 'text'}`,
      );
    }

    // Emit specific event types
    if (event.type !== MessageType.SYSTEM) {
      // Text message events
      this.dispatchEvent(new CustomEvent('textMessage', { detail: event }));
    } else {
      const systemEvent = event as SystemEvent;
      const eventType = systemEvent.extra.type;

      // System event categories
      const category = this.parser.getEventCategory(event);
      this.dispatchEvent(new CustomEvent('systemEvent', { detail: systemEvent }));
      this.dispatchEvent(new CustomEvent(category + 'Event', { detail: systemEvent }));

      // Specific system event types
      this.dispatchEvent(new CustomEvent(eventType, { detail: systemEvent }));
    }
  }

  // Event handler registration methods using addEventListener
  onTextMessage(handler: TextMessageHandler): void {
    this.addEventListener('textMessage', (event: Event) => {
      const customEvent = event as CustomEvent<TextMessageEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  onSystemEvent(handler: SystemEventHandler): void {
    this.addEventListener('systemEvent', (event: Event) => {
      const customEvent = event as CustomEvent<SystemEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  onUserEvent(handler: UserEventHandler): void {
    this.addEventListener('userEvent', (event: Event) => {
      const customEvent = event as CustomEvent<UserEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  onGuildEvent(handler: GuildEventHandler): void {
    this.addEventListener('guildEvent', (event: Event) => {
      const customEvent = event as CustomEvent<GuildEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  onChannelEvent(handler: ChannelEventHandler): void {
    this.addEventListener('channelEvent', (event: Event) => {
      const customEvent = event as CustomEvent<ChannelEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  /**
   * Safely execute a handler with error handling
   */
  private safeExecuteHandler(handlerFn: () => void | Promise<void>): void {
    // Execute handler asynchronously without waiting
    Promise.resolve().then(async () => {
      try {
        await handlerFn();
      } catch (error) {
        const handlerError = error instanceof Error ? error : new Error(String(error));
        if (this.debug) {
          console.error('[TypedEventManager] Handler error:', handlerError);
        }
        if (this.onError) {
          this.onError(handlerError);
        }
      }
    });
  }

  // Specific event handlers
  onJoinedChannel(handler: JoinedChannelHandler): void {
    this.addEventListener(SystemEventType.JOINED_CHANNEL, (event: Event) => {
      const customEvent = event as CustomEvent<JoinedChannelEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  onExitedChannel(handler: ExitedChannelHandler): void {
    this.addEventListener(SystemEventType.EXITED_CHANNEL, (event: Event) => {
      const customEvent = event as CustomEvent<ExitedChannelEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  onUserUpdated(handler: UserUpdatedHandler): void {
    this.addEventListener(SystemEventType.USER_UPDATED, (event: Event) => {
      const customEvent = event as CustomEvent<UserUpdatedEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  onMessageBtnClick(handler: MessageBtnClickHandler): void {
    this.addEventListener(SystemEventType.MESSAGE_BTN_CLICK, (event: Event) => {
      const customEvent = event as CustomEvent<MessageBtnClickEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  onReactionAdded(handler: ReactionHandler): void {
    this.addEventListener(SystemEventType.ADDED_REACTION, (event: Event) => {
      const customEvent = event as CustomEvent<ReactionEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  onReactionRemoved(handler: ReactionHandler): void {
    this.addEventListener(SystemEventType.DELETED_REACTION, (event: Event) => {
      const customEvent = event as CustomEvent<ReactionEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  onMessageUpdated(handler: MessageUpdatedHandler): void {
    this.addEventListener(SystemEventType.UPDATED_MESSAGE, (event: Event) => {
      const customEvent = event as CustomEvent<UpdatedMessageEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  onMessageDeleted(handler: MessageDeletedHandler): void {
    this.addEventListener(SystemEventType.DELETED_MESSAGE, (event: Event) => {
      const customEvent = event as CustomEvent<DeletedMessageEvent>;
      this.safeExecuteHandler(() => handler(customEvent.detail));
    });
  }

  /**
   * Get event parser
   */
  getParser(): EventParser {
    return this.parser;
  }

  // Filter and middleware methods
  /**
   * Add event filter
   */
  addFilter(filter: EventFilter): void {
    this.filters.push(filter);
  }

  /**
   * Add event middleware
   */
  addMiddleware(middleware: EventMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Apply all filters to an event
   */
  private async applyFilters(event: KookEvent): Promise<boolean> {
    for (const filter of this.filters) {
      try {
        const result = await filter(event);
        if (!result) {
          if (this.debug) {
            console.log('[TypedEventManager] Event filtered out');
          }
          return false;
        }
      } catch (error) {
        if (this.debug) {
          console.error('[TypedEventManager] Filter error:', error);
        }
        return false;
      }
    }
    return true;
  }

  /**
   * Apply middleware chain
   */
  private async applyMiddleware(event: KookEvent, handler: () => Promise<void>): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= this.middleware.length) {
        await handler();
        return;
      }

      const middleware = this.middleware[index++];
      if (middleware) {
        await middleware(event, next);
      }
    };

    await next();
  }

  /**
   * Remove all filters
   */
  clearFilters(): void {
    this.filters = [];
  }

  /**
   * Remove all middleware
   */
  clearMiddleware(): void {
    this.middleware = [];
  }
}
