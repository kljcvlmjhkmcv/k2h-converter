(async function transferAll() {
  const accessToken1 = localStorage.getItem("access_token_source");
  const accessToken2 = localStorage.getItem("access_token_target");

  const status = document.getElementById("transferStatus");
  const bar = document.getElementById("transferProgressBar");
  const percent = document.getElementById("transferPercentage");

  const errorLog = document.createElement("div");
  errorLog.id = "errorLog";
  errorLog.style = "max-height: 120px; overflow-y: auto; font-size: 0.8rem; color: #ff6b6b; margin-top: 16px;";
  document.querySelector(".card").appendChild(errorLog);

  function logError(msg) {
    errorLog.innerHTML += `<div>❌ ${msg}</div>`;
  }

  if (!accessToken1 || !accessToken2) {
    logError("Both accounts must be connected.");
    return;
  }

  async function getUserId(token) {
    const response = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await response.json();
    return data.id;
  }

  const userId1 = await getUserId(accessToken1);
  const userId2 = await getUserId(accessToken2);

  async function transferPlaylists() {
    try {
      status.textContent = "Fetching playlists...";
      let playlists = [];
      let url = "https://api.spotify.com/v1/me/playlists?limit=50";
      while (url) {
        const res = await fetch(url, { headers: { Authorization: "Bearer " + accessToken1 } });
        const data = await res.json();
        playlists = playlists.concat(data.items);
        url = data.next;
      }

      bar.max = playlists.length;
      bar.value = 0;

      for (let i = 0; i < playlists.length; i++) {
        const pl = playlists[i];
        const isOwner = pl.owner?.id === userId1;
        status.textContent = isOwner ? `Transferring: ${pl.name}` : `Following: ${pl.name}`;

        try {
          if (isOwner) {
            const newPlaylist = await fetch(`https://api.spotify.com/v1/users/${userId2}/playlists`, {
              method: "POST",
              headers: {
                Authorization: "Bearer " + accessToken2,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                name: pl.name,
                description: pl.description || "",
                public: pl.public
              })
            }).then(res => res.json());

            const trackUris = [];
            let trackUrl = `https://api.spotify.com/v1/playlists/${pl.id}/tracks?limit=100`;
            while (trackUrl) {
              const res = await fetch(trackUrl, {
                headers: { Authorization: "Bearer " + accessToken1 }
              });
              const data = await res.json();
              trackUris.push(...data.items.map(item => item.track?.uri).filter(Boolean));
              trackUrl = data.next;
            }

            for (let j = 0; j < trackUris.length; j += 100) {
              await fetch(`https://api.spotify.com/v1/playlists/${newPlaylist.id}/tracks`, {
                method: "POST",
                headers: {
                  Authorization: "Bearer " + accessToken2,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ uris: trackUris.slice(j, j + 100) })
              });
            }

          } else {
            await fetch(`https://api.spotify.com/v1/playlists/${pl.id}/followers`, {
              method: "PUT",
              headers: {
                Authorization: "Bearer " + accessToken2,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ public: false })
            });
          }
        } catch (err) {
          logError(`Failed to transfer: ${pl.name}`);
        }

        bar.value = i + 1;
        percent.textContent = Math.round(((i + 1) / playlists.length) * 100) + "%";
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) {
      logError("Playlist transfer failed.");
    }
  }

  async function transferLikedTracks() {
    try {
      status.textContent = "Transferring liked songs...";
      let tracks = [];
      let url = "https://api.spotify.com/v1/me/tracks?limit=50";
      while (url) {
        const res = await fetch(url, { headers: { Authorization: "Bearer " + accessToken1 } });
        const data = await res.json();
        if (data.items) tracks = tracks.concat(data.items);
        url = data.next;
      }
      for (let i = 0; i < tracks.length; i += 50) {
        const ids = tracks.slice(i, i + 50).map(t => t.track?.id).filter(Boolean);
        await fetch("https://api.spotify.com/v1/me/tracks", {
          method: "PUT",
          headers: {
            Authorization: "Bearer " + accessToken2,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ids })
        });
      }
    } catch (e) {
      logError("Failed to transfer liked songs.");
    }
  }

  async function transferAlbums() {
    try {
      status.textContent = "Transferring albums...";
      let albums = [];
      let url = "https://api.spotify.com/v1/me/albums?limit=50";
      while (url) {
        const res = await fetch(url, { headers: { Authorization: "Bearer " + accessToken1 } });
        const data = await res.json();
        if (data.items) albums = albums.concat(data.items);
        url = data.next;
      }
      for (let i = 0; i < albums.length; i += 50) {
        const ids = albums.slice(i, i + 50).map(a => a.album?.id).filter(Boolean);
        await fetch("https://api.spotify.com/v1/me/albums", {
          method: "PUT",
          headers: {
            Authorization: "Bearer " + accessToken2,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ids })
        });
      }
    } catch (e) {
      logError("Failed to transfer albums.");
    }
  }

  async function transferArtists() {
    try {
      status.textContent = "Transferring followed artists...";
      let artists = []; document.getElementById('artistCount').textContent = '...';
      let url = "https://api.spotify.com/v1/me/following?type=artist&limit=50";
      while (url) {
        const res = await fetch(url, { headers: { Authorization: "Bearer " + accessToken1 } });
        const data = await res.json();
        if (data.artists?.items) artists = artists.concat(data.artists.items); document.getElementById('artistCount').textContent = artists.length;
        url = data.artists.next;
      }
      for (let i = 0; i < artists.length; i += 50) {
        const ids = artists.slice(i, i + 50).map(a => a.id);
        await fetch("https://api.spotify.com/v1/me/following?type=artist", {
          method: "PUT",
          headers: {
            Authorization: "Bearer " + accessToken2,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ids })
        });
      }
    } catch (e) {
      logError("Failed to transfer followed artists.");
    }
  }

  async function transferPodcasts() {
    try {
      status.textContent = "Transferring saved shows...";
      let shows = [];
      let url = "https://api.spotify.com/v1/me/shows?limit=50";
      while (url) {
        const res = await fetch(url, { headers: { Authorization: "Bearer " + accessToken1 } });
        const data = await res.json();
        if (data.items) shows = shows.concat(data.items);
        url = data.next;
      }
      for (let i = 0; i < shows.length; i += 50) {
        const ids = shows.slice(i, i + 50).map(s => s.show?.id).filter(Boolean);
        await fetch("https://api.spotify.com/v1/me/shows", {
          method: "PUT",
          headers: {
            Authorization: "Bearer " + accessToken2,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ids })
        });
      }
    } catch (e) {
      logError("Failed to transfer saved shows.");
    }
  }

  if (document.getElementById('optPlaylists').checked) await transferPlaylists();
  if (document.getElementById('optLiked').checked) await transferLikedTracks();
  if (document.getElementById('optAlbums').checked) await transferAlbums();
  
if (document.getElementById('optArtists').checked) await transferArtists();

  if (document.getElementById('optPodcasts').checked) await transferPodcasts();

  status.textContent = "✅ All transfers complete!";
})();
