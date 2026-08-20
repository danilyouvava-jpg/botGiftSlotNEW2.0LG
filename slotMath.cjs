const crypto = require('crypto');

const ROWS = 4;
const COLS = 5;

const SymbolType = {
    PLANE: 'PLANE', LOCK: 'LOCK', SHIELD: 'SHIELD',
    BOT: 'BOT', STAR: 'STAR', GIFT: 'GIFT',
    DIAMOND: 'DIAMOND', HASH: 'HASH', NUM: 'NUM',
    WILD: 'WILD', COIN: 'COIN', EMPTY: 'EMPTY'
};

const CoinType = {
    STANDARD: 'STANDARD', EXPAND: 'EXPAND',
    MULTIPLIER: 'MULTIPLIER', COLLECT: 'COLLECT', MAGIC: 'MAGIC'
};

const SYMBOL_CONFIG = {
    [SymbolType.PLANE]:   { multiplier: 20.0 },
    [SymbolType.LOCK]:    { multiplier: 10.0 },
    [SymbolType.SHIELD]:  { multiplier: 1.0 },
    [SymbolType.BOT]:     { multiplier: 1.5 },
    [SymbolType.STAR]:    { multiplier: 2.0 },
    [SymbolType.GIFT]:    { multiplier: 2.5 },
    [SymbolType.DIAMOND]: { multiplier: 4.0 },
    [SymbolType.HASH]:    { multiplier: 0.7 },
    [SymbolType.NUM]:     { multiplier: 0.8 },
    [SymbolType.WILD]:    { multiplier: 0 },
    [SymbolType.COIN]:    { multiplier: 0 },
};

const DUROV_WEIGHTS = [
    { type: SymbolType.PLANE, weight: 3 },
    { type: SymbolType.LOCK, weight: 3 },
    { type: SymbolType.SHIELD, weight: 120 },
    { type: SymbolType.BOT, weight: 100 },
    { type: SymbolType.STAR, weight: 50 },
    { type: SymbolType.GIFT, weight: 8 },
    { type: SymbolType.DIAMOND, weight: 6 },
    { type: SymbolType.HASH, weight: 120 },
    { type: SymbolType.NUM, weight: 120 },
    { type: SymbolType.WILD, weight: 4 },
    { type: SymbolType.COIN, weight: 8 },
];

const FLOUR_WEIGHTS = [
    { type: SymbolType.PLANE, weight: 2 },
    { type: SymbolType.LOCK, weight: 2 },
    { type: SymbolType.SHIELD, weight: 90 },
    { type: SymbolType.BOT, weight: 90 },
    { type: SymbolType.STAR, weight: 30 },
    { type: SymbolType.GIFT, weight: 20 },
    { type: SymbolType.DIAMOND, weight: 8 },
    { type: SymbolType.HASH, weight: 90 },
    { type: SymbolType.NUM, weight: 90 },
    { type: SymbolType.WILD, weight: 25 },
    { type: SymbolType.COIN, weight: 15 },
];

const OBEZIANA_WEIGHTS = [
    { type: SymbolType.PLANE, weight: 4 },
    { type: SymbolType.SHIELD, weight: 80 },
    { type: SymbolType.BOT, weight: 60 },
    { type: SymbolType.STAR, weight: 35 },
    { type: SymbolType.GIFT, weight: 20 },
    { type: SymbolType.DIAMOND, weight: 8 },
    { type: SymbolType.HASH, weight: 100 },
    { type: SymbolType.NUM, weight: 100 },
];

const BONUS_WEIGHTS = [
    { type: SymbolType.EMPTY, weight: 300 },
    { type: SymbolType.COIN, weight: 10 },
];

