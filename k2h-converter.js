// K2h Converter Main Logic
let sourceToken = null;
let targetToken = null;

// Spotify App credentials
const clientId = 'YOUR_SPOTIFY_CLIENT_ID';
const redirectUri = window.location.origin + '/';

function getLoginUrl(stateTag) {
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

    return 'https://accounts.spotify.com/authorize' +
        '?response_type=token' +
        '&client_id=' + encodeURIComponent(clientId) +
        '&scope=' + encodeURIComponent(scope) +
        '&redirect_uri=' + encodeURIComponent(redirectUri) +
        '&state=' + encodeURIComponent(stateTag);
}

function parseHashParams() {
    const hash = window.location.hash.substring(1);
    const params = {};
    hash.split('&').forEach(function (item) {
        const parts = item.split('=');
        params[parts[0]] = decodeURIComponent(parts[1]);
    });
    return params;
}

function startTransfer() {
    console.log("🚀 Starting full transfer from source → target");

    // TODO: implement actual Spotify API calls here:
    // - Fetch playlists from source
    // - Check ownership
    // - Create or follow on target
    // - Transfer liked songs, albums, podcasts
}

window.onload = function () {
    const params = parseHashParams();
    if (params.access_token && params.state === 'source') {
        sourceToken = params.access_token;
        sessionStorage.setItem('sourceToken', sourceToken);
        window.location.href = redirectUri + '#ready_for_target';
    } else if (params.access_token && params.state === 'target') {
        targetToken = params.access_token;
        sourceToken = sessionStorage.getItem('sourceToken');
        if (sourceToken) {
            startTransfer();
        } else {
            alert("Missing source token!");
        }
    }
};


// Continue logic inside startTransfer()

async function startTransfer() {
    console.log("🔄 Fetching playlists from source...");

    const playlists = await fetchPlaylists(sourceToken);
    console.log("🎧 Total playlists found:", playlists.length);

    for (const pl of playlists) {
        const isOwner = pl.owner && pl.owner.id && pl.owner.id === await getUserId(sourceToken);

        if (isOwner) {
            console.log("🟢 Creating playlist:", pl.name);
            const newPl = await createPlaylist(pl, targetToken);
            if (pl.images && pl.images.length > 0) {
                await uploadPlaylistImage(newPl.id, pl.images[0].url, targetToken);
            }
            await copyTracks(pl.id, newPl.id, sourceToken, targetToken);
        } else {
            console.log("🔵 Following playlist:", pl.name);
            await followPlaylist(pl.id, targetToken);
        }
    }

    console.log("✅ Playlists done.");
    await transferLikedSongs(sourceToken, targetToken);
    await transferSavedAlbums(sourceToken, targetToken);
    await transferSavedPodcasts(sourceToken, targetToken);

    console.log("🚀 All transfers completed.");
}

async function getUserId(token) {
    const res = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: "Bearer " + token },
    });
    const data = await res.json();
    return data.id;
}

async function fetchPlaylists(token) {
    let playlists = [], url = "https://api.spotify.com/v1/me/playlists?limit=50";
    while (url) {
        const res = await fetch(url, {
            headers: { Authorization: "Bearer " + token },
        });
        const data = await res.json();
        playlists.push(...data.items);
        url = data.next;
    }
    return playlists;
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
            description: pl.description,
            public: pl.public
        })
    });
    return await res.json();
}

async function copyTracks(sourcePlId, targetPlId, sourceToken, targetToken) {
    let url = `https://api.spotify.com/v1/playlists/${sourcePlId}/tracks`;
    while (url) {
        const res = await fetch(url, {
            headers: { Authorization: "Bearer " + sourceToken },
        });
        const data = await res.json();
        const uris = data.items.map(item => item.track && item.track.uri).filter(Boolean);
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

async function uploadPlaylistImage(playlistId, imageUrl, token) {
    const imgRes = await fetch(imageUrl);
    const imgBlob = await imgRes.blob();
    const base64 = await blobToBase64(imgBlob);
    await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/images`, {
        method: "PUT",
        headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "image/jpeg"
        },
        body: base64.replace(/^data:image\/jpeg;base64,/, "")
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

async function transferLikedSongs(sourceToken, targetToken) {
    let url = "https://api.spotify.com/v1/me/tracks?limit=50";
    while (url) {
        const res = await fetch(url, {
            headers: { Authorization: "Bearer " + sourceToken },
        });
        const data = await res.json();
        const ids = data.items.map(item => item.track.id).filter(Boolean);
        if (ids.length > 0) {
            await fetch("https://api.spotify.com/v1/me/tracks", {
                method: "PUT",
                headers: {
                    Authorization: "Bearer " + targetToken,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ ids })
            });
        }
        url = data.next;
    }
}

async function transferSavedAlbums(sourceToken, targetToken) {
    let url = "https://api.spotify.com/v1/me/albums?limit=50";
    while (url) {
        const res = await fetch(url, {
            headers: { Authorization: "Bearer " + sourceToken },
        });
        const data = await res.json();
        const ids = data.items.map(item => item.album.id).filter(Boolean);
        if (ids.length > 0) {
            await fetch("https://api.spotify.com/v1/me/albums", {
                method: "PUT",
                headers: {
                    Authorization: "Bearer " + targetToken,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ ids })
            });
        }
        url = data.next;
    }
}

async function transferSavedPodcasts(sourceToken, targetToken) {
    let url = "https://api.spotify.com/v1/me/shows?limit=50";
    while (url) {
        const res = await fetch(url, {
            headers: { Authorization: "Bearer " + sourceToken },
        });
        const data = await res.json();
        const ids = data.items.map(item => item.show.id).filter(Boolean);
        if (ids.length > 0) {
            await fetch("https://api.spotify.com/v1/me/shows", {
                method: "PUT",
                headers: {
                    Authorization: "Bearer " + targetToken,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ ids })
            });
        }
        url = data.next;
    }
}
