/**
 * Extrae tokenCtx desde authInfo del SDK.
 */

export function tokenDesdeAuthInfo(authInfo) {
  const extra = authInfo?.extra || {};
  if (!extra.tokenId) return null;
  return {
    tokenId: extra.tokenId,
    label: extra.label,
    email: extra.email,
    scopes: new Set(extra.scopes || authInfo.scopes || []),
    author: extra.author || `MCP · ${extra.label || 'token'}`,
  };
}

export function authInfoDesdeToken(ctx, rawToken = 'tbw_') {
  return {
    token: rawToken,
    clientId: ctx.tokenId,
    scopes: [...ctx.scopes],
    extra: {
      tokenId: ctx.tokenId,
      label: ctx.label,
      email: ctx.email,
      scopes: [...ctx.scopes],
      author: ctx.author,
    },
  };
}