function uid() {
    return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

// CSPRNG for casino fairness - Math.random is predictable (V8 PRNG)
function rand() {
    return crypto.randomInt(0, 1e9) / 1e9;
}

function pickWeighted(weights) {
    const total = weights.reduce((s, w) => s + w.weight, 0);
    let r = rand() * total;
    for (const w of weights) {
        r -= w.weight;
        if (r <= 0) return w.type;
    }
    return weights[0].type;
}

function getRandomSymbol(isBonus, bet, theme) {
    let weights = theme === 'durov' ? DUROV_WEIGHTS : FLOUR_WEIGHTS;
    if (theme === 'obeziana') weights = OBEZIANA_WEIGHTS;
    if (isBonus) weights = BONUS_WEIGHTS;

    if (bet >= 25 && !isBonus) {
        weights = weights.map(w => {
            let nw = w.weight;
            if ([SymbolType.PLANE, SymbolType.LOCK, SymbolType.GIFT, SymbolType.DIAMOND, SymbolType.WILD, SymbolType.COIN].includes(w.type)) {
                nw = Math.max(1, Math.floor(w.weight * 0.4));
            }
            if ([SymbolType.SHIELD, SymbolType.BOT, SymbolType.HASH, SymbolType.NUM].includes(w.type)) {
                nw = Math.floor(w.weight * 1.5);
            }
            return { ...w, weight: nw };
        });
    }

    const selectedType = pickWeighted(weights);

    let coinValue = 0;
    let coinType = CoinType.STANDARD;

    if (selectedType === SymbolType.COIN) {
        const valRoll = rand();
        let mult = 0.5;

        if (bet >= 25) {
            if (valRoll > 0.99) mult = 3.0;
            else if (valRoll > 0.90) mult = 2.0;
            else if (valRoll > 0.80) mult = 1.5;
            else if (valRoll > 0.50) mult = 1.0;
            else if (valRoll > 0.25) mult = 0.8;
            else mult = 0.5;
        } else {
            if (valRoll > 0.98) { mult = 5.0; if (theme === 'durov' && rand() > 0.9) mult = 10.0; }
            else if (valRoll > 0.95) mult = 3.0;
            else if (valRoll > 0.85) mult = 2.0;
            else if (valRoll > 0.70) mult = 1.5;
            else if (valRoll > 0.50) mult = 1.0;
            else if (valRoll > 0.30) mult = 0.8;
            else mult = 0.5;
        }

        coinValue = Math.max(0.1, Math.round(bet * mult * 10) / 10);

        if (isBonus) {
            const typeRoll = rand();
            if (typeRoll > 0.90) coinType = CoinType.COLLECT;
            else if (typeRoll > 0.80) coinType = CoinType.MULTIPLIER;
            else coinType = CoinType.STANDARD;
        }
    }

    return {
        id: uid(),
        type: selectedType,
        coinValue: selectedType === SymbolType.COIN ? coinValue : undefined,
        coinType: selectedType === SymbolType.COIN ? coinType : undefined,
        isLocked: false
    };
}

function generateGrid(rows, cols, isBonus, bet, theme, lockedCells, currentGrid) {
    const grid = [];
    for (let r = 0; r < rows; r++) grid[r] = [];

    for (let c = 0; c < cols; c++) {
        let hasWild = false;
        for (let r = 0; r < rows; r++) {
            const isLocked = lockedCells && lockedCells.some(cell => cell.r === r && cell.c === c);
            if (isLocked && currentGrid && currentGrid[r] && currentGrid[r][c]) {
                grid[r][c] = { ...currentGrid[r][c], isLocked: true };
                continue;
            }

            let symbol = getRandomSymbol(isBonus, bet, theme);
            if (symbol.type === SymbolType.WILD && hasWild) {
                while (symbol.type === SymbolType.WILD) symbol = getRandomSymbol(isBonus, bet, theme);
            }
            if (symbol.type === SymbolType.WILD) hasWild = true;
            grid[r][c] = symbol;
        }
    }
    return grid;
}

function checkWin(grid, bet, theme) {
    let winAmount = 0;
    const winningLines = [];
    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    if (theme === 'obeziana') {
        let planeCount = 0;
        const planeCells = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c].type === SymbolType.PLANE) {
                    planeCount++;
                    planeCells.push({ r, c });
                }
            }
        }
        if (planeCount >= 3) {
            const mult = SYMBOL_CONFIG[SymbolType.PLANE].multiplier;
            winAmount += bet * mult * (theme === 'durov' ? 3.3 : theme === 'obeziana' ? 3.2 : 1.6);
            planeCells.forEach(cell => winningLines.push({ row: cell.r, col: cell.c }));
        }
    }

    for (let r = 0; r < rows; r++) {
        let matchCount = 1;
        let firstCellType = grid[r][0].type;
        if (theme === 'flour' && r > 0 && grid[r - 1][0].type === SymbolType.WILD) {
            firstCellType = SymbolType.WILD;
        }
        let currentSymbol = firstCellType;
        let isWildStart = currentSymbol === SymbolType.WILD;

        for (let c = 1; c < cols; c++) {
            let cellType = grid[r][c].type;
            if (theme === 'flour' && r > 0 && grid[r - 1][c].type === SymbolType.WILD) {
                cellType = SymbolType.WILD;
            }
            if (cellType === SymbolType.WILD) { matchCount++; }
            else if (isWildStart) { currentSymbol = cellType; isWildStart = false; matchCount++; }
            else if (cellType === currentSymbol) { matchCount++; }
            else { break; }
        }

        if (theme === 'obeziana' && currentSymbol === SymbolType.PLANE) continue;

        if (matchCount >= 3 && currentSymbol !== SymbolType.COIN) {
            let lengthMult = 1;
            if (matchCount === 4) lengthMult = 2;
            if (matchCount === 5) lengthMult = 5;
            const symbolMult = SYMBOL_CONFIG[currentSymbol].multiplier;
            winAmount += bet * symbolMult * lengthMult * (theme === 'durov' ? 3.3 : theme === 'obeziana' ? 3.2 : 1.6);
            for (let i = 0; i < matchCount; i++) winningLines.push({ row: r, col: i });
        }
    }

    return { winAmount: Number(winAmount.toFixed(2)), winningLines };
}

function countCoins(grid) {
    let count = 0;
    grid.forEach(row => row.forEach(cell => {
        if (cell.type === SymbolType.COIN) count++;
    }));
    return count;
}

