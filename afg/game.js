let username = "";
let level = 1;

const savedPlayer = localStorage.getItem("savedPlayer");

if (savedPlayer) {
  try {
    const playerData = JSON.parse(savedPlayer);
    username = playerData.username || "";
    level = Number.isInteger(playerData.level) ? playerData.level : 1;
    console.log(`${username} level ${level}`);
  } catch (error) {
    console.error("Could not read saved player data:", error);
  }
}

