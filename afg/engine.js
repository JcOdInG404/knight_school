import { username as savedUsername, level as savedLevel } from "./ParsePlayer.js";

const username = savedUsername;
const level = savedLevel;

console.log(`${username} level ${level}`);

let isStart = sessionStorage.getItem('tutorial') === 'true';
sessionStorage.removeItem('tutorial');
console.log('isStart:', isStart);

const CELL_SIZE = 40;
const PLAYER_HEIGHT_CELLS = 2;
let skipTutorial = false;

let admin;
let hp = 100;
let money = 50;
let gameFlags = {};
let deaths = parseInt(localStorage.getItem('deaths') || '0');
let fit = "Casual";
let ownedFits = ["Casual"];
let bankMoney = parseInt(localStorage.getItem('bankMoney') || '0');
let lastBankInterestTime = 0;
let isDead = false;

let playerElement = null;
let cursorImage = null;
let gridContainer = null;
let mouseRow = null;
let mouseCol = null;
let showCoords = false;
let darkMode = false;

const player = {
    x: 9,
    y: 9,
    speed: CELL_SIZE,
    walkFrame: 1,
    isMoving: false,
    moveCooldown: 130,
    lastMoveTime: 0,
    damageCooldown: 130,
    lastDamageTime: -1000
};

let rows = 19;
let cols = 19;
let grid = [];
let door2s = [];
const keysPressed = {};
let currentLevel = null;


let animations = [];
let animationIntervalId = null;
let messageTimeoutId = null;
let messageBlocking = false;
let blockShoot = false;
let bgm = null;

// -----------------------------
// WEAPON
// -----------------------------
class Weapon {
    constructor(name, damage) {
        this.name = name;
        this.damage = damage;
    }
}

const blank = new Weapon("nothing", 0);
const Sword = new Weapon("Sword", 15);

let equipped = Sword.name;
let item1 = Sword.name;
let item2 = blank.name;
let item3 = blank.name;
let item4 = blank.name;
let item5 = blank.name;
let equippedSlot = 0;

// =============================
// DOM CONTENT LOADED
// =============================
document.addEventListener("DOMContentLoaded", () => {
    updateUI();
    renderHotbar();
    createMessageBox();
    createCoordsDisplay();

    gridContainer = document.querySelector(".grid");
    if (!gridContainer) return;
    gridContainer.style.position = "relative";
    gridContainer.style.userSelect = "none";

    loadLevel('main');

    addAnimation("/afg/assets/blocks/water.png", "/afg/assets/blocks/water_2.png");
    startAnimationHub();

    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('keyup', handleKeyRelease);

    requestAnimationFrame(gameLoop);
});



function getPlayerAssetFolder() {
    return fit === "Your very own cloak!!!" ? "cloak_man_fit" : fit.replace(/ /g, '_');
}

function inventoryItems() {
    return [item1, item2, item3, item4, item5];
}

function selectHotbarSlot(index) {
    const items = inventoryItems();
    if (index < 0 || index >= items.length) return;
    equippedSlot = index;
    equipped = items[index];
    renderHotbar();
    showMessage(equipped === blank.name ? "Empty slot" : `Equipped ${equipped}`);
}

function renderHotbar() {
    const hotbar = document.getElementById('hotbar');
    if (!hotbar) return;
    hotbar.replaceChildren();

    inventoryItems().forEach((item, index) => {
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'hotbar-slot';
        slot.classList.toggle('equipped', index === equippedSlot);
        slot.setAttribute('aria-label', `Slot ${index + 1}: ${item === blank.name ? 'Empty' : item}`);
        slot.setAttribute('aria-pressed', String(index === equippedSlot));

        const number = document.createElement('span');
        number.className = 'hotbar-number';
        number.textContent = String(index + 1);
        const label = document.createElement('span');
        label.className = 'hotbar-item';
        label.textContent = item === blank.name ? 'Empty' : item;

        const iconPath = item === Sword.name
            ? '/afg/assets/sloticons/swordicon.png'
            : null;
        if (iconPath) {
            const icon = document.createElement('img');
            icon.className = 'hotbar-icon';
            icon.src = iconPath;
            icon.alt = '';
            icon.setAttribute('aria-hidden', 'true');
            slot.append(number, icon, label);
        } else {
            slot.append(number, label);
        }
        slot.addEventListener('click', () => selectHotbarSlot(index));
        hotbar.appendChild(slot);
    });
}

