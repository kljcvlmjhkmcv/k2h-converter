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

  async function fetchAll(url, token, container, mapper) {
    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (data.items) container.push(...(mapper ? data.items.map(mapper) : data.items));
      url = data.next || data?.artists?.next;
    }
  }

  async function transferLikedSongs() {
    try {
      status.textContent = "Transferring liked songs...";
      let trackIds = [];
      await fetchAll("https://api.spotify.com/v1/me/tracks?limit=50", accessToken1, trackIds, i => i.track?.id);
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
      }
    } catch {
      log("Failed to transfer liked songs.");
    }
  }

  async function transferAlbums() {
    try {
      status.textContent = "Transferring albums...";
      let albumIds = [];
      await fetchAll("https://api.spotify.com/v1/me/albums?limit=50", accessToken1, albumIds, i => i.album?.id);
      for (let i = 0; i < albumIds.length; i += 50) {
        const chunk = albumIds.slice(i, i + 50);
        await fetch("https://api.spotify.com/v1/me/albums", {
          method: "PUT",
          headers: {
            Authorization: "Bearer " + accessToken2,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ids: chunk })
        });
      }
    } catch {
      log("Failed to transfer albums.");
    }
  }

  async function transferArtists() {
    try {
      status.textContent = "Transferring followed artists...";
      let artistIds = [];
      await fetchAll("https://api.spotify.com/v1/me/following?type=artist&limit=50", accessToken1, artistIds, i => i.id);
      document.getElementById("artistCount").textContent = artistIds.length;
      for (let i = 0; i < artistIds.length; i += 50) {
        const chunk = artistIds.slice(i, i + 50);
        await fetch("https://api.spotify.com/v1/me/following?type=artist", {
          method: "PUT",
          headers: {
            Authorization: "Bearer " + accessToken2,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ids: chunk })
        });
      }
    } catch {
      log("Failed to transfer followed artists.");
    }
  }

  await transferLikedSongs();
  await transferAlbums();
  await transferArtists();

  status.textContent = "✅ All transfers complete!";
})();
