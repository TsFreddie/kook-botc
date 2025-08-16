// KOOK HTTP API Client
// Based on official documentation: https://developer.kookapp.cn/doc/http/channel

/**
 * Base API response structure
 */
export interface KookApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

/**
 * Channel types
 */
export enum ApiChannelType {
  CATEGORY = 0, // Category/Group
  TEXT = 1, // Text channel
  VOICE = 2, // Voice channel
}

/**
 * Voice quality levels
 */
export enum VoiceQuality {
  SMOOTH = '1', // 流畅
  NORMAL = '2', // 正常
  HIGH = '3', // 高质量
}

/**
 * Button themes
 */
export type ButtonTheme =
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'secondary'
  | 'none';

/**
 * Permission flags for guild roles
 * Each permission is represented by a bit position (0-30)
 * To check if a permission is granted: (permissions & (1 << PermissionFlag.ADMIN)) === (1 << PermissionFlag.ADMIN)
 */
enum PermissionFlag {
  /** 管理员 - 拥有此权限会获得完整的管理权，包括绕开所有其他权限（包括频道权限）限制，属于危险权限 */
  ADMIN = 0,
  /** 管理服务器 - 拥有此权限的成员可以修改服务器名称和更换区域 */
  MANAGE_GUILD = 1,
  /** 查看管理日志 - 拥有此权限的成员可以查看服务器的管理日志 */
  VIEW_AUDIT_LOG = 2,
  /** 创建服务器邀请 - 能否创建服务器邀请链接 */
  CREATE_INVITE = 3,
  /** 管理邀请 - 拥有该权限可以管理服务器的邀请 */
  MANAGE_INVITE = 4,
  /** 频道管理 - 拥有此权限的成员可以创建新的频道以及编辑或删除已存在的频道 */
  MANAGE_CHANNELS = 5,
  /** 踢出用户 */
  KICK_MEMBERS = 6,
  /** 封禁用户 */
  BAN_MEMBERS = 7,
  /** 管理自定义表情 */
  MANAGE_EMOJIS = 8,
  /** 修改服务器昵称 - 拥有此权限的用户可以更改他们的昵称 */
  CHANGE_NICKNAME = 9,
  /** 管理角色权限 - 拥有此权限成员可以创建新的角色和编辑删除低于该角色的身份 */
  MANAGE_ROLES = 10,
  /** 查看文字、语音频道 */
  VIEW_CHANNELS = 11,
  /** 发布消息 */
  SEND_MESSAGES = 12,
  /** 管理消息 - 拥有此权限的成员可以删除其他成员发出的消息和置顶消息 */
  MANAGE_MESSAGES = 13,
  /** 上传文件 */
  UPLOAD_FILES = 14,
  /** 语音链接 */
  CONNECT_VOICE = 15,
  /** 语音管理 - 拥有此权限的成员可以把其他成员移动和踢出频道；但此类移动仅限于在该成员和被移动成员均有权限的频道之间进行 */
  MANAGE_VOICE = 16,
  /** 提及@全体成员 - 拥有此权限的成员可使用@全体成员以提及该频道中所有成员 */
  MENTION_EVERYONE = 17,
  /** 添加反应 - 拥有此权限的成员可以对消息添加新的反应 */
  ADD_REACTIONS = 18,
  /** 跟随添加反应 - 拥有此权限的成员可以跟随使用已经添加的反应 */
  FOLLOW_ADD_REACTIONS = 19,
  /** 被动连接语音频道 - 拥有此限制的成员无法主动连接语音频道，只能在被动邀请或被人移动时，才可以进入语音频道 */
  PASSIVE_CONNECT_VOICE = 20,
  /** 仅使用按键说话 - 拥有此限制的成员加入语音频道后，只能使用按键说话 */
  USE_VOICE_ACTIVITY = 21,
  /** 使用自由麦 - 没有此权限的成员，必须在频道内使用按键说话 */
  USE_FREE_MIC = 22,
  /** 说话 */
  SPEAK = 23,
  /** 服务器静音 */
  SERVER_DEAFEN = 24,
  /** 服务器闭麦 */
  SERVER_MUTE = 25,
  /** 修改他人昵称 - 拥有此权限的用户可以更改他人的昵称 */
  MANAGE_NICKNAMES = 26,
  /** 播放伴奏 - 拥有此权限的成员可在语音频道中播放音乐伴奏 */
  PLAY_ACCOMPANIMENT = 27,
  /** 屏幕分享 - 拥有此权限的成员可在频道中向别人分享自己的屏幕 */
  SCREEN_SHARE = 28,
  /** 回复帖子 - 拥有此权限的成员可以在此贴子频道回复帖子 */
  REPLY_THREAD = 29,
  /** 开启录音 - 拥有此权限的成员可在频道中开启录音 */
  START_RECORDING = 30,
}

