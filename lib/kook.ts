// Kook WebSocket Protocol Library
// Based on official documentation: https://developer.kookapp.cn/doc/websocket

import {
  TypedEventManager,
  EventParser,
  type TextMessageHandler,
  type JoinedChannelHandler,
  type ExitedChannelHandler,
  type UserUpdatedHandler,
  type MessageBtnClickHandler,
  type ReactionHandler,
  type MessageUpdatedHandler,
  type MessageDeletedHandler,
} from './events.ts';

import { KookApiClient } from './api.ts';
import zlib from 'zlib';

/**
 * Signal types for WebSocket communication
 */
export enum SignalType {
  EVENT = 0, // server->client: Messages (chat and notification)
  HELLO = 1, // server->client: Handshake result when connecting
  PING = 2, // client->server: Heartbeat ping
  PONG = 3, // server->client: Heartbeat pong response
  RESUME = 4, // client->server: Resume session
  RECONNECT = 5, // server->client: Request client to reconnect
  RESUME_ACK = 6, // server->client: Resume acknowledgment
}

/**
 * Base signal structure
 */
export interface BaseSignal {
  s: SignalType;
  d: any;
  sn?: number; // Only present for EVENT signals (s=0)
}

/**
 * HELLO signal data (s=1)
 */
export interface HelloData {
  code: number;
  session_id?: string; // Present when code=0 (success)
}

/**
 * HELLO signal error codes
 */
export enum HelloErrorCode {
  SUCCESS = 0,
  MISSING_PARAMS = 40100,
  INVALID_TOKEN = 40101,
  TOKEN_VERIFICATION_FAILED = 40102,
  TOKEN_EXPIRED = 40103,
}

/**
 * EVENT signal (s=0)
 */
export interface EventSignal extends BaseSignal {
  s: SignalType.EVENT;
  d: any; // Event data structure
  sn: number; // Sequence number
}

/**
 * HELLO signal (s=1)
 */
export interface HelloSignal extends BaseSignal {
  s: SignalType.HELLO;
  d: HelloData;
}

/**
 * PING signal (s=2)
 */
export interface PingSignal extends BaseSignal {
  s: SignalType.PING;
  sn: number; // Current max SN received by client
}

/**
 * PONG signal (s=3)
 */
export interface PongSignal extends BaseSignal {
  s: SignalType.PONG;
}

/**
 * RESUME signal (s=4)
 */
export interface ResumeSignal extends BaseSignal {
  s: SignalType.RESUME;
  sn: number; // Last successfully processed SN
}

/**
 * RECONNECT signal data (s=5)
 */
export interface ReconnectData {
  code: number;
  err?: string;
}

/**
 * RECONNECT signal error codes
 */
export enum ReconnectErrorCode {
  RESUME_FAILED_MISSING_PARAMS = 40106,
  SESSION_EXPIRED = 40107,
  INVALID_SN = 40108,
}

/**
 * RECONNECT signal (s=5)
 */
export interface ReconnectSignal extends BaseSignal {
  s: SignalType.RECONNECT;
  d: ReconnectData;
}

/**
 * RESUME_ACK signal data (s=6)
 */
export interface ResumeAckData {
  session_id: string;
}

/**
 * RESUME_ACK signal (s=6)
 */
export interface ResumeAckSignal extends BaseSignal {
  s: SignalType.RESUME_ACK;
  d: ResumeAckData;
}

/**
 * Union type for all possible signals
 */
export type KookSignal =
  | EventSignal
  | HelloSignal
  | PingSignal
  | PongSignal
  | ResumeSignal
  | ReconnectSignal
  | ResumeAckSignal;

/**
 * WebSocket connection states
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  RESUMING = 'resuming',
  RECONNECTING = 'reconnecting',
}

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  url: string;
  compress?: boolean; // Default: true (1)
}

/**
 * Kook client configuration
 */
export interface KookClientConfig {
  token: string;
  compress?: boolean; // Enable compression (default: true)
  heartbeatInterval?: number; // Heartbeat interval in ms (default: 30000)
  heartbeatTimeout?: number; // Heartbeat timeout in ms (default: 6000)
  maxReconnectAttempts?: number; // Max reconnection attempts (default: unlimited)
  reconnectBackoffBase?: number; // Base backoff time in ms (default: 2000)
  reconnectBackoffMax?: number; // Max backoff time in ms (default: 60000)
  autoReconnect?: boolean; // Auto reconnect on disconnect (default: true)
  debug?: boolean; // Enable debug logging (default: false)
}

/**
 * Connection retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  currentAttempt: number;
}

/**
 * Message buffer entry for handling out-of-order messages
 */
export interface BufferedMessage {
  signal: EventSignal;
  timestamp: number;
}

/**
 * Session information for resuming connections
 */
export interface SessionInfo {
  sessionId: string;
  lastSN: number;
  gatewayUrl: string;
}

/**
 * Gateway API response
 */
export interface GatewayResponse {
  code: number;
  message: string;
  data: {
    url: string;
  };
}

/**
 * Gateway manager for handling gateway URL fetching and connection
 */
export class GatewayManager {
  private token: string;
  private compress: boolean;
  private debug: boolean;

  constructor(token: string, compress: boolean = true, debug: boolean = false) {
    this.token = token;
    this.compress = compress;
    this.debug = debug;
  }

