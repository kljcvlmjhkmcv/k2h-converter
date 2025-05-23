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

  async function fetchAllItems(url, token, mapper) {
    let result = [];
    while (url) {
      const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) {
        const text = await res.text();
        log("Error: " + text.slice(0, 100));
        break;
      }
      const data = await res.json();
      const items = data.items || data.artists?.items || [];
      result.push(...(mapper ? items.map(mapper).filter(Boolean) : items));
      url = data.next || data.artists?.next;
    }
    return result;
  }

  async function uploadPlaylistImage(playlistId, imageUrl) {
    try {
      const imageBlob = await fetch(imageUrl).then(res => res.blob());
      const arrayBuffer = await imageBlob.arrayBuffer();
      const base64String = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/images`, {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + accessToken2,
          "Content-Type": "image/jpeg"
        },
        body: base64String
      });
    } catch (e) {
      log("Failed to upload image: " + e.message);
    }
  }

  async function getUserId(token) {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) {
      const text = await res.text();
      log("User ID error: " + text.slice(0, 100));
      return null;
    }
    const data = await res.json();
    return data.id;
  }

  function getChecked(id) {
    return document.getElementById(id)?.checked;
  }

  const userId1 = await getUserId(accessToken1);
  const userId2 = await getUserId(accessToken2);
  if (!userId1 || !userId2) return;

  async function transferPlaylists() {
    if (!getChecked("chkPlaylists")) return;
    status.textContent = "Transferring playlists...";
    const playlists = await fetchAllItems("https://api.spotify.com/v1/me/playlists?limit=50", accessToken1);
    const existing = await fetchAllItems("https://api.spotify.com/v1/me/playlists?limit=50", accessToken2);
    const existingNames = new Set(existing.map(p => p.name.toLowerCase()));
    bar.max = playlists.length;
    bar.value = 0;

    for (const pl of playlists) {
      if (existingNames.has(pl.name.toLowerCase())) {
        log("⏭️ Skipped duplicate playlist: " + pl.name);
        bar.value++;
        continue;
      }

      if (pl.owner.id === userId1) {
        const newPlRes = await fetch(`https://api.spotify.com/v1/users/${userId2}/playlists`, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accessToken2,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name: pl.name, public: pl.public })
        });
        const newPl = await newPlRes.json();

        const uris = await fetchAllItems(`https://api.spotify.com/v1/playlists/${pl.id}/tracks?limit=100`, accessToken1, i => i.track?.uri);
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
    const tracks = await fetchAllItems("https://api.spotify.com/v1/me/tracks?limit=50", accessToken1, i => i.track?.id);
    for (let i = 0; i < tracks.length; i += 50) {
      await fetch("https://api.spotify.com/v1/me/tracks", {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + accessToken2,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ids: tracks.slice(i, i + 50) })
      });
    }
  }

  await transferPlaylists();
  await transferLikedSongs();

  status.textContent = "✅ Done!";
})();
