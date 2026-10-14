/**
 * URLs firmadas HMAC para descargar assets sin cookie.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

function secret() {
  const s = process.env.MCP_DOWNLOAD_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error('Falta MCP_DOWNLOAD_SECRET o SESSION_SECRET');
  return s;
}

export function firmarAsset(assetId, ttlSec = 600) {
  const exp = Math.floor(Date.now() / 1000) + Math.min(Math.max(Number(ttlSec) || 600, 60), 3600);
  const payload = `${assetId}.${exp}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return { assetId, exp, sig };
}

export function verificarFirma(assetId, exp, sig) {
  const expN = Number(exp);
  if (!assetId || !sig || !Number.isFinite(expN)) return false;
  if (expN < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac('sha256', secret()).update(`${assetId}.${expN}`).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(String(sig), 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function urlFirmada(origin, assetId, ttlSec = 600) {
  const { exp, sig } = firmarAsset(assetId, ttlSec);
  const base = String(origin || '').replace(/\/+$/, '');
  return `${base}/api/wiki/assets?id=${encodeURIComponent(assetId)}&exp=${exp}&sig=${sig}`;
}
