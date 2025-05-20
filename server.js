
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = 'f3fd2e13bd8046e4b801f01e43b4500b';
const CLIENT_SECRET = '996c6b33b83a4e928639fbd26bff773b';
const REDIRECT_URI = 'https://www.spotmyplaylist.site/callback';

app.use(cors());
app.use(express.json());

app.get('/login', (req, res) => {
  const state = req.query.state || '';
  const scope = [
    'playlist-read-private',
    'playlist-modify-private',
    'playlist-modify-public',
    'user-library-read',
    'user-library-modify',
    'user-follow-read',
    'user-follow-modify'
  ].join(' ');

  const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: scope,
    redirect_uri: REDIRECT_URI,
    state: state
  });

  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const access_token = response.data.access_token;
    const refresh_token = response.data.refresh_token;

    // Redirect with access_token in hash to callback.html
    const redirectUrl = `${REDIRECT_URI}#access_token=${access_token}&refresh_token=${refresh_token}&state=${state}`;
    res.redirect(redirectUrl);

  } catch (err) {
    console.error('Token exchange failed:', err.response?.data || err.message);
    res.status(500).send('Failed to authenticate with Spotify.');
  }
});

app.listen(PORT, () => {
  console.log(`OAuth Proxy running on port ${PORT}`);
});
