(async function transferAll() {
  const accessToken1 = localStorage.getItem("access_token_source");
  const accessToken2 = localStorage.getItem("access_token_target");

  const status = document.getElementById("transferStatus");
  const bar = document.getElementById("transferProgressBar");
  const percent = document.getElementById("transferPercentage");

  let errorLog = [];

  if (!accessToken1 || !accessToken2) {
    alert("Please connect both accounts first.");
    return;
  }

  function logError(msg) {
    errorLog.push(msg);
    const div = document.getElementById("errorLog");
    div.innerHTML += `<div>❌ ${msg}</div>`;
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

  status.textContent = "Fetching playlists...";
  let playlists = [];
  let url = "https://api.spotify.com/v1/me/playlists?limit=50";
  while (url) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: "Bearer " + accessToken1 }
      });
      const data = await res.json();
      playlists = playlists.concat(data.items);
      url = data.next;
    } catch (err) {
      logError("Failed to fetch playlists");
      break;
    }
  }

  bar.max = playlists.length;
  bar.value = 0;

  for (let i = 0; i < playlists.length; i++) {
    const pl = playlists[i];
    const isOwner = pl.owner?.id === userId1;

    try {
      status.textContent = isOwner ? `Transferring: ${pl.name}` : `Following: ${pl.name}`;
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
    } catch (e) {
      logError(`Failed to transfer playlist: ${pl.name}`);
    }

    bar.value = i + 1;
    percent.textContent = Math.round(((i + 1) / playlists.length) * 100) + "%";
    await new Promise(r => setTimeout(r, 300));
  }

  status.textContent = "✅ Transfer complete!";
})();