/**
 * Permission values calculated from bit positions
 * These are the actual numeric values used in the API
 */
export enum Permission {
  /** 管理员 - 拥有此权限会获得完整的管理权，包括绕开所有其他权限（包括频道权限）限制，属于危险权限 (值: 1) */
  ADMIN = 1 << PermissionFlag.ADMIN,
  /** 管理服务器 - 拥有此权限的成员可以修改服务器名称和更换区域 (值: 2) */
  MANAGE_GUILD = 1 << PermissionFlag.MANAGE_GUILD,
  /** 查看管理日志 - 拥有此权限的成员可以查看服务器的管理日志 (值: 4) */
  VIEW_AUDIT_LOG = 1 << PermissionFlag.VIEW_AUDIT_LOG,
  /** 创建服务器邀请 - 能否创建服务器邀请链接 (值: 8) */
  CREATE_INVITE = 1 << PermissionFlag.CREATE_INVITE,
  /** 管理邀请 - 拥有该权限可以管理服务器的邀请 (值: 16) */
  MANAGE_INVITE = 1 << PermissionFlag.MANAGE_INVITE,
  /** 频道管理 - 拥有此权限的成员可以创建新的频道以及编辑或删除已存在的频道 (值: 32) */
  MANAGE_CHANNELS = 1 << PermissionFlag.MANAGE_CHANNELS,
  /** 踢出用户 (值: 64) */
  KICK_MEMBERS = 1 << PermissionFlag.KICK_MEMBERS,
  /** 封禁用户 (值: 128) */
  BAN_MEMBERS = 1 << PermissionFlag.BAN_MEMBERS,
  /** 管理自定义表情 (值: 256) */
  MANAGE_EMOJIS = 1 << PermissionFlag.MANAGE_EMOJIS,
  /** 修改服务器昵称 - 拥有此权限的用户可以更改他们的昵称 (值: 512) */
  CHANGE_NICKNAME = 1 << PermissionFlag.CHANGE_NICKNAME,
  /** 管理角色权限 - 拥有此权限成员可以创建新的角色和编辑删除低于该角色的身份 (值: 1024) */
  MANAGE_ROLES = 1 << PermissionFlag.MANAGE_ROLES,
  /** 查看文字、语音频道 (值: 2048) */
  VIEW_CHANNELS = 1 << PermissionFlag.VIEW_CHANNELS,
  /** 发布消息 (值: 4096) */
  SEND_MESSAGES = 1 << PermissionFlag.SEND_MESSAGES,
  /** 管理消息 - 拥有此权限的成员可以删除其他成员发出的消息和置顶消息 (值: 8192) */
  MANAGE_MESSAGES = 1 << PermissionFlag.MANAGE_MESSAGES,
  /** 上传文件 (值: 16384) */
  UPLOAD_FILES = 1 << PermissionFlag.UPLOAD_FILES,
  /** 语音链接 (值: 32768) */
  CONNECT_VOICE = 1 << PermissionFlag.CONNECT_VOICE,
  /** 语音管理 - 拥有此权限的成员可以把其他成员移动和踢出频道；但此类移动仅限于在该成员和被移动成员均有权限的频道之间进行 (值: 65536) */
  MANAGE_VOICE = 1 << PermissionFlag.MANAGE_VOICE,
  /** 提及@全体成员 - 拥有此权限的成员可使用@全体成员以提及该频道中所有成员 (值: 131072) */
  MENTION_EVERYONE = 1 << PermissionFlag.MENTION_EVERYONE,
  /** 添加反应 - 拥有此权限的成员可以对消息添加新的反应 (值: 262144) */
  ADD_REACTIONS = 1 << PermissionFlag.ADD_REACTIONS,
  /** 跟随添加反应 - 拥有此权限的成员可以跟随使用已经添加的反应 (值: 524288) */
  FOLLOW_ADD_REACTIONS = 1 << PermissionFlag.FOLLOW_ADD_REACTIONS,
  /** 被动连接语音频道 - 拥有此限制的成员无法主动连接语音频道，只能在被动邀请或被人移动时，才可以进入语音频道 (值: 1048576) */
  PASSIVE_CONNECT_VOICE = 1 << PermissionFlag.PASSIVE_CONNECT_VOICE,
  /** 仅使用按键说话 - 拥有此限制的成员加入语音频道后，只能使用按键说话 (值: 2097152) */
  USE_VOICE_ACTIVITY = 1 << PermissionFlag.USE_VOICE_ACTIVITY,
  /** 使用自由麦 - 没有此权限的成员，必须在频道内使用按键说话 (值: 4194304) */
  USE_FREE_MIC = 1 << PermissionFlag.USE_FREE_MIC,
  /** 说话 (值: 8388608) */
  SPEAK = 1 << PermissionFlag.SPEAK,
  /** 服务器静音 (值: 16777216) */
  SERVER_DEAFEN = 1 << PermissionFlag.SERVER_DEAFEN,
  /** 服务器闭麦 (值: 33554432) */
  SERVER_MUTE = 1 << PermissionFlag.SERVER_MUTE,
  /** 修改他人昵称 - 拥有此权限的用户可以更改他人的昵称 (值: 67108864) */
  MANAGE_NICKNAMES = 1 << PermissionFlag.MANAGE_NICKNAMES,
  /** 播放伴奏 - 拥有此权限的成员可在语音频道中播放音乐伴奏 (值: 134217728) */
  PLAY_ACCOMPANIMENT = 1 << PermissionFlag.PLAY_ACCOMPANIMENT,
  /** 屏幕分享 - 拥有此权限的成员可在频道中向别人分享自己的屏幕 (值: 268435456) */
  SCREEN_SHARE = 1 << PermissionFlag.SCREEN_SHARE,
  /** 回复帖子 - 拥有此权限的成员可以在此贴子频道回复帖子 (值: 536870912) */
  REPLY_THREAD = 1 << PermissionFlag.REPLY_THREAD,
  /** 开启录音 - 拥有此权限的成员可在频道中开启录音 (值: 1073741824) */
  START_RECORDING = 1 << PermissionFlag.START_RECORDING,
}