function setPlayerAnimation(walking) {
    if (!playerElement) return;
    const folder = getPlayerAssetFolder();
    if (walking) {
        player.walkFrame = player.walkFrame === 1 ? 2 : 1;
        playerElement.src = `/afg/assets/player/${folder}/walk_${player.walkFrame}.png`;
        player.isMoving = true;
    } else {
        playerElement.src = `/afg/assets/player/${folder}/idle.png`;
        player.isMoving = false;
    }
}

function createPlayer(container) {
    playerElement = document.createElement('img');
    const folder = getPlayerAssetFolder();
    playerElement.src = `/afg/assets/player/${folder}/idle.png`;
    playerElement.style.display = 'block';
    playerElement.style.position = 'absolute';
    playerElement.style.left = `${player.x * CELL_SIZE}px`;
    playerElement.style.top = `${(player.y - PLAYER_HEIGHT_CELLS + 1) * CELL_SIZE}px`;
    if (fit === "Casual" || fit === "Your very own cloak!!!") {
        playerElement.style.width = `${CELL_SIZE}px`;
        playerElement.style.marginLeft = '0px';
    } else {
        playerElement.style.width = `${CELL_SIZE * 0.8}px`;
        playerElement.style.marginLeft = `${CELL_SIZE * 0.1}px`;
    }
    playerElement.style.height = `${PLAYER_HEIGHT_CELLS * CELL_SIZE}px`;
    playerElement.style.zIndex = '10';
    playerElement.style.transition = 'left 0.1s linear, top 0.1s linear';
    container.appendChild(playerElement);
}

// =============================
// INPUT
// =============================
function handleKeyPress(event) {
    keysPressed[event.key] = true;

    if (/^[1-5]$/.test(event.key)) {
        selectHotbarSlot(Number(event.key) - 1);
    }
}

function handleKeyRelease(event) {
    delete keysPressed[event.key];
    const stillMoving = ['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']
        .some(k => keysPressed[k]);
    if (!stillMoving && playerElement) {
        player.isMoving = false;
        setPlayerAnimation(false);
    }
}


// =============================
// UPDATE / MOVEMENT
// =============================
function playerFootprint(x, footY) {
    return [
        { x, y: footY },
        { x, y: footY - 1 }
    ];
}

function playerOccupiesCell(row, col) {
    return col === player.x && (row === player.y || row === player.y - 1);
}

function update(currentTime) {
    let newX = player.x;
    let newY = player.y;
    let isHorizontalMove = false;

    if (keysPressed['w'] || keysPressed['ArrowUp']) {
        newY--;
    } else if (keysPressed['s'] || keysPressed['ArrowDown']) {
        newY++;
    } else if (keysPressed['a'] || keysPressed['ArrowLeft']) {
        newX--;
        isHorizontalMove = true;
        if (playerElement) playerElement.style.transform = 'scaleX(-1)';
    } else if (keysPressed['d'] || keysPressed['ArrowRight']) {
        newX++;
        isHorizontalMove = true;
        if (playerElement) playerElement.style.transform = 'scaleX(1)';
    } else if (keysPressed['z']) {
        showMessage(item1 + " was equipped!");
        return;
    } else {
        return;
    }

    // The player's y coordinate is the feet row; the body also occupies the row above.
    const footprint = playerFootprint(newX, newY);
    const exitDoor = [...door2s].reverse().find(door =>
        footprint.some(cell => cell.y === door.row && cell.x === door.col)
    );
    if (exitDoor) {
        setPlayerAnimation(false);
        loadLevel(exitDoor.targetLevel);
        return;
    }

    const leavesGrid = footprint.some(cell =>
        cell.x < 0 || cell.x >= cols || cell.y < 0 || cell.y >= rows
    );
    if (leavesGrid) {
        setPlayerAnimation(false);
        return;
    }

    const footprintCells = footprint.map(({ x, y }) => grid[y * cols + x]);
    if (footprintCells.some(cell => !cell)) {
        setPlayerAnimation(false);
        return;
    }

    const arenaEntrance = footprintCells.find(cell => cell.isArenaEntrance);
    if (arenaEntrance) {
        setPlayerAnimation(false);
        openShop(arenaEntrance.shopItems, arenaEntrance.shopName);
        return;
    }

    const monsterCell = footprintCells.find(cell => cell.monster);
    if (monsterCell) {
        setPlayerAnimation(false);
        if (currentTime - player.lastDamageTime >= player.damageCooldown) {
            hp -= monsterCell.monster.damage;
            player.lastDamageTime = currentTime;
            updateUI();
            showMessage(`Ouch! -${monsterCell.monster.damage} HP`, "red");
        }
        return;
    }

    const blockingCell = footprintCells.find(cell =>
        cell.solid && !cell.overhead && !cell.isDoor
    );
    if (blockingCell) {
        setPlayerAnimation(false);
        if (blockingCell.touchMessage && !blockingCell.touchMessageShown) {
            showMessage(blockingCell.touchMessage);
            blockingCell.touchMessageShown = true;
        }
        return;
    }

    player.x = newX;
    player.y = newY;

    const door = footprintCells.find(cell => cell.isDoor && cell.targetLevel);
    if (door) {
        setPlayerAnimation(false);
        loadLevel(door.targetLevel);
        return;
    }

    const landedCell = grid[player.y * cols + player.x];
    if (landedCell?.touchMessage && !landedCell.touchMessageShown) {
        showMessage(landedCell.touchMessage);
        landedCell.touchMessageShown = true;
    }
    if (landedCell?.initFunction) landedCell.initFunction();

    if (playerElement) {
        playerElement.style.left = `${player.x * CELL_SIZE}px`;
        playerElement.style.top = `${(player.y - PLAYER_HEIGHT_CELLS + 1) * CELL_SIZE}px`;
        setPlayerAnimation(isHorizontalMove);
    }
    player.lastMoveTime = currentTime;
}