  /**
   * Fetch gateway URL from Kook API
   */
  async fetchGateway(): Promise<string> {
    const url = 'https://www.kookapp.cn/api/v3/gateway/index';
    const params = new URLSearchParams({
      compress: this.compress ? '1' : '0',
    });

    try {
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          Authorization: `Bot ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Gateway API request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as GatewayResponse;

      if (data.code !== 0) {
        throw new Error(`Gateway API error: ${data.code} - ${data.message}`);
      }

      if (this.debug) {
        console.log('[Gateway] Fetched gateway URL:', data.data.url);
      }

      return data.data.url;
    } catch (error) {
      if (this.debug) {
        console.error('[Gateway] Failed to fetch gateway:', error);
      }
      throw error;
    }
  }

  /**
   * Build WebSocket URL with parameters
   */
  buildWebSocketUrl(gatewayUrl: string, resumeParams?: { sessionId: string; sn: number }): string {
    const url = new URL(gatewayUrl);

    // The gateway URL already contains token and compress parameters
    // Only add resume parameters if provided
    if (resumeParams) {
      url.searchParams.set('resume', '1');
      url.searchParams.set('sn', resumeParams.sn.toString());
      url.searchParams.set('session_id', resumeParams.sessionId);
    }

    return url.toString();
  }

  /**
   * Create WebSocket connection with retry logic as per documentation
   */
  async createConnection(
    gatewayUrl: string,
    resumeParams?: { sessionId: string; sn: number },
  ): Promise<WebSocket> {
    const maxRetries = 2; // Max 2 retries as per documentation
    const retryIntervals = [2000, 4000]; // 2s, 4s intervals as per documentation

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const wsUrl = this.buildWebSocketUrl(gatewayUrl, resumeParams);

        if (this.debug) {
          console.log(`[Gateway] Connection attempt ${attempt + 1}/${maxRetries + 1} to:`, wsUrl.replace(this.token, '***'));
        }

        const ws = await this.attemptConnection(wsUrl);

        if (this.debug) {
          console.log('[Gateway] WebSocket connection successful');
        }

        return ws;
      } catch (error) {
        if (this.debug) {
          console.error(`[Gateway] Connection attempt ${attempt + 1} failed:`, error);
        }

        if (attempt < maxRetries) {
          const delay = retryIntervals[attempt];
          if (this.debug) {
            console.log(`[Gateway] Retrying in ${delay}ms`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    throw new Error('All connection attempts failed');
  }

  /**
   * Attempt a single WebSocket connection
   */
  private attemptConnection(wsUrl: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearTimeout(timeout);
        resolve(ws);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection closed: ${event.code} ${event.reason}`));
      };
    });
  }
}

/**
 * Signal handler for processing WebSocket messages
 */
export class SignalHandler {
  private debug: boolean;
  private onEvent?: (signal: EventSignal) => void;
  private onHello?: (signal: HelloSignal) => void;
  private onPong?: (signal: PongSignal) => void;
  private onReconnect?: (signal: ReconnectSignal) => void | Promise<void>;
  private onResumeAck?: (signal: ResumeAckSignal) => void;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * Set event handlers
   */
  setEventHandler(handler: (signal: EventSignal) => void): void {
    this.onEvent = handler;
  }

  setHelloHandler(handler: (signal: HelloSignal) => void): void {
    this.onHello = handler;
  }

  setPongHandler(handler: (signal: PongSignal) => void): void {
    this.onPong = handler;
  }

  setReconnectHandler(handler: (signal: ReconnectSignal) => void | Promise<void>): void {
    this.onReconnect = handler;
  }

  setResumeAckHandler(handler: (signal: ResumeAckSignal) => void): void {
    this.onResumeAck = handler;
  }

  /**
   * Parse and handle incoming WebSocket message
   */
  handleMessage(data: string | Buffer): void {
    try {
      let messageText: string;
      if (data instanceof Buffer) {
        messageText = zlib.inflateSync(data).toString('utf-8');
      } else {
        messageText = data as string;
      }

      const signal = JSON.parse(messageText) as KookSignal;

      if (this.debug) {
        console.log('[Signal] Received:', signal.s, signal);
      }

      this.processSignal(signal);
    } catch (error) {
      if (this.debug) {
        console.error('[Signal] Failed to parse message:', error);
      }
    }
  }

  /**
   * Process parsed signal based on type
   */
  private processSignal(signal: KookSignal): void {
    switch (signal.s) {
      case SignalType.EVENT:
        if (this.onEvent) {
          this.onEvent(signal as EventSignal);
        }
        break;

      case SignalType.HELLO:
        if (this.onHello) {
          this.onHello(signal as HelloSignal);
        }
        break;

      case SignalType.PONG:
        if (this.onPong) {
          this.onPong(signal as PongSignal);
        }
        break;

      case SignalType.RECONNECT:
        if (this.onReconnect) {
          // Handle both sync and async reconnect handlers
          const result = this.onReconnect(signal as ReconnectSignal);
          if (result instanceof Promise) {
            result.catch((error) => {
              if (this.debug) {
                console.error('[Signal] Reconnect handler error:', error);
              }
            });
          }
        }
        break;

      case SignalType.RESUME_ACK:
        if (this.onResumeAck) {
          this.onResumeAck(signal as ResumeAckSignal);
        }
        break;

      default:
        if (this.debug) {
          console.warn('[Signal] Unknown signal type:', signal.s);
        }
    }
  }

