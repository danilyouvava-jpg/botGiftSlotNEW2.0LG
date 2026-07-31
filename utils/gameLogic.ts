import { SymbolType, SymbolData, CoinType, ROWS, COLS } from '../types';
import { DUROV_WEIGHTS, FLOUR_WEIGHTS, OBEZIANA_WEIGHTS, BONUS_WEIGHTS, SYMBOL_CONFIG, ThemeId } from '../constants';

export const getRandomSymbol = (isBonus: boolean = false, bet: number = 1, theme: ThemeId = 'durov'): SymbolData => {
  let weights = theme === 'durov' ? DUROV_WEIGHTS : FLOUR_WEIGHTS;
  if (theme === 'obeziana') weights = OBEZIANA_WEIGHTS;
  if (isBonus) weights = BONUS_WEIGHTS;

  // RIGGING FOR HIGH BETS (25+)
  // Make high value symbols much rarer to lower RTP for high rollers
  if (bet >= 25 && !isBonus) {
      weights = weights.map(w => {
          let newWeight = w.weight;
          
          // Reduce High Value & Specials by 60%
          if ([SymbolType.PLANE, SymbolType.LOCK, SymbolType.GIFT, SymbolType.DIAMOND, SymbolType.WILD, SymbolType.COIN].includes(w.type)) {
              newWeight = Math.max(1, Math.floor(w.weight * 0.4)); 
          }
          
          // Increase Low Value Fillers by 50%
          if ([SymbolType.SHIELD, SymbolType.BOT, SymbolType.HASH, SymbolType.NUM].includes(w.type)) {
              newWeight = Math.floor(w.weight * 1.5); 
          }
          
          return { ...w, weight: newWeight };
      });
  }

  const totalWeight = weights.reduce((acc, item) => acc + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  let selectedType = SymbolType.PLANE; // Default fallback
  for (const item of weights) {
    random -= item.weight;
    if (random <= 0) {
      selectedType = item.type;
      break;
    }
  }

  // Generate Coin Data
  let coinValue = 0;
  let coinType = CoinType.STANDARD;

  if (selectedType === SymbolType.COIN) {
    // Bet-dependent values with chance for higher wins
    // User req: INCREASED WINS
    const valRoll = Math.random();
    let mult = 0.5;
    
    // RIGGING: Harder to get high multipliers on high bets
    if (bet >= 25) {
        if (valRoll > 0.99) mult = 3.0; // Very rare max
        else if (valRoll > 0.90) mult = 2.0; // 9% chance for x2 (Nice win to keep hooked)
        else if (valRoll > 0.80) mult = 1.5; // 10% chance
        else if (valRoll > 0.50) mult = 1.0; // 30% chance (Break even illusion)
        else if (valRoll > 0.25) mult = 0.8; // 25% chance (Small loss)
        else mult = 0.5; // 25% chance (Loss)
    } else {
        // Standard generous logic for low bets
        if (valRoll > 0.98) {
            // Max win: 5.0x for all bets (Rare)
            mult = 5.0; 
            // Durov can give higher mults more often
            if (theme === 'durov' && Math.random() > 0.9) mult = 10.0;
        } else if (valRoll > 0.95) {
            mult = 3.0; 
        } else if (valRoll > 0.85) {
            mult = 2.0; 
        } else if (valRoll > 0.70) {
            mult = 1.5; 
        } else if (valRoll > 0.50) {
            mult = 1.0; 
        } else if (valRoll > 0.30) {
            mult = 0.8;
        } else {
            mult = 0.5;
        }
    }

    // Ensure integers for display niceness if bet is large enough, else 1 decimal
    coinValue = Math.max(0.1, Math.round(bet * mult * 10) / 10);
    // User requested specific integers for bet 10 (1,3,5,10,12). 
    // If bet=10, 0.1*10=1. 1.2*10=12. Matches.

    // Special coin types
    if (isBonus) {
        const typeRoll = Math.random();
        // Red (Multiplier) and Yellow (Collect) - REDUCED CHANCES (Balanced)
        if (typeRoll > 0.90) coinType = CoinType.COLLECT; // Yellow (10% chance)
        else if (typeRoll > 0.80) coinType = CoinType.MULTIPLIER; // Red (10% chance)
        else coinType = CoinType.STANDARD; // Blue
    }
  }

  return {
    id: Math.random().toString(36).substr(2, 9),
    type: selectedType,
    coinValue: selectedType === SymbolType.COIN ? coinValue : undefined,
    coinType: selectedType === SymbolType.COIN ? coinType : undefined,
    isLocked: false
  };
};

export const generateGrid = (
  rows: number, 
  cols: number, 
  isBonus: boolean = false, 
  bet: number = 1, 
  theme: ThemeId = 'durov',
  lockedCells: {r: number, c: number}[] = [],
  currentGrid?: SymbolData[][]
): SymbolData[][] => {
  const grid: SymbolData[][] = [];
  
  // Initialize empty grid
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
  }

  // Generate column by column to control vertical constraints
  for (let c = 0; c < cols; c++) {
    let hasWildInColumn = false;

    for (let r = 0; r < rows; r++) {
      // If cell is locked and we have previous grid, preserve it
      const isLocked = lockedCells.some(cell => cell.r === r && cell.c === c);
      if (isLocked && currentGrid && currentGrid[r] && currentGrid[r][c]) {
          grid[r][c] = { ...currentGrid[r][c], isLocked: true };
          continue;
      }

      let symbol = getRandomSymbol(isBonus, bet, theme);

      // Constraint: Only one Wild per column (line)
      // If we already have a Wild in this column, reroll until it's not a Wild
      if (symbol.type === SymbolType.WILD && hasWildInColumn) {
         while (symbol.type === SymbolType.WILD) {
             symbol = getRandomSymbol(isBonus, bet, theme);
         }
      }

      if (symbol.type === SymbolType.WILD) {
          hasWildInColumn = true;
      }

      grid[r][c] = symbol;
    }
  }
  
  return grid;
};