// =============================
// GAME LOOP
// =============================
function gameLoop(timestamp) {
    if (hp < 1) {
        if (!isDead) {
            isDead = true;
            deaths++;
            localStorage.setItem('deaths', deaths);
            bankMoney = 0;
            localStorage.setItem('bankMoney', bankMoney);
            initiateGrid(rows, cols, '#FF0000', gridContainer);
            if (playerElement) playerElement.style.display = 'none';
            if (cursorImage) cursorImage.style.display = 'none';
            if (bgm) { bgm.pause(); bgm.currentTime = 0; }
            showMessage("You died! Press R to restart.", "red", true);
        }
        if (keysPressed['r'] || keysPressed['R']) location.reload();
        requestAnimationFrame(gameLoop);
        return;
    }

    const currentTime = timestamp || performance.now();
    const timeSinceLastMove = currentTime - player.lastMoveTime;

    const isMovingKey = ['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']
        .some(key => keysPressed[key]);

    if (isMovingKey && timeSinceLastMove >= player.moveCooldown) {
        update(currentTime);
    }

    if (currentTime - lastBankInterestTime > 60000) {
        if (bankMoney >= 20) {
            const interest = Math.floor(bankMoney / 20);
            bankMoney += interest;
            localStorage.setItem('bankMoney', bankMoney);
        }
        lastBankInterestTime = currentTime;
    }

    updateCrosshair();
    requestAnimationFrame(gameLoop);
}