/**
 * Utility functions for working with permissions
 */
export class PermissionUtils {
  /**
   * Check if a permission set has a specific permission
   */
  static hasPermission(permissions: number, permission: Permission | PermissionFlag): boolean {
    const permissionValue =
      typeof permission === 'number' && permission < 31
        ? 1 << permission // It's a PermissionFlag
        : permission; // It's a Permission value
    return (permissions & permissionValue) === permissionValue;
  }

  /**
   * Add a permission to a permission set
   */
  static addPermission(permissions: number, permission: Permission | PermissionFlag): number {
    const permissionValue =
      typeof permission === 'number' && permission < 31
        ? 1 << permission // It's a PermissionFlag
        : permission; // It's a Permission value
    return permissions | permissionValue;
  }

  /**
   * Remove a permission from a permission set
   */
  static removePermission(permissions: number, permission: Permission | PermissionFlag): number {
    const permissionValue =
      typeof permission === 'number' && permission < 31
        ? 1 << permission // It's a PermissionFlag
        : permission; // It's a Permission value
    return permissions & ~permissionValue;
  }

  /**
   * Get all permissions that are granted in a permission set
   */
  static getGrantedPermissions(permissions: number): Permission[] {
    const granted: Permission[] = [];
    for (let i = 0; i <= 30; i++) {
      const permissionValue = 1 << i;
      if ((permissions & permissionValue) === permissionValue) {
        granted.push(permissionValue as Permission);
      }
    }
    return granted;
  }

  /**
   * Create a permission set from multiple permissions
   */
  static combinePermissions(...permissions: (Permission | PermissionFlag)[]): number {
    return permissions.reduce((combined, permission) => {
      const permissionValue =
        typeof permission === 'number' && permission < 31
          ? 1 << permission // It's a PermissionFlag
          : permission; // It's a Permission value
      return combined | permissionValue;
    }, 0);
  }
}

/**
 * Channel permission overwrite
 */
export interface ChannelPermissionOverwrite {
  role_id: number;
  allow: number;
  deny: number;
}

/**
 * Channel permission user
 */
export interface ChannelPermissionUser {
  user: {
    id: string;
    username: string;
    identify_num: string;
    online: boolean;
    os: string;
    status: number;
    avatar: string;
    vip_avatar?: string;
    banner?: string;
    nickname: string;
    roles: number[];
    is_vip: boolean;
    is_ai_reduce_noise?: boolean;
    bot: boolean;
    tag_info?: {
      color: string;
      text: string;
    };
    mobile_verified: boolean;
    joined_at: number;
    active_time: number;
  };
  allow: number;
  deny: number;
}

/**
 * Channel information
 */
export interface Channel {
  id: string;
  guild_id?: string;
  user_id: string;
  parent_id: string;
  name: string;
  topic?: string;
  type: ApiChannelType;
  level: number;
  slow_mode?: number;
  has_password?: boolean;
  limit_amount: number;
  is_category: boolean;
  permission_sync?: number;
  permission_overwrites?: ChannelPermissionOverwrite[];
  permission_users?: ChannelPermissionUser[];
  voice_quality?: VoiceQuality;
  server_url?: string;
  children?: string[];
}

/**
 * Channel list response with pagination
 */
export interface ChannelListResponse {
  items: Channel[];
  meta: {
    page: number;
    page_total: number;
    page_size: number;
    total: number;
  };
  sort: any[];
}

