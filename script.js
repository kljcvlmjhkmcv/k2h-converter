
const clientId = 'f3fd2e13bd8046e4b801f01e43b4500b';
const redirectUri = 'https://www.spotmyplaylist.site/callback';

let sourceToken = null;
let targetToken = null;

document.getElementById("loginSource").addEventListener("click", async () => {
  const { verifier, challenge } = await generatePKCECodes();
  localStorage.setItem("verifier_source", verifier);
  openAuthPopup("source", challenge);
});

document.getElementById("loginTarget").addEventListener("click", async () => {
  const { verifier, challenge } = await generatePKCECodes();
  localStorage.setItem("verifier_target", verifier);
  openAuthPopup("target", challenge);
});

function openAuthPopup(state, challenge) {
  const scope = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-library-read',
    'user-library-modify',
    'user-read-email',
    'user-read-private',
    'user-follow-read',
    'user-follow-modify'
  ].join(' ');

  const url =
    'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope,
      state: state,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });

  window.open(url, 'spotifyAuth', 'width=500,height=600');
}

window.addEventListener("message", async (event) => {
  const { state, code } = event.data;
  const verifier = localStorage.getItem("verifier_" + state);

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json();
  const token = data.access_token;

  const profileRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: "Bearer " + token }
  });
  const profile = await profileRes.json();
  const name = profile.display_name || profile.id;

  if (state === "source") {
    sourceToken = token;
    localStorage.setItem("sourceToken", token);
    document.getElementById("loginSource").textContent = "✅ Source Connected";
    document.getElementById("sourceUser").textContent = "👤 " + name;
  } else if (state === "target") {
    targetToken = token;
    localStorage.setItem("targetToken", token);
    document.getElementById("loginTarget").textContent = "✅ Target Connected";
    document.getElementById("targetUser").textContent = "👤 " + name;
  }

  if (sourceToken && targetToken) {
    document.getElementById("startTransfer").style.display = "inline-block";
  }
});

function generateRandomString(length) {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + dec.toString(16)).slice(-2)).join('');
}

async function generatePKCECodes() {
  const verifier = generateRandomString(64);
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { verifier, challenge };
}