// =============================
// GRID INIT
// =============================
function initiateGrid(r, c, value, container) {
    rows = r;
    cols = c;

    grid = [];
    door2s = [];
    while (container.firstChild) container.removeChild(container.firstChild);

    container.style.display = 'grid';
    container.style.gridTemplateColumns = `repeat(${c}, ${CELL_SIZE}px)`;
    container.style.gridTemplateRows = `repeat(${r}, ${CELL_SIZE}px)`;
    container.style.width = `${c * CELL_SIZE}px`;
    container.style.height = `${r * CELL_SIZE}px`;
    container.style.position = 'relative';

    for (let i = 0; i < r * c; i++) {
        const cell = document.createElement("div");
        cell.classList.add("grid-cell");
        cell.style.width = `${CELL_SIZE}px`;
        cell.style.height = `${CELL_SIZE}px`;
        cell.style.boxSizing = 'border-box';
        cell.style.backgroundSize = 'cover';
        cell.style.backgroundRepeat = 'no-repeat';

        if (typeof value === 'string' && value.endsWith('.png')) {
            cell.style.backgroundImage = `url('${value}')`;
        } else {
            cell.style.backgroundColor = value;
        }

        cell.dataset.index = i;

        cell.addEventListener("mouseenter", (e) => {
            const idx = Number(e.currentTarget.dataset.index);
            mouseRow = Math.floor(idx / c);
            mouseCol = idx % c;
            updateCrosshair();
        });

        cell.addEventListener("click", (e) => {
            const idx = Number(e.currentTarget.dataset.index);
            const clickedRow = Math.floor(idx / cols);
            const clickedCol = idx % cols;
            const cellData = grid[idx];

            if (cellData && cellData.isSign && cellData.message) {
                if (Array.isArray(cellData.message)) {
                    if (typeof cellData.messageIndex === 'undefined') cellData.messageIndex = 0;
                    let msg = cellData.message[cellData.messageIndex];
                    if (typeof msg === 'function') msg = msg();
                    showMessage(msg);
                    if (cellData.isShop && cellData.messageIndex === cellData.message.length - 1) {
                        setTimeout(() => openShop(cellData.shopItems, cellData.shopName), 2000);
                    }
                    cellData.messageIndex = (cellData.messageIndex + 1) % cellData.message.length;
                } else {
                    showMessage(cellData.message);
                    if (cellData.isShop) setTimeout(() => openShop(cellData.shopItems, cellData.shopName), 2000);
                }
                return;
            }

            if (cellData && cellData.isShop) {
                openShop(cellData.shopItems, cellData.shopName);
                return;
            }

            if (cellData && (!cellData.solid || cellData.monster)) {
                shoot(clickedRow, clickedCol);
            }
        });

        container.appendChild(cell);

        grid.push({
            solid: false,
            isSign: false,
            message: null,
            isDoor: false,
            initFunction: null,
            isShop: false,
            overhead: false,
            bg: (typeof value === 'string' ? value : null)
        });
    }

    if (cursorImage) container.appendChild(cursorImage);
    if (playerElement) {
        container.appendChild(playerElement);
        playerElement.style.display = 'block';
    }
}

// =============================
// ANIMATION HUB
// =============================
function addAnimation(fromPath, toPath) {
    animations.push({ from: fromPath, to: toPath, toggle: false });
}

function runAnimationStep(anim) {
    const cells = gridContainer.querySelectorAll(".grid-cell");
    const currentSrc = anim.toggle ? anim.to : anim.from;
    const nextSrc = anim.toggle ? anim.from : anim.to;
    const currentVariants = [`url("${currentSrc}")`, `url('${currentSrc}')`];
    const nextValue = `url("${nextSrc}")`;

    cells.forEach((cell, i) => {
        const cur = cell.style.backgroundImage;
        if (cur === currentVariants[0] || cur === currentVariants[1]) {
            cell.style.backgroundImage = nextValue;
            if (grid[i]) grid[i].bg = nextSrc;
        }
    });
    anim.toggle = !anim.toggle;
}

function startAnimationHub() {
    if (animationIntervalId) clearInterval(animationIntervalId);
    animationIntervalId = setInterval(() => {
        animations.forEach(anim => runAnimationStep(anim));
    }, 150);
}

// =============================
// SET / SETS
// =============================
function setCell(row, col, value, properties = {}) {
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    const index = row * cols + col;
    const cells = gridContainer.querySelectorAll(".grid-cell");
    const cell = cells[index];
    if (!cell) return;

    grid[index] = {
        solid: false,
        isSign: false,
        initFunction: null,
        message: null,
        isDoor: false,
        isShop: false,
        overhead: false,
        bg: (typeof value === 'string' ? value : null),
        ...properties
    };

    if (typeof value === 'string' && value.endsWith('.png')) {
        cell.style.backgroundImage = `url('${value}')`;
        cell.style.backgroundColor = "";
    } else {
        cell.style.backgroundImage = "";
        cell.style.backgroundColor = value;
    }

    cell.style.zIndex = grid[index].overhead ? '20' : '';
}

function setCells(startRow, startCol, endRow, endCol, value, properties = {}) {
    const r1 = Math.min(startRow, endRow);
    const r2 = Math.max(startRow, endRow);
    const c1 = Math.min(startCol, endCol);
    const c2 = Math.max(startCol, endCol);
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            setCell(r, c, value, { ...properties });
        }
    }
}

function setDoor2(row, col, targetLevel) {
    door2s.push({ row, col, targetLevel });
}