/**
 * Parameters for creating a channel
 */
export interface CreateChannelParams {
  guild_id: string;
  name: string;
  parent_id?: string;
  type?: ApiChannelType;
  limit_amount?: number;
  voice_quality?: VoiceQuality;
  is_category?: 0 | 1;
}

/**
 * Parameters for updating a channel
 */
export interface UpdateChannelParams {
  channel_id: string;
  name?: string;
  level?: number;
  parent_id?: string;
  topic?: string;
  slow_mode?: number;
  limit_amount?: number;
  voice_quality?: VoiceQuality;
  password?: string;
}

/**
 * Parameters for getting channel list
 */
export interface GetChannelListParams {
  guild_id: string;
  page?: number;
  page_size?: number;
  type?: ApiChannelType;
  parent_id?: string;
}

/**
 * Parameters for getting channel details
 */
export interface GetChannelParams {
  target_id: string;
  need_children?: boolean;
}

/**
 * Guild role information
 */
export interface GuildRole {
  role_id: number;
  name: string;
  color: number;
  position: number;
  hoist: number;
  mentionable: number;
  permissions: number; // Use Permission enum values or PermissionUtils for manipulation
}

/**
 * Guild role list response with pagination
 */
export interface GuildRoleListResponse {
  items: GuildRole[];
  meta: {
    page: number;
    page_total: number;
    page_size: number;
    total: number;
  };
  sort: any;
}

/**
 * Parameters for getting guild role list
 */
export interface GetGuildRoleListParams {
  guild_id: string;
  page?: number;
  page_size?: number;
}

/**
 * Parameters for creating a guild role
 */
export interface CreateGuildRoleParams {
  guild_id: string;
  name?: string;
}

/**
 * Parameters for updating a guild role
 */
export interface UpdateGuildRoleParams {
  guild_id: string;
  role_id: number;
  name?: string;
  color?: number;
  hoist?: number;
  mentionable?: number;
  permissions?: number; // Use Permission enum values or PermissionUtils.combinePermissions()
}

/**
 * Parameters for deleting a guild role
 */
export interface DeleteGuildRoleParams {
  guild_id: string;
  role_id: number;
}

/**
 * Parameters for granting/revoking user role
 */
export interface UserRoleParams {
  guild_id: string;
  user_id: string;
  role_id: number;
}

/**
 * User role response
 */
export interface UserRoleResponse {
  user_id: string;
  guild_id: string;
  roles: number[];
}

/**
 * Channel role permission details response
 */
export interface ChannelRolePermissionResponse {
  permission_overwrites: ChannelPermissionOverwrite[];
  permission_users: ChannelPermissionUser[];
  permission_sync: number;
}

/**
 * Channel role permission type
 */
export type ChannelRolePermissionType = 'role_id' | 'user_id';

/**
 * Parameters for creating channel role permission
 */
export interface CreateChannelRolePermissionParams {
  channel_id: string;
  type?: ChannelRolePermissionType;
  value?: string;
}

/**
 * Parameters for updating channel role permission
 */
export interface UpdateChannelRolePermissionParams {
  channel_id: string;
  type?: ChannelRolePermissionType;
  value?: string;
  allow?: number;
  deny?: number;
}

/**
 * Parameters for deleting channel role permission
 */
export interface DeleteChannelRolePermissionParams {
  channel_id: string;
  type?: ChannelRolePermissionType;
  value?: string;
}

/**
 * Channel role permission operation response
 */
export interface ChannelRolePermissionOperationResponse {
  user_id?: string;
  role_id?: number;
  allow: number;
  deny: number;
}

/**
 * Message types
 */
export enum ApiMessageType {
  TEXT = 1, // 文字消息
  IMAGE = 2, // 图片消息
  VIDEO = 3, // 视频消息
  FILE = 4, // 文件消息
  AUDIO = 8, // 音频消息
  KMARKDOWN = 9, // KMarkdown 消息
  CARD = 10, // 卡片消息
}

/**
 * Message query flag
 */
export type MessageQueryFlag = 'before' | 'around' | 'after';

/**
 * Message author information
 */
export interface MessageAuthor {
  id: string;
  username: string;
  identify_num?: string;
  online: boolean;
  os?: string;
  status: number;
  avatar: string;
  vip_avatar?: string;
  banner?: string;
  nickname?: string;
  roles?: number[];
  is_vip?: boolean;
  is_ai_reduce_noise?: boolean;
  bot: boolean;
  tag_info?: {
    color: string;
    text: string;
  };
  mobile_verified?: boolean;
  joined_at?: number;
  active_time?: number;
}

/**
 * Message embed information
 */
export interface MessageEmbed {
  type: string;
  url?: string;
  origin_url?: string;
  av_no?: string;
  iframe_path?: string;
  duration?: number;
  title?: string;
  pic?: string;
}

