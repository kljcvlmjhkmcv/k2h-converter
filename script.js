
document.getElementById("loginSource").addEventListener("click", () => {
  window.open("https://k2h-converter.vercel.app/login?state=source", "spotifySourceAuth", "width=500,height=600");
});

document.getElementById("loginTarget").addEventListener("click", () => {
  window.open("https://k2h-converter.vercel.app/login?state=target", "spotifyTargetAuth", "width=500,height=600");
});

window.addEventListener("message", (event) => {
  const { state, access_token } = event.data;
  if (state === "source") {
    localStorage.setItem("sourceToken", access_token);
    document.getElementById("loginSource").textContent = "✅ Source Connected";
  } else if (state === "target") {
    localStorage.setItem("targetToken", access_token);
    document.getElementById("loginTarget").textContent = "✅ Target Connected";
  }

  if (localStorage.getItem("sourceToken") && localStorage.getItem("targetToken")) {
    document.getElementById("startTransfer").style.display = "inline-block";
  }
});

document.getElementById("startTransfer").addEventListener("click", () => {
  window.location.href = "transfer.html";
});