  /**
   * Create PING signal
   */
  createPingSignal(sn: number): string {
    const signal: PingSignal = {
      s: SignalType.PING,
      d: {},
      sn,
    };
    return JSON.stringify(signal);
  }

  /**
   * Create RESUME signal
   */
  createResumeSignal(sn: number): string {
    const signal: ResumeSignal = {
      s: SignalType.RESUME,
      d: {},
      sn,
    };
    return JSON.stringify(signal);
  }
}

/**
 * Heartbeat manager for maintaining connection health
 */
export class HeartbeatManager {
  private interval: number;
  private timeout: number;
  private debug: boolean;
  private heartbeatTimer?: NodeJS.Timeout;
  private timeoutTimer?: NodeJS.Timeout;

  private isWaitingForPong: boolean = false;
  private onTimeout?: () => void;
  private onSendPing?: (sn: number) => void;
  private onConnectionLost?: () => void;

  // Ping test state (not retry - these are connection tests as per documentation step 4)
  private pingTestCount: number = 0;
  private maxPingTests: number = 2;
  private pingTestIntervals: number[] = [2000, 4000]; // 2s, 4s as per documentation
  private onPingTestsFailed?: () => void;

  constructor(interval: number = 30000, timeout: number = 6000, debug: boolean = false) {
    this.interval = interval;
    this.timeout = timeout;
    this.debug = debug;
  }

  /**
   * Set event handlers
   */
  setTimeoutHandler(handler: () => void): void {
    this.onTimeout = handler;
  }

  setSendPingHandler(handler: (sn: number) => void): void {
    this.onSendPing = handler;
  }

  setConnectionLostHandler(handler: () => void): void {
    this.onConnectionLost = handler;
  }

  setPingTestsFailedHandler(handler: () => void): void {
    this.onPingTestsFailed = handler;
  }

  /**
   * Start heartbeat with random jitter (-5 to +5 seconds)
   */
  start(currentSN: number): void {
    this.stop(); // Clear any existing timers

    const jitter = Math.random() * 10000 - 5000; // -5 to +5 seconds
    const intervalWithJitter = this.interval + jitter;

    if (this.debug) {
      console.log(`[Heartbeat] Starting with interval: ${intervalWithJitter}ms`);
    }

    this.heartbeatTimer = setTimeout(() => {
      this.sendPing(currentSN);
    }, intervalWithJitter);
  }

  /**
   * Stop heartbeat timers
   */
  stop(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = undefined;
    }

    this.isWaitingForPong = false;
  }

  /**
   * Send ping and start timeout timer
   */
  private sendPing(sn: number): void {
    if (this.debug) {
      console.log(`[Heartbeat] Sending PING with SN: ${sn}`);
    }

    this.isWaitingForPong = true;

    if (this.onSendPing) {
      this.onSendPing(sn);
    }

    // Start timeout timer
    this.timeoutTimer = setTimeout(() => {
      if (this.isWaitingForPong) {
        this.handlePingTimeout(sn);
      }
    }, this.timeout);
  }

  /**
   * Handle ping timeout - implement test logic as per documentation step 4
   * Send 2 pings with 2s, 4s intervals to test if connection is alive
   * If both fail, trigger ping tests failed handler (which will start resume attempts)
   */
  private handlePingTimeout(sn: number): void {
    if (this.debug) {
      console.log(`[Heartbeat] PONG timeout - test attempt ${this.pingTestCount + 1}/${this.maxPingTests}`);
    }

    if (this.pingTestCount < this.maxPingTests) {
      // Send another ping test with documented intervals (2s, 4s)
      const testDelay = this.pingTestIntervals[this.pingTestCount];
      this.pingTestCount++;

      if (this.debug) {
        console.log(`[Heartbeat] Retrying ping test in ${testDelay}ms`);
      }

      setTimeout(() => {
        this.sendPing(sn);
      }, testDelay);
    } else {
      // All ping tests failed - connection is lost, move to resume attempts
      if (this.debug) {
        console.log('[Heartbeat] All ping tests failed - connection lost, starting resume attempts');
      }

      this.pingTestCount = 0; // Reset for next time

      if (this.onPingTestsFailed) {
        this.onPingTestsFailed();
      } else if (this.onConnectionLost) {
        this.onConnectionLost();
      } else if (this.onTimeout) {
        // Fallback to old behavior if new handler not set
        this.onTimeout();
      }
    }
  }

  /**
   * Handle received PONG
   */
  handlePong(): void {
    if (this.debug) {
      console.log('[Heartbeat] Received PONG');
    }

    this.isWaitingForPong = false;
    this.pingTestCount = 0; // Reset test count on successful pong

    // Clear timeout timer
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = undefined;
    }
  }
}

/**
 * Message sequencer for handling SN ordering and buffering
 */
export class MessageSequencer {
  private lastProcessedSN: number = 0;
  private messageBuffer: Map<number, BufferedMessage> = new Map();
  private debug: boolean;
  private onProcessMessage?: (signal: EventSignal) => void | Promise<void>;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * Set message processing handler
   */
  setMessageHandler(handler: (signal: EventSignal) => void | Promise<void>): void {
    this.onProcessMessage = handler;
  }