/**
 * Message attachment information
 */
export interface MessageAttachment {
  type: string;
  url: string;
  name: string;
  file_type?: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
}

/**
 * Message reaction information
 */
export interface MessageReaction {
  emoji: {
    id: string;
    name: string;
  };
  count: number;
  me: boolean;
}

/**
 * Message quote information
 */
export interface MessageQuote {
  id: string;
  type: number;
  content: string;
  create_at: number;
  author: MessageAuthor;
}

/**
 * Message mention information
 */
export interface MessageMentionInfo {
  mention_part: Array<{
    id: string;
    username: string;
    full_name: string;
    avatar: string;
  }>;
  mention_role_part: Array<{
    role_id: number;
    name: string;
    color: number;
    position: number;
    hoist: number;
    mentionable: number;
    permissions: number;
  }>;
}

/**
 * Message information
 */
export interface Message {
  id: string;
  type: ApiMessageType;
  content: string;
  mention: string[];
  mention_all: boolean;
  mention_roles: number[];
  mention_here: boolean;
  embeds: MessageEmbed[];
  attachments: MessageAttachment | null;
  create_at: number;
  updated_at: number;
  reactions: MessageReaction[];
  author: MessageAuthor;
  image_name?: string;
  read_status?: boolean;
  quote: MessageQuote | null;
  mention_info: MessageMentionInfo;
  channel_id?: string; // Only present in message view response
}

/**
 * Message list response
 */
export interface MessageListResponse {
  items: Message[];
}

/**
 * Parameters for getting message list
 */
export interface GetMessageListParams {
  target_id: string;
  msg_id?: string;
  pin?: 0 | 1;
  flag?: MessageQueryFlag;
  page_size?: number;
}

/**
 * Parameters for getting message details
 */
export interface GetMessageParams {
  msg_id: string;
}

/**
 * Parameters for creating a message
 */
export interface CreateMessageParams {
  type?: ApiMessageType;
  target_id: string;
  content: string;
  quote?: string;
  nonce?: string;
  temp_target_id?: string;
  template_id?: string;
}

/**
 * Parameters for updating a message
 */
export interface UpdateMessageParams {
  msg_id: string;
  content: string;
  quote?: string;
  temp_target_id?: string;
  template_id?: string;
}

/**
 * Parameters for deleting a message
 */
export interface DeleteMessageParams {
  msg_id: string;
}

/**
 * Parameters for getting message reaction list
 */
export interface GetMessageReactionListParams {
  msg_id: string;
  emoji: string;
}

/**
 * Parameters for adding message reaction
 */
export interface AddMessageReactionParams {
  msg_id: string;
  emoji: string;
}

/**
 * Parameters for deleting message reaction
 */
export interface DeleteMessageReactionParams {
  msg_id: string;
  emoji: string;
  user_id?: string;
}

/**
 * Parameters for sending pipe message
 */
export interface SendPipeMessageParams {
  access_token: string;
  type?: ApiMessageType;
  target_id?: string;
  content?: any; // Can be string or object depending on template usage
}

/**
 * Message creation response
 */
export interface MessageCreateResponse {
  msg_id: string;
  msg_timestamp: number;
  nonce: string;
}

/**
 * Message reaction user information
 */
export interface MessageReactionUser {
  id: string;
  username: string;
  nickname: string;
  identify_num: string;
  online: boolean;
  status: number;
  avatar: string;
  bot: boolean;
  tag_info?: {
    color: string;
    text: string;
  };
  reaction_time: number;
}

/**
 * Invite information
 */
export interface Invite {
  guild_id: string;
  channel_id: string;
  url_code: string;
  url: string;
  user: {
    id: string;
    username: string;
    identify_num: string;
    online: boolean;
    status: number;
    bot: boolean;
    avatar: string;
    vip_avatar?: string;
  };
}

/**
 * Invite list response with pagination
 */
export interface InviteListResponse {
  items: Invite[];
  meta: {
    page: number;
    page_total: number;
    page_size: number;
    total: number;
  };
  sort: any;
}

/**
 * Parameters for getting invite list
 */
export interface GetInviteListParams {
  guild_id?: string;
  channel_id?: string;
  page?: number;
  page_size?: number;
}

/**
 * Parameters for creating an invite
 */
export interface CreateInviteParams {
  guild_id?: string;
  channel_id?: string;
  duration?: number;
  setting_times?: number;
}

/**
 * Parameters for deleting an invite
 */
export interface DeleteInviteParams {
  url_code: string;
  guild_id?: string;
  channel_id?: string;
}

/**
 * Invite creation response
 */
export interface InviteCreateResponse {
  url: string;
}

/**
 * Template message types
 */
export enum TemplateMessageType {
  KMD = 1, // KMarkdown message
  CARD_JSON = 2, // Card message via JSON
  CARD_YAML = 3, // Card message via YAML
}