export const checkWin = (grid: SymbolData[][], bet: number, theme: ThemeId = 'durov') => {
  let winAmount = 0;
  const winningLines: { row: number, col: number }[] = [];
  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  // SPECIAL LOGIC FOR OBEZIANA (Scatter Pay for PLANE / Demonmakaka)
  if (theme === 'obeziana') {
      let planeCount = 0;
      const planeCells: {r: number, c: number}[] = [];

      for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
              if (grid[r][c].type === SymbolType.PLANE) {
                  planeCount++;
                  planeCells.push({r, c});
              }
          }
      }

      // 3 Planes = Win 20x
      if (planeCount >= 3) {
          const mult = SYMBOL_CONFIG[SymbolType.PLANE].multiplier; // Should be 20 now
          winAmount += (bet * mult);
          planeCells.forEach(cell => winningLines.push({row: cell.r, col: cell.c}));
      }
  }

  for (let r = 0; r < rows; r++) {
    let matchCount = 1;
    
    // Determine start symbol with expansion logic
    let firstCellType = grid[r][0].type;
    if (theme === 'flour' && r > 0 && grid[r-1][0].type === SymbolType.WILD) {
        firstCellType = SymbolType.WILD;
    }

    let currentSymbol = firstCellType;
    let isWildStart = currentSymbol === SymbolType.WILD;

    for (let c = 1; c < cols; c++) {
      const cell = grid[r][c];
      let cellType = cell.type;

      // Flour Theme Wild Expansion Logic for current cell
      if (theme === 'flour' && r > 0 && grid[r-1][c].type === SymbolType.WILD) {
          cellType = SymbolType.WILD;
      }
      
      if (cellType === SymbolType.WILD) {
        matchCount++;
      } else if (isWildStart) {
        currentSymbol = cellType;
        isWildStart = false;
        matchCount++;
      } else if (cellType === currentSymbol) {
        matchCount++;
      } else {
        break;
      }
    }

    // Skip standard win check for PLANE in Obeziana if handled above (or allow double win? usually scatter is separate)
    // But since Obeziana is 3x3 and scatter is "anywhere", lines don't matter for Plane.
    if (theme === 'obeziana' && currentSymbol === SymbolType.PLANE) continue;

    if (matchCount >= 3 && currentSymbol !== SymbolType.COIN) {
       // Base win calc: Bet * SymbolMult * LengthMult
       // LengthMult: 3->1x, 4->2x, 5->5x
       let lengthMult = 1;
       if (matchCount === 4) lengthMult = 2;
       if (matchCount === 5) lengthMult = 5;
       
       const symbolMult = SYMBOL_CONFIG[currentSymbol].multiplier;
       winAmount += (bet * symbolMult * lengthMult);
       
       for(let i=0; i<matchCount; i++) winningLines.push({row: r, col: i});
    }
  }

  return { winAmount: Number(winAmount.toFixed(2)), winningLines };
};

export const countCoins = (grid: SymbolData[][]): number => {
  let count = 0;
  grid.forEach(row => row.forEach(cell => {
    if (cell.type === SymbolType.COIN) count++;
  }));
  return count;
};