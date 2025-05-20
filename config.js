
let token = null;

function loginWithSpotify() {
  const url = "https://accounts.spotify.com/authorize?" +
    "client_id=" + config.client_id +
    "&redirect_uri=" + encodeURIComponent(config.redirect_uri) +
    "&response_type=token" +
    "&scope=" + encodeURIComponent(config.scope) +
    "&show_dialog=true";
  window.open(url, "spotifyLogin", "width=500,height=600");
}

window.addEventListener("message", (event) => {
  if (typeof event.data === "string" && event.data.startsWith("BQ")) {
    token = event.data;
    localStorage.setItem("access_token", token);
    document.getElementById("loginStatus").innerText = "✅ Connected";
    document.getElementById("start").style.display = "inline-block";
  }
});
