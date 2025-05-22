(async function transferAll() {
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

  if (!accessToken1 || !accessToken2) {
    log("Missing tokens.");
    return;
  }

  async function getUserId(token) {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    return data.id;
  }

  const userId1 = await getUserId(accessToken1);
  const userId2 = await getUserId(accessToken2);

  async function fetchAllItems(url, token, mapper) {
    let result = [];
    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      const items = data.items || data.artists?.items || [];
      result.push(...(mapper ? items.map(mapper) : items));
      url = data.next || data.artists?.next;
    }
    return result.filter(Boolean);
  }

  async function transferLikedSongs() {
    status.textContent = "Transferring liked songs...";
    const trackIds = await fetchAllItems("https://api.spotify.com/v1/me/tracks?limit=50", accessToken1, t => t.track?.id);
    bar.max = trackIds.length;
    bar.value = 0;

    for (let i = 0; i < trackIds.length; i += 50) {
      const chunk = trackIds.slice(i, i + 50);
      await fetch("https://api.spotify.com/v1/me/tracks", {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + accessToken2,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ids: chunk })
      });
      bar.value += chunk.length;
      percent.textContent = Math.round((bar.value / bar.max) * 100) + "%";
    }
  }

  async function transferAlbums() {
    status.textContent = "Transferring albums...";
    const albumIds = await fetchAllItems("https://api.spotify.com/v1/me/albums?limit=50", accessToken1, a => a.album?.id);
    for (let i = 0; i < albumIds.length; i += 50) {
      await fetch("https://api.spotify.com/v1/me/albums", {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + accessToken2,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ids: albumIds.slice(i, i + 50) })
      });
    }
  }

  async function transferArtists() {
    status.textContent = "Transferring artists...";
    const artistIds = await fetchAllItems("https://api.spotify.com/v1/me/following?type=artist&limit=50", accessToken1, a => a.id);
    // removed artistCount update
    for (let i = 0; i < artistIds.length; i += 50) {
      await fetch("https://api.spotify.com/v1/me/following?type=artist", {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + accessToken2,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ids: artistIds.slice(i, i + 50) })
      });
    }
  }

  async function transferPlaylists() {
    status.textContent = "Transferring playlists...";
    const playlists = await fetchAllItems("https://api.spotify.com/v1/me/playlists?limit=50", accessToken1);
    bar.max = playlists.length;
    bar.value = 0;

    for (const pl of playlists) {
      try {
        if (pl.owner?.id === userId1) {
          const newPl = await fetch(`https://api.spotify.com/v1/users/${userId2}/playlists`, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + accessToken2,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ name: pl.name, public: pl.public })
          }).then(r => r.json());

          const trackUris = await fetchAllItems(`https://api.spotify.com/v1/playlists/${pl.id}/tracks?limit=100`, accessToken1, i => i.track?.uri);
          for (let i = 0; i < trackUris.length; i += 100) {
            await fetch(`https://api.spotify.com/v1/playlists/${newPl.id}/tracks`, {
              method: "POST",
              headers: {
                Authorization: "Bearer " + accessToken2,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ uris: trackUris.slice(i, i + 100) })
            });
          }
        } else {
          await fetch(`https://api.spotify.com/v1/playlists/${pl.id}/followers`, {
            method: "PUT",
            headers: { Authorization: "Bearer " + accessToken2 }
          });
        }
      } catch (e) {
        log(`Failed playlist: ${pl.name}`);
      }

      bar.value += 1;
      percent.textContent = Math.round((bar.value / bar.max) * 100) + "%";
    }
  }

  await transferPlaylists();
  await transferLikedSongs();
  await transferAlbums();
  await transferArtists();

  status.textContent = "✅ All transfers complete!";
})();