/**
 * Template status
 */
export enum TemplateStatus {
  NOT_REVIEWED = 0, // 未审核
  REVIEWING = 1, // 审核中
  APPROVED = 2, // 审核通过
  REJECTED = 3, // 审核拒绝
}

/**
 * Template type
 */
export enum TemplateType {
  TWIG = 0, // Twig template engine
}

/**
 * Template information
 */
export interface Template {
  id: string;
  title: string;
  type: TemplateType;
  msgtype: TemplateMessageType;
  status: TemplateStatus;
  test_data: string;
  test_channel: string;
  content: string;
}

/**
 * Template list response with pagination
 */
export interface TemplateListResponse {
  items: Template[];
  meta: {
    page: number;
    page_total: number;
    page_size: number;
    total: number;
  };
  sort: any[];
}

/**
 * Parameters for creating a template
 */
export interface CreateTemplateParams {
  title: string;
  content: string;
  test_data?: string;
  msgtype?: TemplateMessageType;
  type?: TemplateType;
  test_channel?: string;
}

/**
 * Parameters for updating a template
 */
export interface UpdateTemplateParams {
  id: string;
  title?: string;
  content?: string;
  test_data?: string;
  msgtype?: TemplateMessageType;
  type?: TemplateType;
  test_channel?: string;
}

/**
 * Parameters for deleting a template
 */
export interface DeleteTemplateParams {
  id: string;
}

/**
 * Template creation/update response
 */
export interface TemplateOperationResponse {
  model: Template;
}

/**
 * Asset upload response
 */
export interface AssetUploadResponse {
  url: string;
}

/**
 * Parameters for uploading an asset
 */
export interface UploadAssetParams {
  file: File | Blob;
}

/**
 * KOOK HTTP API Client
 */
export class KookApiClient {
  private token: string;
  private baseUrl: string = 'https://www.kookapp.cn/api/v3';
  private debug: boolean;

  constructor(token: string, debug: boolean = false) {
    this.token = token;
    this.debug = debug;
  }

