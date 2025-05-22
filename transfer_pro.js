(async function () {
  const accessToken1 = localStorage.getItem("access_token_source");
  const accessToken2 = localStorage.getItem("access_token_target");

  const status = document.getElementById("transferStatus");
  const bar = document.getElementById("transferProgressBar");
  const percent = document.getElementById("transferPercentage");

  const log = (msg) => {
    const errorLog = document.getElementById("errorLog") || (() => {
      const el = document.createElement("div");
      el.id = "errorLog";
      el.style = "color: #ff6b6b; font-size: 0.8rem; margin-top: 16px; max-height: 120px; overflow-y: auto;";
      document.querySelector(".card").appendChild(el);
      return el;
    })();
    errorLog.innerHTML += `<div>❌ ${msg}</div>`;
  };

  async function safeFetchJson(url, token) {
    const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) {
      const text = await res.text();
      log("Spotify API error: " + text.slice(0, 100));
      throw new Error("API error");
    }
    return res.json();
  }

  async function fetchAllItems(url, token, mapper) {
    let result = [];
    while (url) {
      const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) {
        const text = await res.text();
        log("Error while fetching: " + text.slice(0, 100));
        break;
      }
      const data = await res.json();
      const items = data.items || data.artists?.items || [];
      result.push(...(mapper ? items.map(mapper) : items));
      url = data.next || data.artists?.next;
    }
    return result.filter(Boolean);
  }

  async function getUserId(token) {
    try {
      const data = await safeFetchJson("https://api.spotify.com/v1/me", token);
      return data.id;
    } catch {
      log("Failed to get user ID.");
      return null;
    }
  }

  if (!accessToken1 || !accessToken2) {
    log("Missing tokens. Please login both accounts.");
    return;
  }

  const userId1 = await getUserId(accessToken1);
  const userId2 = await getUserId(accessToken2);
  if (!userId1 || !userId2) return;

  function getChecked(id) {
    return document.getElementById(id)?.checked;
  }

  async function transferLikedSongs() {
    if (!getChecked("chkLiked")) return;
    status.textContent = "Transferring liked songs...";
    const ids = await fetchAllItems("https://api.spotify.com/v1/me/tracks?limit=50", accessToken1, i => i.track?.id);
    for (let i = 0; i < ids.length; i += 50) {
      await fetch("https://api.spotify.com/v1/me/tracks", {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + accessToken2,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ids: ids.slice(i, i + 50) })
      });
    }
  }

  async function transferAlbums() {
    if (!getChecked("chkAlbums")) return;
    status.textContent = "Transferring albums...";
    const ids = await fetchAllItems("https://api.spotify.com/v1/me/albums?limit=50", accessToken1, i => i.album?.id);
    for (let i = 0; i < ids.length; i += 50) {
      await fetch("https://api.spotify.com/v1/me/albums", {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + accessToken2,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ids: ids.slice(i, i + 50) })
      });
    }
  }

  async function transferArtists() {
    if (!getChecked("chkArtists")) return;
    status.textContent = "Transferring followed artists...";
    const ids = await fetchAllItems("https://api.spotify.com/v1/me/following?type=artist&limit=50", accessToken1, i => i.id);
    for (let i = 0; i < ids.length; i += 50) {
      await fetch("https://api.spotify.com/v1/me/following?type=artist", {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + accessToken2,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ids: ids.slice(i, i + 50) })
      });
    }
  }

  async function transferShows() {
    if (!getChecked("chkShows")) return;
    status.textContent = "Transferring followed podcasts...";
    const ids = await fetchAllItems("https://api.spotify.com/v1/me/shows?limit=50", accessToken1, i => i.show?.id);
    for (let i = 0; i < ids.length; i += 50) {
      await fetch("https://api.spotify.com/v1/me/shows", {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + accessToken2,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ids: ids.slice(i, i + 50) })
      });
    }
  }

  status.textContent = "🚀 Starting transfer...";
  await transferLikedSongs();
  await transferAlbums();
  await transferArtists();
  await transferShows();
  status.textContent = "✅ Done!";
})();