function setDoor2Cells(startRow, startCol, endRow, endCol, targetLevel) {
    const r1 = Math.min(startRow, endRow);
    const r2 = Math.max(startRow, endRow);
    const c1 = Math.min(startCol, endCol);
    const c2 = Math.max(startCol, endCol);
    for (let row = r1; row <= r2; row++) {
        for (let col = c1; col <= c2; col++) {
            setDoor2(row, col, targetLevel);
        }
    }
}

const structures = {
    slotMachine: [
        { y: -1, x: 0, value: '/afg/assets/blocks/slot_machinetr.png', properties: {solid: true, isShop: true, shopName: 'Gamble', shopItems: [{name: 'Yes'}]} },
        { y: -1, x: 1, value: '/afg/assets/blocks/slot_machinetl.png', properties: {solid: true, isShop: true, shopName: 'Gamble', shopItems: [{name: 'Yes'}]} },
        { y: 0, x: 0, value: '/afg/assets/blocks/slot_machinedl.png', properties: {solid: true, isShop: true, shopName: 'Gamble', shopItems: [{name: 'Yes'}]} },
        { y: 0, x: 1, value: '/afg/assets/blocks/slot_machinedr.png', properties: {solid: true, isShop: true, shopName: 'Gamble', shopItems: [{name: 'Yes'}]} }
    ]
};

function spawnStructure(name, y, x) {
    const structure = structures[name];
    if (!structure) return;
    structure.forEach(block => {
        setCell(y + block.y, x + block.x, block.value, { ...block.properties });
    });
}

// =============================
// MESSAGE BOX
// =============================
function createMessageBox() {
    if (document.getElementById('message-box')) return;
    const messageBox = document.createElement('div');
    messageBox.id = 'message-box';
    messageBox.style.position = 'fixed';
    messageBox.style.bottom = '20px';
    messageBox.style.left = '50%';
    messageBox.style.transform = 'translateX(-50%)';
    messageBox.style.background = 'rgba(0,0,0,0.8)';
    messageBox.style.color = 'white';
    messageBox.style.padding = '8px 12px';
    messageBox.style.borderRadius = '6px';
    messageBox.style.display = 'none';
    messageBox.style.zIndex = 99999;

    const messageText = document.createElement('p');
    messageText.id = 'message-text';
    messageText.style.margin = 0;
    messageBox.appendChild(messageText);
    document.body.appendChild(messageBox);

    messageBox.style.cursor = 'pointer';
    messageBox.setAttribute('role', 'status');
    messageBox.setAttribute('aria-live', 'polite');
    messageBox.addEventListener('click', dismissMessage);
}

function createCoordsDisplay() {
    const el = document.createElement('div');
    el.id = 'coords-display';
    el.style.position = 'fixed';
    el.style.top = '10px';
    el.style.right = '10px';
    el.style.color = 'white';
    el.style.fontFamily = '"Lora", serif';
    el.style.fontSize = '24px';
    el.style.zIndex = '10000';
    el.style.textShadow = '2px 2px 0 #000';
    el.style.display = 'none';
    document.body.appendChild(el);
}

function dismissMessage() {
    const messageBox = document.getElementById('message-box');
    if (messageTimeoutId) {
        clearTimeout(messageTimeoutId);
        messageTimeoutId = null;
    }
    if (messageBox) messageBox.style.display = 'none';
    messageBlocking = false;
}

function showMessage(text, color = 'white', blocking = false) {
    if (messageBlocking) return;
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-text');
    if (!messageBox || !messageText) return;

    if (messageTimeoutId) {
        clearTimeout(messageTimeoutId);
        messageTimeoutId = null;
    }
    messageText.style.color = color;
    messageText.textContent = String(text ?? '');
    messageBox.style.display = 'block';
    messageBox.setAttribute('aria-label', blocking ? 'Click to continue' : 'Game message');
    messageBlocking = blocking;

    // Blocking messages stay visible until clicked; ordinary notices close on their own.
    if (!blocking) {
        messageTimeoutId = setTimeout(dismissMessage, 2000);
    }
}

function updateUI() {
    const hpEl = document.getElementById("hp");
    const moneyEl = document.getElementById("money");
    const adminEl = document.getElementById("Admin");
    if (hpEl) hpEl.textContent = "Health: " + hp;
    if (moneyEl) moneyEl.textContent = "$: " + money;
    if (adminEl) adminEl.textContent = admin;
}

