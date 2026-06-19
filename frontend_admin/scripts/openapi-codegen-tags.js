const OPENAPI_TAG_CODEGEN_MAP = {
  '应用/系统': 'app-system',
  '媒体/文件': 'media-files',
  '权限/权限清单': 'access-permissions',
  '权限/租户角色': 'access-organization-roles',
  '权限/租户授权': 'access-organization-bindings',
  '权限/团队角色': 'access-team-roles',
  '权限/团队授权': 'access-team-bindings',
  '租户/基础': 'organizations',
  '租户/成员': 'organization-members',
  '租户/邀请': 'organization-invites',
  '租户/公开邀请': 'public-organization-invites',
  '租户/档案': 'organization-profile',
  '通知/消息': 'notifications',
  '通知分发': 'notificationDispatches',
  '团队/基础': 'teams',
  '用户/账户': 'user-account',
  '用户/管理': 'user-admin',
  '用户/实名': 'real-name',
  '用户/实名管理': 'real-name-admin',
  '钱包/用户': 'user-wallet',
  '钱包/管理': 'wallet-admin',
  '钱包/内部': 'wallet-internal',
  '裂变/用户': 'referrals',
  '裂变/管理': 'admin-referrals',
  '设置/租户设置': 'organization-settings',
  '设置/团队设置': 'team-settings',
  '设置/个人设置': 'user-settings',
};

const ALLAUTH_TAG_CODEGEN_MAP = {
  'Authentication: Account': 'auth-account',
  'Authentication: Password Reset': 'auth-password-reset',
  'Authentication: Providers': 'auth-providers',
  'Authentication: 2FA': 'auth-two-factor',
  'Authentication: WebAuthn: Login': 'auth-webauthn-login',
  'Authentication: Current Session': 'auth-session',
  'Authentication: Login By Code': 'auth-login-by-code',
  'Authentication: WebAuthn: Signup': 'auth-webauthn-signup',
  'Account: Email': 'account-email',
  'Account: Phone': 'account-phone',
  'Account: 2FA': 'account-two-factor',
  'Account: Password': 'account-password',
  'Account: Providers': 'account-providers',
  'Account: WebAuthn': 'account-webauthn',
  Sessions: 'sessions',
  Configuration: 'configuration',
  Tokens: 'tokens',
};

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

function hasNonAscii(value) {
  return /[^\x00-\x7F]/.test(value);
}

function rewriteTag(tag, tagMap, missingTags) {
  const mapped = tagMap[tag];
  if (mapped) {
    return mapped;
  }
  if (hasNonAscii(tag)) {
    missingTags.add(tag);
  }
  return tag;
}

function transformOpenApiTags(schema, tagMap = OPENAPI_TAG_CODEGEN_MAP) {
  const missingTags = new Set();
  const transformed = structuredClone(schema);

  if (Array.isArray(transformed.tags)) {
    transformed.tags = transformed.tags.map((tagDefinition) => {
      if (!tagDefinition || typeof tagDefinition.name !== 'string') {
        return tagDefinition;
      }
      return {
        ...tagDefinition,
        name: rewriteTag(tagDefinition.name, tagMap, missingTags),
      };
    });
  }

  for (const pathItem of Object.values(transformed.paths || {})) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !operation || typeof operation !== 'object' || !Array.isArray(operation.tags)) {
        continue;
      }
      operation.tags = operation.tags.map((tag) => rewriteTag(tag, tagMap, missingTags));
    }
  }

  if (missingTags.size > 0) {
    throw new Error(`Missing OpenAPI codegen tag mapping: ${Array.from(missingTags).sort().join(', ')}`);
  }

  return transformed;
}

function rewriteAllauthPath(pathname) {
  if (typeof pathname !== 'string') {
    return pathname;
  }
  return pathname.replace('/api/allauth/{client}/v1/', '/api/allauth/browser/v1/');
}

function transformAllauthSchema(schema, tagMap = ALLAUTH_TAG_CODEGEN_MAP) {
  const transformed = transformOpenApiTags(schema, tagMap);
  const nextPaths = {};

  for (const [pathname, pathItem] of Object.entries(transformed.paths || {})) {
    nextPaths[rewriteAllauthPath(pathname)] = pathItem;
  }

  transformed.paths = nextPaths;
  return transformed;
}

module.exports = {
  ALLAUTH_TAG_CODEGEN_MAP,
  OPENAPI_TAG_CODEGEN_MAP,
  transformAllauthSchema,
  transformOpenApiTags,
};