  /**
   * Process incoming event signal with SN ordering
   */
  async processEvent(signal: EventSignal): Promise<void> {
    const sn = signal.sn;

    if (this.debug) {
      console.log(
        `[Sequencer] Processing event SN: ${sn}, last processed: ${this.lastProcessedSN}`,
      );
    }

    // Check for duplicate message
    if (sn <= this.lastProcessedSN) {
      if (this.debug) {
        console.log(`[Sequencer] Discarding duplicate/old message SN: ${sn}`);
      }
      return;
    }

    // Always add message to buffer first
    this.messageBuffer.set(sn, {
      signal,
      timestamp: Date.now(),
    });

    if (this.debug) {
      console.log(`[Sequencer] Added message SN: ${sn} to buffer`);
    }

    // Check buffer size and skip ahead if needed
    if (this.messageBuffer.size > 10) {
      console.warn(
        `[Sequencer] Buffer size (${this.messageBuffer.size}) exceeded 10, skipping ahead`,
      );
      this.skipToNextAvailableMessage();
    }

    // Process messages in order from buffer
    await this.processBufferedMessages();
  }

  /**
   * Process buffered messages in order
   */
  private async processBufferedMessages(): Promise<void> {
    let nextSN = this.lastProcessedSN + 1;

    while (this.messageBuffer.has(nextSN)) {
      const bufferedMessage = this.messageBuffer.get(nextSN)!;

      if (this.debug) {
        console.log(`[Sequencer] Processing buffered message SN: ${nextSN}`);
      }

      await this.processMessage(bufferedMessage.signal);
      this.messageBuffer.delete(nextSN);
      this.lastProcessedSN = nextSN;
      nextSN++;
    }
  }

  /**
   * Process all buffered messages regardless of order (used before reconnect)
   */
  async processAllBufferedMessages(): Promise<void> {
    const sortedSNs = Array.from(this.messageBuffer.keys()).sort((a, b) => a - b);

    for (const sn of sortedSNs) {
      const bufferedMessage = this.messageBuffer.get(sn)!;

      if (this.debug) {
        console.log(`[Sequencer] Processing buffered message SN: ${sn} (forced processing)`);
      }

      await this.processMessage(bufferedMessage.signal);
      this.messageBuffer.delete(sn);
      this.lastProcessedSN = sn;
    }
  }

  /**
   * Skip ahead to the next available message when buffer is too large
   */
  private skipToNextAvailableMessage(): void {
    const sortedSNs = Array.from(this.messageBuffer.keys()).sort((a, b) => a - b);

    if (sortedSNs.length === 0) {
      return;
    }

    // Find the first available message and skip to it
    const nextAvailableSN = sortedSNs[0]!; // We know it exists because length > 0

    if (this.debug) {
      console.log(`[Sequencer] Skipping from SN ${this.lastProcessedSN} to ${nextAvailableSN - 1}`);
    }

    this.lastProcessedSN = nextAvailableSN - 1;
  }

  /**
   * Process a single message
   */
  private async processMessage(signal: EventSignal): Promise<void> {
    if (this.onProcessMessage) {
      await this.onProcessMessage(signal);
    }
  }

  /**
   * Get current last processed SN
   */
  getLastProcessedSN(): number {
    return this.lastProcessedSN;
  }

  /**
   * Set last processed SN (for resume)
   */
  setLastProcessedSN(sn: number): void {
    this.lastProcessedSN = sn;
    if (this.debug) {
      console.log(`[Sequencer] Set last processed SN to: ${sn}`);
    }
  }

  /**
   * Clear all buffered messages
   */
  clearBuffer(): void {
    this.messageBuffer.clear();
    if (this.debug) {
      console.log('[Sequencer] Cleared message buffer');
    }
  }

  /**
   * Get buffer status
   */
  getBufferStatus(): { size: number; oldestSN?: number; newestSN?: number } {
    if (this.messageBuffer.size === 0) {
      return { size: 0 };
    }

    const sns = Array.from(this.messageBuffer.keys()).sort((a, b) => a - b);
    return {
      size: this.messageBuffer.size,
      oldestSN: sns[0],
      newestSN: sns[sns.length - 1],
    };
  }
}

/**
 * Resume manager for handling session resumption
 */
export class ResumeManager {
  private debug: boolean;
  private resumeTimer?: NodeJS.Timeout;
  private resumeAttempt: number = 0;
  private maxResumeAttempts: number = 2;
  private resumeIntervals: number[] = [8000, 16000]; // 8s, 16s as per documentation
  private onSendResume?: (sn: number) => void;
  private onResumeFailed?: () => void;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  setSendResumeHandler(handler: (sn: number) => void): void {
    this.onSendResume = handler;
  }

  setResumeFailedHandler(handler: () => void): void {
    this.onResumeFailed = handler;
  }

  /**
   * Start resume attempts
   */
  startResume(sn: number): void {
    this.resumeAttempt = 0;
    this.attemptResume(sn);
  }