// =============================
// CROSSHAIR
// =============================
function setupCrosshair(container) {
    cursorImage = document.createElement("div");
    cursorImage.setAttribute("aria-hidden", "true");
    cursorImage.style.boxSizing = "border-box";
    cursorImage.style.border = "2px solid white";
    cursorImage.style.borderRadius = "50%";
    cursorImage.style.boxShadow = "0 0 2px 1px black";
    cursorImage.style.width = "13px";
    cursorImage.style.height = "13px";
    cursorImage.style.position = "absolute";
    cursorImage.style.pointerEvents = "none";
    cursorImage.style.zIndex = "9999";
    cursorImage.style.display = "none";
    container.appendChild(cursorImage);

    container.addEventListener("mousemove", (e) => {
        const rect = container.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const col = Math.floor(cx / CELL_SIZE);
        const row = Math.floor(cy / CELL_SIZE);
        if (row < 0 || row >= rows || col < 0 || col >= cols) {
            mouseRow = null; mouseCol = null;
            cursorImage.style.display = "none";
            return;
        }
        mouseRow = row; mouseCol = col;
        updateCrosshair();
    });

    container.addEventListener("mouseleave", () => {
        mouseRow = null; mouseCol = null;
        cursorImage.style.display = "none";
    });
}

function updateCrosshair() {
    if (hp < 1) { if (cursorImage) cursorImage.style.display = "none"; return; }

    const coordsEl = document.getElementById('coords-display');
    if (coordsEl && showCoords) {
        coordsEl.textContent = (mouseRow !== null && mouseCol !== null) ? `X: ${mouseCol} Y: ${mouseRow}` : "";
    }

    if (!cursorImage || mouseRow === null || mouseCol === null) return;
    if (mouseRow < 0 || mouseRow >= rows || mouseCol < 0 || mouseCol >= cols) {
        cursorImage.style.display = "none"; return;
    }

    const index = mouseRow * cols + mouseCol;
    if (!grid[index]) { cursorImage.style.display = "none"; return; }
    if (grid[index].solid && !grid[index].monster) { cursorImage.style.display = "none"; return; }

    cursorImage.style.display = "block";
    cursorImage.style.left = (mouseCol * CELL_SIZE + (CELL_SIZE / 2) - 6.5) + "px";
    cursorImage.style.top = (mouseRow * CELL_SIZE + (CELL_SIZE / 2) - 6.5) + "px";
}

function spawnMonster(row, col, hp, damage, skin, options = {}) {
    const index = row * cols + col;
    if (!grid[index]) return;

    const el = document.createElement('div');
    el.style.width = `${CELL_SIZE}px`;
    el.style.height = `${CELL_SIZE}px`;
    el.style.position = 'absolute';
    el.style.left = `${col * CELL_SIZE}px`;
    el.style.top = `${row * CELL_SIZE}px`;
    el.style.backgroundImage = `url('${skin}')`;
    el.style.backgroundSize = 'cover';
    el.style.zIndex = '12';
    gridContainer.appendChild(el);

    grid[index].solid = true;
    grid[index].monster = {
        hp: hp,
        damage: damage,
        element: el,
        lastHitTime: -1000,
        reward: options.reward,
        defeatMessage: options.defeatMessage,
    };
}

function getridof(item) {
    if (item1 === item) item1 = blank.name;
    else if (item2 === item) item2 = blank.name;
    else if (item3 === item) item3 = blank.name;
    else if (item4 === item) item4 = blank.name;
    else if (item5 === item) item5 = blank.name;
    if (equipped === item) equipped = blank.name;
    renderHotbar();
}

// =============================
// SHOOT
// =============================
function shoot(row, col) {
    const index = row * cols + col;
    const cell = grid[index];
    let damage = 0;
    const now = performance.now();

    

    if (equipped === Sword.name) damage = Sword.damage;

    if (damage > 0 && blockShoot === false) showMessage("Slice", "red");

    if (cell && cell.monster && damage > 0) {
        if (now - (cell.monster.lastHitTime || 0) < 300) return;
        cell.monster.lastHitTime = now;
        cell.monster.hp -= damage;

        if (cell.monster.hp <= 0) {
            const reward = cell.monster.reward ?? 20;
            showMessage(cell.monster.defeatMessage || `Monster defeated! +${reward} gold!`, "gold", true);
            money += reward;
            updateUI();

            if (cell.monster.element) cell.monster.element.remove();
            cell.monster = null;
            cell.solid = false;
        } else {
            showMessage(`Hit! HP: ${cell.monster.hp}`, "orange");
        }
    }
}

