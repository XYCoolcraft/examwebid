'use strict';
/**
 * Login Google standar (Authorization Code flow), OPSIONAL.
 * - Redirect URI selalu diarahkan balik ke domain sendiri (PUBLIC_BASE_URL + /auth/google/callback).
 * - Tidak pernah redirect ke luar domain aplikasi setelah login selesai.
 * - Token yang didapat dari Google hanya dipakai sesaat untuk ambil profil, tidak disimpan permanen,
 *   dan TIDAK dikirim/diupload ke pihak ketiga mana pun (termasuk GitHub).
 */

function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const base = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const redirectUri = `${base}/auth/google/callback`;
  return { clientId, clientSecret, redirectUri, enabled: !!(clientId && clientSecret) };
}

function buildAuthUrl(state) {
  const { clientId, redirectUri } = getConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForProfile(code) {
  const { clientId, clientSecret, redirectUri } = getConfig();
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    throw new Error('Gagal menukar code Google: ' + JSON.stringify(tokenJson));
  }
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const profile = await profileRes.json();
  return { email: profile.email, name: profile.name, picture: profile.picture };
}

module.exports = { getConfig, buildAuthUrl, exchangeCodeForProfile };
