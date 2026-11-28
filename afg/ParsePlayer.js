let username = "";
let level = 1;

const savedPlayer = localStorage.getItem("savedPlayer");

if (savedPlayer) {
  try {
    const playerData = JSON.parse(savedPlayer);
    username = typeof playerData.username === "string" ? playerData.username : "";
    level = Number.isInteger(playerData.level) && playerData.level > 0
      ? playerData.level
      : 1;
  } catch (error) {
    console.error("Could not read saved player data:", error);
  }
}

export { username, level };