// =============================
// UTIL
// =============================
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

async function moveMonsterTo(startRow, startCol, targetRow, targetCol, duration) {
    const startIndex = startRow * cols + startCol;
    const startCell = grid[startIndex];
    if (!startCell || !startCell.monster) return;

    const monsterData = startCell.monster;
    const visual = monsterData.element;

    const queue = [{ r: startRow, c: startCol, path: [] }];
    const visited = new Set([`${startRow},${startCol}`]);
    const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    let finalPath = null;

    while (queue.length > 0) {
        const { r, c, path } = queue.shift();
        if (r === targetRow && c === targetCol) { finalPath = path; break; }
        for (const [dr, dc] of directions) {
            const nr = r + dr; const nc = c + dc;
            const key = `${nr},${nc}`;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                const idx = nr * cols + nc;
                const isTarget = nr === targetRow && nc === targetCol;
                const playerCell = playerOccupiesCell(nr, nc);
                if (!visited.has(key)
                    && (!grid[idx].solid || isTarget)
                    && (!playerCell || isTarget)) {
                    visited.add(key);
                    queue.push({ r: nr, c: nc, path: [...path, { r: nr, c: nc }] });
                }
            }
        }
    }

    if (finalPath) {
        const stepDuration = duration / finalPath.length;
        visual.style.transition = `left ${stepDuration}ms linear, top ${stepDuration}ms linear`;
        let currentR = startRow; let currentC = startCol;

        for (const step of finalPath) {
            if (monsterData.hp <= 0) return;
            if (playerOccupiesCell(step.r, step.c)) {
                hp -= monsterData.damage;
                updateUI();
                showMessage(`Ouch! -${monsterData.damage} HP`, "red");
                return;
            }
            const oldIdx = currentR * cols + currentC;
            grid[oldIdx].solid = false; grid[oldIdx].monster = null;
            const nextIndex = step.r * cols + step.c;
            grid[nextIndex].solid = true; grid[nextIndex].monster = monsterData;
            visual.style.left = `${step.c * CELL_SIZE}px`;
            visual.style.top = `${step.r * CELL_SIZE}px`;
            await new Promise(r => setTimeout(r, stepDuration));
            currentR = step.r; currentC = step.c;
        }
    }
}

async function follow(startRow, startCol, stepSpeed = 300) {
    let r = startRow; let c = startCol;
    while (hp > 0) {
        const idx = r * cols + c;
        const cell = grid[idx];
        if (!cell || !cell.monster || cell.monster.hp <= 0) return;
        const targetR = player.y; const targetC = player.x;
        const dist = Math.abs(targetR - r) + Math.abs(targetC - c);
        if (dist === 0) { await new Promise(res => setTimeout(res, 500)); continue; }
        await moveMonsterTo(r, c, targetR, targetC, dist * stepSpeed);
        r = targetR; c = targetC;
    }
}

// =============================
// LOAD LEVEL
// =============================
async function loadLevel(levelName) {
    closeShop();
    currentLevel = levelName;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    if (levelName === 'main') {
        rows = 15;
        cols = 15;
        player.x = 5;
        player.y = 5;
        initiateGrid(rows, cols, '/afg/assets/blocks/stone.png', gridContainer);
        if (!playerElement) createPlayer(gridContainer);


    }

    if (!cursorImage) setupCrosshair(gridContainer);
    if (playerElement) {
        playerElement.style.left = `${player.x * CELL_SIZE}px`;
        playerElement.style.top = `${(player.y - PLAYER_HEIGHT_CELLS + 1) * CELL_SIZE}px`;
    }
}