  private attemptResume(sn: number): void {
    if (this.resumeAttempt >= this.maxResumeAttempts) {
      if (this.debug) {
        console.log('[Resume] All resume attempts failed');
      }

      if (this.onResumeFailed) {
        this.onResumeFailed();
      }
      return;
    }

    const delay = this.resumeAttempt === 0 ? 0 : (this.resumeIntervals[this.resumeAttempt - 1] || 16000);

    if (this.debug) {
      console.log(`[Resume] Attempt ${this.resumeAttempt + 1}/${this.maxResumeAttempts}${delay > 0 ? `, waiting ${delay}ms` : ''}`);
    }

    this.resumeTimer = setTimeout(() => {
      if (this.onSendResume) {
        this.onSendResume(sn);
      }
      this.resumeAttempt++;
    }, delay);
  }

  /**
   * Handle successful resume
   */
  handleResumeSuccess(): void {
    if (this.debug) {
      console.log('[Resume] Resume successful');
    }
    this.stop();
  }

  /**
   * Handle resume failure and try next attempt
   */
  handleResumeFailure(sn: number): void {
    if (this.debug) {
      console.log(`[Resume] Resume attempt ${this.resumeAttempt} failed`);
    }
    this.attemptResume(sn);
  }

  stop(): void {
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = undefined;
    }
    this.resumeAttempt = 0;
  }
}

/**
 * Reconnection manager with exponential backoff
 */
export class ReconnectionManager {
  private config: RetryConfig;
  private debug: boolean;
  private reconnectTimer?: NodeJS.Timeout;
  private onReconnect?: () => Promise<void>;

  constructor(
    maxAttempts: number = -1, // -1 for unlimited as per documentation
    baseDelay: number = 2000,
    maxDelay: number = 60000, // Max 60s as per documentation
    debug: boolean = false,
  ) {
    this.config = {
      maxAttempts,
      baseDelay,
      maxDelay,
      currentAttempt: 0,
    };
    this.debug = debug;
  }

  /**
   * Set reconnection handler
   */
  setReconnectHandler(handler: () => Promise<void>): void {
    this.onReconnect = handler;
  }

  /**
   * Start reconnection with exponential backoff
   */
  startReconnection(): void {
    this.config.currentAttempt++;

    if (this.config.maxAttempts > 0 && this.config.currentAttempt > this.config.maxAttempts) {
      if (this.debug) {
        console.log('[Reconnection] Max attempts reached, giving up');
      }
      return;
    }

    const delay = Math.min(
      this.config.baseDelay * Math.pow(2, this.config.currentAttempt - 1),
      this.config.maxDelay,
    );

    if (this.debug) {
      console.log(`[Reconnection] Attempt ${this.config.currentAttempt}, waiting ${delay}ms`);
    }

    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.onReconnect) {
          await this.onReconnect();
          this.reset(); // Reset on successful reconnection
        }
      } catch (error) {
        if (this.debug) {
          console.error('[Reconnection] Failed:', error);
        }
        this.startReconnection(); // Try again
      }
    }, delay);
  }

  /**
   * Stop reconnection attempts
   */
  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Reset reconnection state
   */
  reset(): void {
    this.stop();
    this.config.currentAttempt = 0;
  }

  /**
   * Get current attempt count
   */
  getCurrentAttempt(): number {
    return this.config.currentAttempt;
  }
}

/**
 * Session manager for handling session state and resumption
 */
export class SessionManager {
  private sessionInfo?: SessionInfo;
  private debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * Set session information
   */
  setSession(sessionId: string, gatewayUrl: string, lastSN: number = 0): void {
    this.sessionInfo = {
      sessionId,
      lastSN,
      gatewayUrl,
    };

    if (this.debug) {
      console.log('[Session] Set session:', { sessionId, lastSN });
    }
  }

  /**
   * Update last processed SN
   */
  updateLastSN(sn: number): void {
    if (this.sessionInfo) {
      this.sessionInfo.lastSN = sn;

      if (this.debug) {
        console.log(`[Session] Updated last SN to: ${sn}`);
      }
    }
  }

  /**
   * Get session information for resumption
   */
  getResumeParams(): { sessionId: string; sn: number } | null {
    if (!this.sessionInfo) {
      return null;
    }

    return {
      sessionId: this.sessionInfo.sessionId,
      sn: this.sessionInfo.lastSN,
    };
  }

  /**
   * Clear session (on reconnect signal)
   */
  clearSession(): void {
    if (this.debug) {
      console.log('[Session] Clearing session');
    }
    this.sessionInfo = undefined;
  }

  /**
   * Check if session exists
   */
  hasSession(): boolean {
    return this.sessionInfo !== undefined;
  }

  /**
   * Get current session info
   */
  getSessionInfo(): SessionInfo | undefined {
    return this.sessionInfo;
  }
}

/**
 * Close event interface for WebSocket
 */
export interface KookCloseEvent {
  code: number;
  reason: string;
  wasClean: boolean;
}

/**
 * Event map for type-safe event handling
 */
export interface KookEventMap {
  // Connection events
  connecting: () => void;
  connected: () => void;
  ready: () => void;
  reconnected: () => void;
  disconnected: (event: KookCloseEvent) => void;
  error: (error: Error) => void;

  // State events
  stateChange: (newState: ConnectionState, oldState: ConnectionState) => void;

