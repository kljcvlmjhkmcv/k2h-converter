
let sourceToken = null;
let targetToken = null;
let logger = console.log;

// Inject tokens from external context
export function injectTokens(src, tgt, logFn) {
    sourceToken = src;
    targetToken = tgt;
    if (typeof logFn === "function") logger = logFn;
}

export async function startTransfer() {
    logger("🔄 Fetching playlists from source...");
    const playlists = await fetchPlaylists(sourceToken);
    logger("🎧 Total playlists found: " + playlists.length);
    const userId = await getUserId(sourceToken);

    for (const pl of playlists) {
        const isOwner = pl.owner && pl.owner.id === userId;
        if (isOwner) {
            logger("🟢 Creating playlist: " + pl.name);
            const newPl = await createPlaylist(pl, targetToken);
            if (pl.images && pl.images.length > 0) {
                await uploadPlaylistImage(newPl.id, pl.images[0].url, targetToken);
            }
            await copyTracks(pl.id, newPl.id, sourceToken, targetToken);
        } else {
            logger("🔵 Following playlist: " + pl.name);
            await followPlaylist(pl.id, targetToken);
        }
    }

    logger("✅ Playlists done.");
    await transferLikedSongs(sourceToken, targetToken);
    await transferSavedAlbums(sourceToken, targetToken);
    await transferSavedPodcasts(sourceToken, targetToken);
    logger("🚀 All transfers completed.");
}

// Helper functions

async function fetchPlaylists(token) {
    let all = [], url = "https://api.spotify.com/v1/me/playlists?limit=50";
    while (url) {
        const res = await fetch(url, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        all.push(...data.items);
        url = data.next;
    }
    return all;
}

async function getUserId(token) {
    const res = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    return data.id;
}

async function createPlaylist(pl, token) {
    const userId = await getUserId(token);
    const res = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
        method: "POST",
        headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: pl.name,
            description: pl.description || "",
            public: pl.public
        })
    });
    return await res.json();
}

async function uploadPlaylistImage(playlistId, imageUrl, token) {
    const imgBlob = await fetch(imageUrl).then(r => r.blob());
    const imgBase64 = await blobToBase64(imgBlob);
    await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/images`, {
        method: "PUT",
        headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "image/jpeg"
        },
        body: imgBase64.replace(/^data:image\/jpeg;base64,/, "")
    });
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function copyTracks(sourcePlId, targetPlId, sourceToken, targetToken) {
    let url = `https://api.spotify.com/v1/playlists/${sourcePlId}/tracks`;
    while (url) {
        const res = await fetch(url, {
            headers: { Authorization: "Bearer " + sourceToken }
        });
        const data = await res.json();
        const uris = data.items.map(i => i.track && i.track.uri).filter(Boolean);
        if (uris.length > 0) {
            await fetch(`https://api.spotify.com/v1/playlists/${targetPlId}/tracks`, {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + targetToken,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ uris })
            });
        }
        url = data.next;
    }
}

async function transferLikedSongs(source, target) {
    logger("💚 Transferring liked songs...");
    let url = "https://api.spotify.com/v1/me/tracks?limit=50";
    while (url) {
        const res = await fetch(url, { headers: { Authorization: "Bearer " + source } });
        const data = await res.json();
        const uris = data.items.map(item => item.track && item.track.uri).filter(Boolean);
        if (uris.length > 0) {
            await fetch("https://api.spotify.com/v1/me/tracks", {
                method: "PUT",
                headers: {
                    Authorization: "Bearer " + target,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ ids: uris.map(uri => uri.split(":").pop()) })
            });
        }
        url = data.next;
    }
}

async function transferSavedAlbums(source, target) {
    logger("📀 Transferring saved albums...");
    let url = "https://api.spotify.com/v1/me/albums?limit=50";
    while (url) {
        const res = await fetch(url, { headers: { Authorization: "Bearer " + source } });
        const data = await res.json();
        const ids = data.items.map(item => item.album && item.album.id).filter(Boolean);
        if (ids.length > 0) {
            await fetch("https://api.spotify.com/v1/me/albums", {
                method: "PUT",
                headers: {
                    Authorization: "Bearer " + target,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ ids })
            });
        }
        url = data.next;
    }
}

async function transferSavedPodcasts(source, target) {
    logger("🎙️ Transferring followed podcasts...");
    let url = "https://api.spotify.com/v1/me/shows?limit=50";
    while (url) {
        const res = await fetch(url, { headers: { Authorization: "Bearer " + source } });
        const data = await res.json();
        const ids = data.items.map(item => item.show && item.show.id).filter(Boolean);
        if (ids.length > 0) {
            await fetch("https://api.spotify.com/v1/me/shows", {
                method: "PUT",
                headers: {
                    Authorization: "Bearer " + target,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ ids })
            });
        }
        url = data.next;
    }
}
