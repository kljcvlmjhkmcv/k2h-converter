
var token = null;

function loginWithSpotify() {
  var conf = config;
  var authUrl = "https://accounts.spotify.com/authorize?" +
    "client_id=" + conf.client_id +
    "&redirect_uri=" + encodeURIComponent(conf.redirect_uri) +
    "&scope=" + encodeURIComponent("playlist-read-private playlist-modify-public playlist-modify-private user-library-read user-library-modify user-follow-read user-follow-modify") +
    "&response_type=token" +
    "&show_dialog=true";

  window.open(authUrl, "spotifyAuth", "width=500,height=600");
}

window.addEventListener("message", function (event) {
  if (typeof event.data === "string" && event.data.length > 20) {
    token = event.data;
    localStorage.setItem("access_token", token);
    document.getElementById("loginStatus").textContent = "✅ Connected";
    document.getElementById("startTransfer").style.display = "inline-block";
  }
});