  /**
   * Make HTTP request to KOOK API
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    params?: Record<string, any>,
  ): Promise<KookApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bot ${this.token}`,
      'Content-Type': 'application/json',
    };

    let requestUrl = url;
    let body: string | undefined;

    if (method === 'GET' && params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      requestUrl = `${url}?${searchParams}`;
    } else if (method === 'POST' && params) {
      body = JSON.stringify(params);
    }

    if (this.debug) {
      console.log(`[API] ${method} ${requestUrl.replace(this.token, '***')}`);
      if (body) {
        console.log(`[API] Body:`, params);
      }
    }

    try {
      const response = await fetch(requestUrl, {
        method,
        headers,
        body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as KookApiResponse<T>;

      if (data.code !== 0) {
        throw new Error(`API Error ${endpoint}\n${data.code}: ${data.message}`);
      }

      if (this.debug) {
        console.log(`[API] Response:`, data);
        console.log(`[API] Headers:`, response.headers);
      }

      return data;
    } catch (error) {
      if (this.debug) {
        console.error(`[API] Request failed:`, error);
      }
      throw error;
    }
  }

  /**
   * Make HTTP request with form-data to KOOK API
   */
  private async makeFormDataRequest<T>(
    endpoint: string,
    formData: FormData,
  ): Promise<KookApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bot ${this.token}`,
      // Don't set Content-Type for FormData, let the browser set it with boundary
    };

    if (this.debug) {
      console.log(`[API] POST ${url.replace(this.token, '***')}`);
      console.log(`[API] FormData:`, Array.from(formData.entries()));
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as KookApiResponse<T>;

      if (data.code !== 0) {
        throw new Error(`API Error ${endpoint}\n${data.code}: ${data.message}`);
      }

      if (this.debug) {
        console.log(`[API] Response:`, data);
        console.log(`[API] Headers:`, response.headers);
      }

      return data;
    } catch (error) {
      if (this.debug) {
        console.error(`[API] Request failed:`, error);
      }
      throw error;
    }
  }

  /**
   * Get channel list
   */
  async channelList(params: GetChannelListParams): Promise<ChannelListResponse> {
    const response = await this.makeRequest<ChannelListResponse>('/channel/list', 'GET', params);
    return response.data;
  }

  /**
   * Get channel details
   */
  async channelView(params: GetChannelParams): Promise<Channel> {
    const response = await this.makeRequest<Channel>('/channel/view', 'GET', params);
    return response.data;
  }

  /**
   * Create a new channel
   */
  async channelCreate(params: CreateChannelParams): Promise<Channel> {
    const response = await this.makeRequest<Channel>('/channel/create', 'POST', params);
    return response.data;
  }

  /**
   * Update an existing channel
   */
  async channelUpdate(params: UpdateChannelParams): Promise<Channel> {
    const response = await this.makeRequest<Channel>('/channel/update', 'POST', params);
    return response.data;
  }

  /**
   * Delete a channel
   */
  async channelDelete(channelId: string): Promise<void> {
    await this.makeRequest('/channel/delete', 'POST', {
      channel_id: channelId,
    });
  }

  /**
   * Get users in a voice channel
   */
  async channelUserList(channelId: string): Promise<any[]> {
    const response = await this.makeRequest<any[]>('/channel/user-list', 'GET', {
      channel_id: channelId,
    });
    return response.data;
  }

  /**
   * Move users between voice channels
   */
  async channelMoveUser(targetChannelId: string, userIds: string[]): Promise<void> {
    await this.makeRequest('/channel/move-user', 'POST', {
      target_id: targetChannelId,
      user_ids: userIds,
    });
  }

  /**
   * Kick user from voice channel
   */
  async channelKickout(channelId: string, userId: string): Promise<void> {
    await this.makeRequest('/channel/kickout', 'POST', {
      channel_id: channelId,
      user_id: userId,
    });
  }

  /**
   * Mute user in guild (server mute)
   */
  async guildMuteCreate(guildId: string, userId: string, type: 1 | 2): Promise<void> {
    await this.makeRequest('/guild-mute/create', 'POST', {
      guild_id: guildId,
      user_id: userId,
      type: type, // 1 = mic mute, 2 = headset mute
    });
  }

  /**
   * Unmute user in guild (remove server mute)
   */
  async guildMuteDelete(guildId: string, userId: string, type: 1 | 2): Promise<void> {
    await this.makeRequest('/guild-mute/delete', 'POST', {
      guild_id: guildId,
      user_id: userId,
      type: type, // 1 = mic mute, 2 = headset mute
    });
  }

  /**
   * Get guild role list
   */
  async roleList(params: GetGuildRoleListParams): Promise<GuildRoleListResponse> {
    const response = await this.makeRequest<GuildRoleListResponse>(
      '/guild-role/list',
      'GET',
      params,
    );
    return response.data;
  }

  /**
   * Create a new guild role
   */
  async roleCreate(params: CreateGuildRoleParams): Promise<GuildRole> {
    const response = await this.makeRequest<GuildRole>('/guild-role/create', 'POST', params);
    return response.data;
  }

  /**
   * Update an existing guild role
   */
  async roleUpdate(params: UpdateGuildRoleParams): Promise<GuildRole> {
    const response = await this.makeRequest<GuildRole>('/guild-role/update', 'POST', params);
    return response.data;
  }

  /**
   * Delete a guild role
   */
  async roleDelete(params: DeleteGuildRoleParams): Promise<void> {
    await this.makeRequest('/guild-role/delete', 'POST', params);
  }

  /**
   * Grant a role to a user
   */
  async roleGrant(params: UserRoleParams): Promise<UserRoleResponse> {
    const response = await this.makeRequest<UserRoleResponse>('/guild-role/grant', 'POST', params);
    return response.data;
  }

  /**
   * Revoke a role from a user
   */
  async roleRevoke(params: UserRoleParams): Promise<UserRoleResponse> {
    const response = await this.makeRequest<UserRoleResponse>('/guild-role/revoke', 'POST', params);
    return response.data;
  }

  /**
   * Get channel role permission details
   */
  async channelRoleIndex(channelId: string): Promise<ChannelRolePermissionResponse> {
    const response = await this.makeRequest<ChannelRolePermissionResponse>(
      '/channel-role/index',
      'GET',
      {
        channel_id: channelId,
      },
    );
    return response.data;
  }

  /**
   * Create channel role permission
   */
  async channelRoleCreate(
    params: CreateChannelRolePermissionParams,
  ): Promise<ChannelRolePermissionOperationResponse> {
    const response = await this.makeRequest<ChannelRolePermissionOperationResponse>(
      '/channel-role/create',
      'POST',
      params,
    );
    return response.data;
  }

  /**
   * Update channel role permission
   */
  async channelRoleUpdate(
    params: UpdateChannelRolePermissionParams,
  ): Promise<ChannelRolePermissionOperationResponse> {
    const response = await this.makeRequest<ChannelRolePermissionOperationResponse>(
      '/channel-role/update',
      'POST',
      params,
    );
    return response.data;
  }

  /**
   * Sync channel role permissions with parent category
   */
  async channelRoleSync(channelId: string): Promise<ChannelRolePermissionResponse> {
    const response = await this.makeRequest<ChannelRolePermissionResponse>(
      '/channel-role/sync',
      'POST',
      {
        channel_id: channelId,
      },
    );
    return response.data;
  }

  /**
   * Delete channel role permission
   */
  async channelRoleDelete(params: DeleteChannelRolePermissionParams): Promise<void> {
    await this.makeRequest('/channel-role/delete', 'POST', params);
  }

  /**
   * Get message list
   */
  async messageList(params: GetMessageListParams): Promise<MessageListResponse> {
    const response = await this.makeRequest<MessageListResponse>('/message/list', 'GET', params);
    return response.data;
  }

  /**
   * Get message details
   */
  async messageView(params: GetMessageParams): Promise<Message> {
    const response = await this.makeRequest<Message>('/message/view', 'GET', params);
    return response.data;
  }

  /**
   * Create a new message
   */
  async messageCreate(params: CreateMessageParams): Promise<MessageCreateResponse> {
    const response = await this.makeRequest<MessageCreateResponse>(
      '/message/create',
      'POST',
      params,
    );
    return response.data;
  }

  /**
   * Update an existing message
   */
  async messageUpdate(params: UpdateMessageParams): Promise<void> {
    await this.makeRequest('/message/update', 'POST', params);
  }

  /**
   * Delete a message
   */
  async messageDelete(params: DeleteMessageParams): Promise<void> {
    await this.makeRequest('/message/delete', 'POST', params);
  }

  /**
   * Get message reaction user list
   */
  async messageReactionList(params: GetMessageReactionListParams): Promise<MessageReactionUser[]> {
    const response = await this.makeRequest<MessageReactionUser[]>(
      '/message/reaction-list',
      'GET',
      params,
    );
    return response.data;
  }

  /**
   * Add reaction to a message
   */
  async messageAddReaction(params: AddMessageReactionParams): Promise<void> {
    await this.makeRequest('/message/add-reaction', 'POST', params);
  }

  /**
   * Delete reaction from a message
   */
  async messageDeleteReaction(params: DeleteMessageReactionParams): Promise<void> {
    await this.makeRequest('/message/delete-reaction', 'POST', params);
  }

  /**
   * Send pipe message
   */
  async messageSendPipe(params: SendPipeMessageParams): Promise<MessageCreateResponse> {
    const { access_token, type, target_id, content } = params;

    // Build query parameters
    const queryParams: Record<string, any> = { access_token };
    if (type !== undefined) queryParams.type = type;
    if (target_id !== undefined) queryParams.target_id = target_id;

    // Build URL with query parameters
    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const url = `${this.baseUrl}/message/send-pipemsg?${searchParams}`;

    // Make request with content as body
    const headers: Record<string, string> = {
      Authorization: `Bot ${this.token}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: typeof content === 'string' ? JSON.stringify({ content }) : JSON.stringify(content),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as KookApiResponse<MessageCreateResponse>;