  // Heartbeat events
  heartbeatTimeout: () => void;
  connectionLost: () => void;

  // Reconnection events
  reconnect: (data: any) => void;
  resumed: (data: any) => void;
  resumeFailed: () => void;

  // Legacy message events (for backward compatibility)
  message: (event: any) => void;
  event: (event: any) => void;
}

/**
 * Type-safe event emitter for Kook events
 */
export class KookEventEmitter {
  private listeners: Map<keyof KookEventMap, Function[]> = new Map();
  private debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * Add event listener with type safety
   */
  on<K extends keyof KookEventMap>(event: K, listener: KookEventMap[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener as Function);

    if (this.debug) {
      console.log(`[Events] Added listener for: ${event}`);
    }
  }

  /**
   * Remove event listener
   */
  off<K extends keyof KookEventMap>(event: K, listener: KookEventMap[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener as Function);
      if (index > -1) {
        eventListeners.splice(index, 1);

        if (this.debug) {
          console.log(`[Events] Removed listener for: ${event}`);
        }
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  emit<K extends keyof KookEventMap>(event: K, ...args: Parameters<KookEventMap[K]>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      if (this.debug) {
        console.log(`[Events] Emitting: ${event} to ${eventListeners.length} listeners`);
      }

      for (const listener of eventListeners) {
        try {
          listener(...args);
        } catch (error) {
          if (this.debug) {
            console.error(`[Events] Error in listener for ${event}:`, error);
          }
        }
      }
    }
  }
}

/**
 * Main Kook WebSocket client
 */
export class KookClient extends KookEventEmitter {
  private config: Required<KookClientConfig>;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private ws?: WebSocket;
  private isFirstConnection: boolean = true;

  // Component managers
  private gateway: GatewayManager;
  private signalHandler: SignalHandler;
  private heartbeat: HeartbeatManager;
  private sequencer: MessageSequencer;
  private reconnection: ReconnectionManager;
  private resume: ResumeManager;
  private session: SessionManager;

  private eventManager: TypedEventManager;

  // HTTP API client
  public api: KookApiClient;

  // HELLO timeout timer
  private helloTimeoutTimer?: NodeJS.Timeout;

  constructor(config: KookClientConfig) {
    super(config.debug);

    // Set default configuration
    this.config = {
      token: config.token,
      compress: config.compress ?? true,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      heartbeatTimeout: config.heartbeatTimeout ?? 6000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? -1,
      reconnectBackoffBase: config.reconnectBackoffBase ?? 2000,
      reconnectBackoffMax: config.reconnectBackoffMax ?? 60000,
      autoReconnect: config.autoReconnect ?? true,
      debug: config.debug ?? false,
    };

    // Initialize component managers
    this.gateway = new GatewayManager(this.config.token, this.config.compress, this.config.debug);
    this.signalHandler = new SignalHandler(this.config.debug);
    this.heartbeat = new HeartbeatManager(
      this.config.heartbeatInterval,
      this.config.heartbeatTimeout,
      this.config.debug,
    );
    this.sequencer = new MessageSequencer(this.config.debug);
    this.reconnection = new ReconnectionManager(
      this.config.maxReconnectAttempts,
      this.config.reconnectBackoffBase,
      this.config.reconnectBackoffMax,
      this.config.debug,
    );
    this.resume = new ResumeManager(this.config.debug);
    this.session = new SessionManager(this.config.debug);
    this.eventManager = new TypedEventManager(this.config.debug);

    // Initialize HTTP API client
    this.api = new KookApiClient(this.config.token, this.config.debug);

    this.setupEventHandlers();
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers(): void {
    // Signal handlers
    this.signalHandler.setHelloHandler((signal) => this.handleHello(signal));
    this.signalHandler.setPongHandler((signal) => this.handlePong(signal));
    this.signalHandler.setReconnectHandler((signal) => this.handleReconnect(signal));
    this.signalHandler.setResumeAckHandler((signal) => this.handleResumeAck(signal));
    this.signalHandler.setEventHandler((signal) => this.handleEvent(signal));

    // Heartbeat handlers
    this.heartbeat.setPingTestsFailedHandler(() => this.handlePingTestsFailed());
    this.heartbeat.setConnectionLostHandler(() => this.handleConnectionLost());
    this.heartbeat.setSendPingHandler((sn) => this.sendPing(sn));

    // Resume handlers
    this.resume.setSendResumeHandler((sn) => this.sendResume(sn));
    this.resume.setResumeFailedHandler(() => this.handleResumeFailed());

    // Message sequencer handler
    this.sequencer.setMessageHandler((signal) => this.processEvent(signal));

    // Reconnection handler
    this.reconnection.setReconnectHandler(() => this.performReconnection());

    // Event manager error handler
    this.eventManager.setErrorHandler((error) => this.emit('error', error));
  }

  /**
   * Connect to Kook WebSocket
   */
  async connect(): Promise<void> {
    if (this.state !== ConnectionState.DISCONNECTED) {
      throw new Error(`Cannot connect in state: ${this.state}`);
    }

    this.setState(ConnectionState.CONNECTING);
    this.emit('connecting');

    try {
      // Fetch gateway URL
      const gatewayUrl = await this.gateway.fetchGateway();

      // Attempt to resume if we have session info
      const resumeParams = this.session.getResumeParams();
      if (resumeParams && this.config.debug) {
        console.log('[Client] Attempting to resume session');
      }

      // Create WebSocket connection
      this.ws = await this.gateway.createConnection(gatewayUrl, resumeParams || undefined);
      this.setupWebSocketHandlers();

      // Start HELLO timeout (6 seconds as per documentation)
      this.startHelloTimeout();

      this.setState(ConnectionState.CONNECTED);
      this.emit('connected');
    } catch (error) {
      this.setState(ConnectionState.DISCONNECTED);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));

      if (this.config.autoReconnect) {
        this.reconnection.startReconnection();
      }

      throw error;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      this.signalHandler.handleMessage(event.data);
    };

