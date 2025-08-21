import data from './data.json';

type Role = (typeof data)[number];

export interface ScriptInput {
  name?: string;
  level?: number;
  author?: string;
  roles: { id: string }[];
  min_player?: number;
  max_player?: number;
}

export interface ScriptMetadata {
  name: string;
  level?: number;
  author?: string;
  min_player?: number;
  max_player?: number;
}

export interface ScriptRoles {
  roles: { id: string }[];
}

export interface ValidatedScript {
  metadata: ScriptMetadata;
  roles: ScriptRoles;
  resolvedRoles: Role[];
}

const normalizeId = (id: string) => {
  return id.toLowerCase().replace(/[ -_]/g, '');
};

/**
 * Validate input types for script data
 */
function validateInputTypes(scriptData: any): void {
  // Check if scriptData is an object
  if (typeof scriptData !== 'object' || scriptData === null || Array.isArray(scriptData)) {
    throw new Error('剧本数据必须是一个对象');
  }

  // Validate name type
  if (scriptData.name !== undefined && typeof scriptData.name !== 'string') {
    throw new Error('剧本名称必须是字符串类型');
  }

  // Validate level type
  if (scriptData.level !== undefined && typeof scriptData.level !== 'number') {
    throw new Error('难度等级必须是数字类型');
  }

  // Validate author type
  if (scriptData.author !== undefined && typeof scriptData.author !== 'string') {
    throw new Error('作者必须是字符串类型');
  }

  // Validate min_player type
  if (scriptData.min_player !== undefined && typeof scriptData.min_player !== 'number') {
    throw new Error('最少人数必须是数字类型');
  }

  // Validate max_player type
  if (scriptData.max_player !== undefined && typeof scriptData.max_player !== 'number') {
    throw new Error('最多人数必须是数字类型');
  }

  // Validate that min_player and max_player both exist or both don't exist
  const hasMinPlayer = scriptData.min_player !== undefined;
  const hasMaxPlayer = scriptData.max_player !== undefined;

  if (hasMinPlayer !== hasMaxPlayer) {
    throw new Error('最少人数和最多人数必须同时提供或同时省略');
  }

  // Validate roles type
  if (!scriptData.roles || !Array.isArray(scriptData.roles)) {
    throw new Error('角色列表必须是数组类型');
  }

  // Validate each role in the array
  for (let i = 0; i < scriptData.roles.length; i++) {
    const role = scriptData.roles[i];
    if (typeof role !== 'object' || role === null || Array.isArray(role)) {
      throw new Error(`角色[${i}]必须是对象类型`);
    }
    if (typeof role.id !== 'string') {
      throw new Error(`角色[${i}]的id必须是字符串类型`);
    }
  }
}

/**
 * Validate and parse script input, separating metadata and roles
 */
export function validateAndSeparateScript(scriptData: ScriptInput): ValidatedScript {
  // First validate input types
  validateInputTypes(scriptData);

  // Validate required fields
  if (!scriptData.roles || !Array.isArray(scriptData.roles) || scriptData.roles.length === 0) {
    throw new Error('剧本必须至少包含一个角色');
  }

  // Create a map for faster lookup with normalized IDs
  const rolesMap = new Map<string, Role>();
  for (const role of data) {
    rolesMap.set(normalizeId(role.id), role);
  }

  // Validate roles and check for missing ones
  const resolvedRoles: Role[] = [];
  const missingRoles: string[] = [];

  for (const { id } of scriptData.roles) {
    const normalizedInputId = normalizeId(id);
    const role = rolesMap.get(normalizedInputId);

    if (role) {
      resolvedRoles.push(role);
    } else {
      missingRoles.push(id);
    }
  }

  // If there are missing roles, throw error
  if (missingRoles.length > 0) {
    throw new Error(`没有找到这些角色：${missingRoles.join(', ')}`);
  }

  // Separate metadata and roles
  const metadata: ScriptMetadata = {
    name: scriptData.name?.trim() || '未命名剧本',
    level: scriptData.level,
    author: scriptData.author?.trim(),
    min_player: scriptData.min_player,
    max_player: scriptData.max_player,
  };

  // Remove undefined values from metadata
  Object.keys(metadata).forEach((key) => {
    if (metadata[key as keyof ScriptMetadata] === undefined) {
      delete metadata[key as keyof ScriptMetadata];
    }
  });

  const roles: ScriptRoles = {
    roles: scriptData.roles,
  };

  return {
    metadata,
    roles,
    resolvedRoles,
  };
}

/**
 * Validate script metadata
 */
export function validateMetadata(metadata: ScriptMetadata): void {
  if (!metadata.name || metadata.name.trim() === '') {
    throw new Error('剧本名称不能为空');
  }

  if (metadata.level !== undefined && (metadata.level < 1 || metadata.level > 5)) {
    throw new Error('难度必须在1-5之间');
  }

  // Validate that min_player and max_player both exist or both don't exist
  const hasMinPlayer = metadata.min_player !== undefined;
  const hasMaxPlayer = metadata.max_player !== undefined;

  if (hasMinPlayer !== hasMaxPlayer) {
    throw new Error('最少人数和最多人数必须同时提供或同时省略');
  }

  if (metadata.min_player !== undefined && metadata.min_player < 5) {
    throw new Error('最少人数不能少于5人');
  }

  if (metadata.max_player !== undefined && metadata.max_player > 20) {
    throw new Error('最多人数不能超过20人');
  }

  if (
    metadata.min_player !== undefined &&
    metadata.max_player !== undefined &&
    metadata.min_player > metadata.max_player
  ) {
    throw new Error('最少人数不能大于最多人数');
  }
}

/**
 * Validate script roles
 */
export function validateRoles(roles: ScriptRoles): Role[] {
  if (!roles.roles || !Array.isArray(roles.roles) || roles.roles.length === 0) {
    throw new Error('剧本必须至少包含一个角色');
  }

  // Create a map for faster lookup with normalized IDs
  const rolesMap = new Map<string, Role>();
  for (const role of data) {
    rolesMap.set(normalizeId(role.id), role);
  }

  // Validate roles and check for missing ones
  const resolvedRoles: Role[] = [];
  const missingRoles: string[] = [];

  for (const { id } of roles.roles) {
    const normalizedInputId = normalizeId(id);
    const role = rolesMap.get(normalizedInputId);

    if (role) {
      resolvedRoles.push(role);
    } else {
      missingRoles.push(id);
    }
  }

  // If there are missing roles, throw error
  if (missingRoles.length > 0) {
    throw new Error(`没有找到这些角色：${missingRoles.join(', ')}`);
  }

  return resolvedRoles;
}

/**
 * Combine metadata and roles back into a script input format
 */
export function combineScript(metadata: ScriptMetadata, roles: ScriptRoles): ScriptInput {
  return {
    ...metadata,
    ...roles,
  };
}