    if (data.code !== 0) {
      throw new Error(`API Error ${data.code}: ${data.message}`);
    }

    return data.data;
  }

  /**
   * Get invite list
   */
  async inviteList(params: GetInviteListParams): Promise<InviteListResponse> {
    const response = await this.makeRequest<InviteListResponse>('/invite/list', 'GET', params);
    return response.data;
  }

  /**
   * Create an invite link
   */
  async inviteCreate(params: CreateInviteParams): Promise<InviteCreateResponse> {
    const response = await this.makeRequest<InviteCreateResponse>('/invite/create', 'POST', params);
    return response.data;
  }

  /**
   * Delete an invite link
   */
  async inviteDelete(params: DeleteInviteParams): Promise<void> {
    await this.makeRequest('/invite/delete', 'POST', params);
  }

  /**
   * Get template list
   */
  async templateList(): Promise<TemplateListResponse> {
    const response = await this.makeRequest<TemplateListResponse>('/template/list', 'GET');
    return response.data;
  }

  /**
   * Create a new template
   */
  async templateCreate(params: CreateTemplateParams): Promise<TemplateOperationResponse> {
    const response = await this.makeRequest<TemplateOperationResponse>(
      '/template/create',
      'POST',
      params,
    );
    return response.data;
  }

  /**
   * Update an existing template
   */
  async templateUpdate(params: UpdateTemplateParams): Promise<TemplateOperationResponse> {
    const response = await this.makeRequest<TemplateOperationResponse>(
      '/template/update',
      'POST',
      params,
    );
    return response.data;
  }

  /**
   * Delete a template
   */
  async templateDelete(params: DeleteTemplateParams): Promise<void> {
    await this.makeRequest('/template/delete', 'POST', params);
  }

  /**
   * Upload an asset (image, video, file)
   * Supports images, videos (.mp4, .mov), and files
   */
  async assetCreate(params: UploadAssetParams): Promise<AssetUploadResponse> {
    const formData = new FormData();
    formData.append('file', params.file);

    const response = await this.makeFormDataRequest<AssetUploadResponse>('/asset/create', formData);
    return response.data;
  }
}
