const NEXT_PAGE = "/afg/game.html";

const input = document.getElementById("username");
const button = document.querySelector(".btn");

function openFile(page) {
  window.location.replace(page);
}

function submitName() {
  const username = input.value.trim();
  if (!username) {
    input.focus();
    return;
  }
  const playerData = { username, level: 1 };
  localStorage.setItem("savedPlayer", JSON.stringify(playerData));
  openFile(NEXT_PAGE);
}

button.addEventListener("click", submitName);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitName();
});

input.focus();