    this.ws.onclose = (event) => {
      if (this.config.debug) {
        console.log('[Client] WebSocket closed:', event.code, event.reason);
      }

      this.setState(ConnectionState.DISCONNECTED);
      this.heartbeat.stop();
      this.emit('disconnected', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });

      if (this.config.autoReconnect && !event.wasClean) {
        this.reconnection.startReconnection();
      }
    };

    this.ws.onerror = (error) => {
      if (this.config.debug) {
        console.error('[Client] WebSocket error:', error);
      }
      this.emit('error', new Error('WebSocket error occurred'));
    };
  }

  /**
   * Start HELLO timeout (6 seconds as per documentation)
   */
  private startHelloTimeout(): void {
    this.helloTimeoutTimer = setTimeout(() => {
      if (this.config.debug) {
        console.log('[Client] HELLO timeout - no HELLO received within 6 seconds');
      }
      const error = new Error('HELLO timeout - connection failed');
      this.emit('error', error);
      this.disconnect();

      if (this.config.autoReconnect) {
        this.reconnection.startReconnection();
      }
    }, 6000); // 6 seconds as per documentation
  }

  /**
   * Clear HELLO timeout
   */
  private clearHelloTimeout(): void {
    if (this.helloTimeoutTimer) {
      clearTimeout(this.helloTimeoutTimer);
      this.helloTimeoutTimer = undefined;
    }
  }

  /**
   * Handle HELLO signal
   */
  private handleHello(signal: HelloSignal): void {
    // Clear HELLO timeout on receiving HELLO
    this.clearHelloTimeout();

    if (signal.d.code === HelloErrorCode.SUCCESS) {
      this.setState(ConnectionState.AUTHENTICATED);
      this.session.setSession(signal.d.session_id!, '', 0);
      this.heartbeat.start(this.sequencer.getLastProcessedSN());

      // Only emit 'ready' on the first successful connection
      if (this.isFirstConnection) {
        this.emit('ready');
        this.isFirstConnection = false;
      } else {
        // Emit a different event for reconnections
        this.emit('reconnected');
      }
    } else {
      const error = new Error(`Authentication failed: ${signal.d.code}`);
      this.emit('error', error);
      this.disconnect();
    }
  }

  /**
   * Handle PONG signal
   */
  private handlePong(_signal: PongSignal): void {
    this.heartbeat.handlePong();
    this.heartbeat.start(this.sequencer.getLastProcessedSN());
  }

  /**
   * Process all buffered messages before reconnect, handling non-sequential messages
   */
  private async processAllBufferedMessagesBeforeReconnect(): Promise<void> {
    const bufferStatus = this.sequencer.getBufferStatus();
    if (bufferStatus.size === 0) return;

    if (this.config.debug) {
      console.log(`[Client] Processing ${bufferStatus.size} buffered messages before reconnect`);
    }

    // Check if messages are sequential from current position
    const lastProcessedSN = this.sequencer.getLastProcessedSN();
    const expectedNextSN = lastProcessedSN + 1;

    if (bufferStatus.oldestSN !== expectedNextSN) {
      console.warn(
        `[Client] Non-sequential messages detected during reconnect. Expected SN: ${expectedNextSN}, oldest buffered SN: ${bufferStatus.oldestSN}. Jumping ahead to process all buffered messages.`,
      );
      // Jump ahead to process all buffered messages
      this.sequencer.setLastProcessedSN(bufferStatus.oldestSN! - 1);
    }

    await this.sequencer.processAllBufferedMessages();
  }

  /**
   * Handle RECONNECT signal
   */
  private async handleReconnect(signal: ReconnectSignal): Promise<void> {
    if (this.config.debug) {
      console.log('[Client] Received RECONNECT signal:', signal.d);
    }

    // Process all existing messages in buffer before reconnecting
    await this.processAllBufferedMessagesBeforeReconnect();

    // Clear session and message queue as per documentation
    this.session.clearSession();
    this.sequencer.clearBuffer();
    this.sequencer.setLastProcessedSN(0);

    this.emit('reconnect', signal.d);
    this.disconnect();

    if (this.config.autoReconnect) {
      this.reconnection.startReconnection();
    }
  }

  /**
   * Handle RESUME_ACK signal
   */
  private handleResumeAck(signal: ResumeAckSignal): void {
    if (this.config.debug) {
      console.log('[Client] Resume successful:', signal.d.session_id);
    }

    // Notify resume manager of success
    this.resume.handleResumeSuccess();

    // Update session with new session ID if provided
    if (signal.d.session_id) {
      this.session.setSession(signal.d.session_id, '', this.sequencer.getLastProcessedSN());
    }

    this.emit('resumed', signal.d);
  }

  /**
   * Handle EVENT signal
   */
  private async handleEvent(signal: EventSignal): Promise<void> {
    await this.sequencer.processEvent(signal);
  }

  /**
   * Process event after sequencing
   */
  private async processEvent(signal: EventSignal): Promise<void> {
    // Update session with latest SN
    this.session.updateLastSN(signal.sn);

    // Process through typed event manager
    await this.eventManager.handleEvent(signal.d);

    // Emit the event to user handlers (for backward compatibility)
    this.emit('event', signal.d);
    this.emit('message', signal.d); // Alias for compatibility
  }

  /**
   * Handle ping tests failed (as per documentation step 4)
   * After 2 ping tests fail, move to resume attempts
   */
  private handlePingTestsFailed(): void {
    if (this.config.debug) {
      console.log('[Client] Ping tests failed - starting resume attempts (step 5)');
    }

    this.emit('connectionLost');

    if (this.config.autoReconnect) {
      // Try resume attempts (8s, 16s intervals) as per documentation step 5
      const currentSN = this.sequencer.getLastProcessedSN();
      this.resume.startResume(currentSN);
    }
  }

  /**
   * Handle connection lost (fallback for other connection loss scenarios)
   */
  private handleConnectionLost(): void {
    if (this.config.debug) {
      console.log('[Client] Connection lost - starting resume attempts');
    }

    this.emit('connectionLost');

    if (this.config.autoReconnect) {
      // Try resume attempts (8s, 16s intervals) as per documentation step 5
      const currentSN = this.sequencer.getLastProcessedSN();
      this.resume.startResume(currentSN);
    }
  }

  /**
   * Handle resume failed - fall back to full reconnection
   */
  private handleResumeFailed(): void {
    if (this.config.debug) {
      console.log('[Client] Resume failed - falling back to full reconnection');
    }

    this.emit('resumeFailed');

    if (this.config.autoReconnect) {
      this.disconnect();
      this.reconnection.startReconnection();
    }
  }

  /**
   * Send PING signal
   */
  private sendPing(sn: number): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const pingMessage = this.signalHandler.createPingSignal(sn);
      this.ws.send(pingMessage);
    }
  }

  /**
   * Send RESUME signal
   */
  private sendResume(sn: number): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const resumeMessage = this.signalHandler.createResumeSignal(sn);
      this.ws.send(resumeMessage);

      if (this.config.debug) {
        console.log(`[Client] Sent RESUME signal with SN: ${sn}`);
      }
    } else {
      // Connection is broken, can't send resume signal
      this.resume.handleResumeFailure(sn);
    }
  }

  /**
   * Perform reconnection
   */
  private async performReconnection(): Promise<void> {
    if (this.config.debug) {
      console.log('[Client] Performing reconnection');
    }

    await this.connect();
  }

  /**
   * Set connection state
   */
  private setState(state: ConnectionState): void {
    const oldState = this.state;
    this.state = state;

    if (this.config.debug) {
      console.log(`[Client] State changed: ${oldState} -> ${state}`);
    }

    this.emit('stateChange', state, oldState);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.clearHelloTimeout();
    this.heartbeat.stop();
    this.reconnection.stop();

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get session information
   */
  getSession(): SessionInfo | undefined {
    return this.session.getSessionInfo();
  }

  /**
   * Get buffer status
   */
  getBufferStatus() {
    return this.sequencer.getBufferStatus();
  }

  // Typed event handler methods
  /**
   * Register handler for text messages
   */
  onTextMessage(handler: TextMessageHandler): void {
    this.eventManager.onTextMessage(handler);
  }

  /**
   * Register handler for user joined channel events
   */
  onJoinedChannel(handler: JoinedChannelHandler): void {
    this.eventManager.onJoinedChannel(handler);
  }

  /**
   * Register handler for user exited channel events
   */
  onExitedChannel(handler: ExitedChannelHandler): void {
    this.eventManager.onExitedChannel(handler);
  }

  /**
   * Register handler for user updated events
   */
  onUserUpdated(handler: UserUpdatedHandler): void {
    this.eventManager.onUserUpdated(handler);
  }

  /**
   * Register handler for button click events
   */
  onMessageBtnClick(handler: MessageBtnClickHandler): void {
    this.eventManager.onMessageBtnClick(handler);
  }

  /**
   * Register handler for reaction added events
   */
  onReactionAdded(handler: ReactionHandler): void {
    this.eventManager.onReactionAdded(handler);
  }

  /**
   * Register handler for reaction removed events
   */
  onReactionRemoved(handler: ReactionHandler): void {
    this.eventManager.onReactionRemoved(handler);
  }

  /**
   * Register handler for message updated events
   */
  onMessageUpdated(handler: MessageUpdatedHandler): void {
    this.eventManager.onMessageUpdated(handler);
  }

  /**
   * Register handler for message deleted events
   */
  onMessageDeleted(handler: MessageDeletedHandler): void {
    this.eventManager.onMessageDeleted(handler);
  }

  /**
   * Get the event parser for advanced usage
   */
  getEventParser(): EventParser {
    return this.eventManager.getParser();
  }
}
