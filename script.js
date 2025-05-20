
document.addEventListener("DOMContentLoaded", function () {
  const config = {
    client_id: "f3fd2e13bd8046e4b801f01e43b4500b",
    redirect_uri: "https://www.spotmyplaylist.site/login.html",
    uri: "https://www.spotmyplaylist.site",
    scope: [
      "playlist-read-private",
      "playlist-modify-private",
      "playlist-modify-public",
      "user-library-read",
      "user-library-modify",
      "user-follow-read",
      "user-follow-modify"
    ].join(" ")
  };

  let token = null;

  window.loginWithSpotify = function () {
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
});