// =============================
// SHOP
// =============================
function openShop(items, shopName) {
    if (messageBlocking) return;
    if (document.getElementById('shop-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'shop-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '50%';
    overlay.style.left = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    overlay.style.padding = '20px';
    overlay.style.border = '2px solid white';
    overlay.style.borderRadius = '10px';
    overlay.style.zIndex = '10001';
    overlay.style.textAlign = 'center';
    overlay.style.color = 'white';
    overlay.style.fontFamily = '"Lora", serif';

    const title = document.createElement('h2');
    title.textContent = shopName || "Shop";
    overlay.appendChild(title);

    const createBtn = (text, onClick) => {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.display = 'block';
        btn.style.margin = '10px auto';
        btn.style.padding = '10px 20px';
        btn.style.fontSize = '18px';
        btn.style.cursor = 'pointer';
        btn.onclick = onClick;
        return btn;
    };

    if (items && Array.isArray(items)) {
        items.forEach(item => {
            let btnText = item.name;
            if (item.price !== undefined) btnText += ` ($${item.price})`;
            overlay.appendChild(createBtn(btnText, () => buyItem(item.name, item.price, item.customResponse)));
        });
    }
    overlay.appendChild(createBtn('Close', () => closeShop()));
    document.body.appendChild(overlay);
}

function closeShop() {
    const overlay = document.getElementById('shop-overlay');
    if (overlay) document.body.removeChild(overlay);
}

function buyItem(name, cost, customResponse) {
    if (customResponse) {
        showMessage(customResponse, "white");
        closeShop();
        return;
    }
    if (name === 'Enter Arena') {
        closeShop();
        loadLevel('Arena');
        return;
    }
    if (name === 'Yes') {
        closeShop();
        if (money < 10) { showMessage("Not enough money to gamble!", "red"); return; }
        if (Math.random() < 0.1) {
            money += 10; updateUI(); showMessage("You won!", "gold");
        } else { money -= 10; updateUI(); showMessage("You lost 10 coins.", "red"); }
        return;
    }
    if (name === '1 Doller' && money >= 10) {
        money -= 9; updateUI();
        showMessage("Cloak Man: Imagine falling for that scam! (Hahaha)", "green");
        closeShop(); return;
    }
    if (name === 'Throw Coin') {
        if (money >= cost) {
            money -= cost;
            if (Math.random() < 0.1) { money += 5; showMessage("✨ The Water Spirits have blessed you! +$5 ✨", "gold"); }
            else { showMessage("You threw a coin... nothing happened.", "white"); }
            updateUI(); closeShop();
        } else { showMessage("Not enough money to make a wish!", "red"); }
        return;
    }
    if (name === 'Add Money') {
        closeShop();
        setTimeout(() => openShop([{name: 'Deposit $10'},{name: 'Deposit $20'},{name: 'Deposit $50'},{name: 'Deposit $100'},{name: 'Deposit All'}], "Select Deposit Amount"), 100);
        return;
    }
    if (name.startsWith('Deposit $')) {
        const amount = parseInt(name.replace('Deposit $', ''));
        if (money >= amount) { money -= amount; bankMoney += amount; localStorage.setItem('bankMoney', bankMoney); updateUI(); showMessage(`Deposited $${amount}.`, "green"); }
        else { showMessage("Not enough cash!", "red"); }
        closeShop(); return;
    }
    if (name === 'Deposit All') {
        if (money > 0) { const amount = money; money = 0; bankMoney += amount; localStorage.setItem('bankMoney', bankMoney); updateUI(); showMessage(`Deposited $${amount}.`, "green"); }
        else { showMessage("No cash to deposit!", "red"); }
        closeShop(); return;
    }
    if (name === 'Take Money') {
        if (bankMoney > 0) { const amount = bankMoney; money += amount; bankMoney = 0; localStorage.setItem('bankMoney', bankMoney); updateUI(); showMessage(`Withdrew all $${amount}.`, "green"); }
        else { showMessage("Bank is empty!", "red"); }
        closeShop(); return;
    }
    if (money >= cost) {
        const validFits = ["Casual", "Street Wear", "Jersey", "White Tuxedo", "Your very own cloak!!!"];
        if (validFits.includes(name)) {
            if (!ownedFits.includes(name)) { money -= cost; ownedFits.push(name); updateUI(); showMessage(`Bought ${name}! Press E to change fit.`, "green"); }
            else { showMessage("You already own this outfit!", "orange"); }
            closeShop(); return;
        }
        let bought = false;
        if (item1 === 'nothing') { item1 = name; bought = true; }
        else if (item2 === 'nothing') { item2 = name; bought = true; }
        else if (item3 === 'nothing') { item3 = name; bought = true; }
        else if (item4 === 'nothing') { item4 = name; bought = true; }
        else if (item5 === 'nothing') { item5 = name; bought = true; }
        if (bought) {
            money -= cost;
            updateUI();
            renderHotbar();
            showMessage(`Bought ${name}!`, "green");
            closeShop();
            return;
        }
        showMessage("Inventory full!", "red");
    } else {
        showMessage("Not enough money!", "red");
    }
}
