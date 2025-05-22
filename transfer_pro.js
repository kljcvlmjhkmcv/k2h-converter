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

  if (!accessToken1 || !accessToken2) return log("Both tokens required.");

  async function getUserId(token) {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    return data.id;
  }

  const userId1 = await getUserId(accessToken1);
  const userId2 = await getUserId(accessToken2);

  function getChecked(id) {
    return document.getElementById(id)?.checked;
  }

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

  async function uploadPlaylistImage(playlistId, imageUrl) {
    try {
      const img = await fetch(imageUrl).then(r => r.blob());
      const buffer = await img.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/images`, {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + accessToken2,
          "Content-Type": "image/jpeg"
        },
        body: Uint8Array.from(atob(base64), c => c.charCodeAt(0))
      });
    } catch (e) {
      log("Failed to upload image");
    }
  }

  async function transferPlaylists() {
    if (!getChecked("chkPlaylists")) return;
    status.textContent = "Transferring playlists...";
    const playlists = await fetchAllItems("https://api.spotify.com/v1/me/playlists?limit=50", accessToken1);
    bar.max = playlists.length;
    bar.value = 0;

    const destPlaylists = await fetchAllItems("https://api.spotify.com/v1/me/playlists?limit=50", accessToken2);
    const destNames = new Set(destPlaylists.map(pl => pl.name));

    for (const pl of playlists) {
      let name = pl.name;
      let index = 1;
      while (destNames.has(name)) name = `${pl.name} (${index++})`;

      if (pl.owner?.id === userId1) {
        const newPl = await fetch(`https://api.spotify.com/v1/users/${userId2}/playlists`, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accessToken2,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name, public: pl.public })
        }).then(r => r.json());

        const uris = await fetchAllItems(`https://api.spotify.com/v1/playlists/${pl.id}/tracks?limit=100`, accessToken1, t => t.track?.uri);
        for (let i = 0; i < uris.length; i += 100) {
          await fetch(`https://api.spotify.com/v1/playlists/${newPl.id}/tracks`, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + accessToken2,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ uris: uris.slice(i, i + 100) })
          });
        }

        if (pl.images?.[0]?.url) {
          await uploadPlaylistImage(newPl.id, pl.images[0].url);
        }
      } else {
        await fetch(`https://api.spotify.com/v1/playlists/${pl.id}/followers`, {
          method: "PUT",
          headers: { Authorization: "Bearer " + accessToken2 }
        });
      }

      bar.value++;
      percent.textContent = Math.round((bar.value / bar.max) * 100) + "%";
    }
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

  await transferPlaylists();
  await transferLikedSongs();
  await transferAlbums();
  await transferArtists();
  await transferShows();

  status.textContent = "✅ Selected items transferred!";
})();