function simulateBonusRound(triggerGrid, bet, theme) {
    const rows = triggerGrid.length;
    const cols = triggerGrid[0].length;

    const bonusGrid = triggerGrid.map(row => row.map(cell => {
        if (cell.type === SymbolType.COIN) return { ...cell, isLocked: true };
        return { ...cell, type: SymbolType.EMPTY, id: uid() };
    }));

    let initialTotal = 0;
    bonusGrid.forEach(r => r.forEach(c => {
        if (c.type === SymbolType.COIN && c.coinValue) initialTotal += c.coinValue;
    }));

    const spins = [];
    let currentGrid = bonusGrid;
    let spinsLeft = 3;
    let totalSoFar = Math.round(initialTotal * 100) / 100;

    while (spinsLeft > 0) {
        const rawNext = currentGrid.map(row => row.map(cell => {
            if (cell.isLocked) return cell;
            const s = getRandomSymbol(true, bet, theme);
            if (s.type === SymbolType.COIN) return { ...s, isLocked: true };
            return s;
        }));

        const landing = rawNext.map(row => row.map(cell => ({ ...cell })));
        const effects = [];
        let newCoinFound = false;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const oldCell = currentGrid[r][c];
                const newCell = landing[r][c];
                if (!oldCell.isLocked && newCell.isLocked && newCell.type === SymbolType.COIN) {
                    newCoinFound = true;
                    if (newCell.coinType === CoinType.COLLECT) {
                        newCell.coinValue = 0;
                    } else if (newCell.coinType === CoinType.MULTIPLIER) {
                        newCell.coinValue = rand() > 0.5 ? 3 : 2;
                    }
                }
            }
        }

        const finalGrid = landing.map(row => row.map(cell => ({ ...cell })));
        const newCoins = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const old = currentGrid[r][c];
                const now = landing[r][c];
                if (!old.isLocked && now.isLocked && now.type === SymbolType.COIN) {
                    newCoins.push({ r, c, data: now });
                }
            }
        }

        const redCoins = newCoins.filter(nc => nc.data.coinType === CoinType.MULTIPLIER);
        redCoins.forEach(rc => {
            const mult = rc.data.coinValue || 2;
            const targets = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cell = finalGrid[r][c];
                    if (cell.type === SymbolType.COIN && cell.coinValue && !(r === rc.r && c === rc.c) && cell.coinType !== CoinType.MULTIPLIER) {
                        targets.push({ r, c });
                    }
                }
            }
            if (targets.length > 0) {
                const t = targets[Math.floor(rand() * targets.length)];
                effects.push({ from: { r: rc.r, c: rc.c }, to: t, type: 'red' });
                if (finalGrid[t.r][t.c].coinValue) {
                    finalGrid[t.r][t.c] = { ...finalGrid[t.r][t.c], coinValue: Math.round(finalGrid[t.r][t.c].coinValue * mult * 10) / 10 };
                }
                finalGrid[rc.r][rc.c] = { ...finalGrid[rc.r][rc.c], isLocked: false };
            } else {
                finalGrid[rc.r][rc.c] = { ...finalGrid[rc.r][rc.c], isLocked: false };
            }
        });

        const yellowCoins = newCoins.filter(nc => nc.data.coinType === CoinType.COLLECT);
        yellowCoins.forEach(yc => {
            let sum = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cell = finalGrid[r][c];
                    if (cell.type === SymbolType.COIN && cell.coinValue && !(r === yc.r && c === yc.c)) {
                        sum += cell.coinValue;
                        effects.push({ from: { r, c }, to: { r: yc.r, c: yc.c }, type: 'yellow' });
                    }
                }
            }
            finalGrid[yc.r][yc.c] = { ...finalGrid[yc.r][yc.c], coinValue: Math.round(sum * 10) / 10 };
        });

        let currentTotal = 0;
        finalGrid.forEach(r => r.forEach(c => {
            if (c.type === SymbolType.COIN && c.coinValue) currentTotal += c.coinValue;
        }));
        totalSoFar = Math.round(currentTotal * 100) / 100;

        spins.push({
            grid: finalGrid,
            effects,
            totalSoFar,
            newCoinFound
        });

        const isFull = finalGrid.every(r => r.every(c => c.isLocked && c.type === SymbolType.COIN));
        if (isFull) break;

        if (newCoinFound) {
            spinsLeft = 3;
        } else {
            spinsLeft--;
        }

        currentGrid = finalGrid;
    }

    return { spins, totalWin: totalSoFar };
}

function runSpin(bet, theme, lockedCells, currentGrid) {
    const baseGrid = generateGrid(ROWS, COLS, false, bet, theme, lockedCells || [], currentGrid);
    const { winAmount, winningLines } = checkWin(baseGrid, bet, theme);
    const coinCount = countCoins(baseGrid);

    let bonusResult = null;
    if (coinCount >= 5) {
        bonusResult = simulateBonusRound(baseGrid, bet, theme);
    }

    return {
        grid: baseGrid,
        winAmount,
        winningLines,
        isBonusTriggered: coinCount >= 5,
        bonus: bonusResult
    };
}

module.exports = {
    SymbolType, CoinType, ROWS, COLS,
    generateGrid, checkWin, countCoins, getRandomSymbol,
    simulateBonusRound, runSpin
};
