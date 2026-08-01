import { useState, useRef, useCallback, useEffect, startTransition } from 'react';
import { SymbolData, SymbolType, CoinType, GameState, ROWS, COLS } from '../types';
import { ThemeId } from '../constants';

function authHeaders(): Record<string, string> {
    try {
        const initData = (window as any).Telegram?.WebApp?.initData;
        return initData ? { 'x-telegram-initdata': initData } : {};
    } catch { return {}; }
}

function generateDummyGrid(rows: number, cols: number, theme: ThemeId): SymbolData[][] {
    const byTheme: Record<ThemeId, SymbolType[]> = {
        durov: [SymbolType.SHIELD, SymbolType.BOT, SymbolType.STAR, SymbolType.GIFT, SymbolType.HASH, SymbolType.NUM, SymbolType.DIAMOND],
        flour: [SymbolType.SHIELD, SymbolType.BOT, SymbolType.STAR, SymbolType.GIFT, SymbolType.HASH, SymbolType.NUM, SymbolType.DIAMOND],
        obeziana: [SymbolType.SHIELD, SymbolType.BOT, SymbolType.STAR, SymbolType.GIFT, SymbolType.HASH, SymbolType.NUM, SymbolType.DIAMOND, SymbolType.PLANE],
    };
    const pool = byTheme[theme] || byTheme.durov;
    const g: SymbolData[][] = [];
    for (let r = 0; r < rows; r++) {
        g[r] = [];
        for (let c = 0; c < cols; c++) {
            g[r][c] = {
                id: `init_${r}_${c}`,
                type: pool[Math.floor(Math.random() * pool.length)],
                isLocked: false
            };
        }
    }
    return g;
}

const REEL_DELAY = 150;
const MIN_SPIN_TIME = 800;

interface UseGameEngineProps {
  balance: number;
  setBalance: (updater: (prev: number) => number) => void;
  starsBalance: number;
  setStarsBalance: (updater: (prev: number) => number) => void;
  bet: number;
  currency: 'TON' | 'STARS';
  isActive: boolean;
  theme?: ThemeId;
  onTransaction?: (amount: number) => void;
  isMuted?: boolean;
  rows?: number;
  cols?: number;
  userId?: number | null;
}

export const useGameEngine = ({
  balance,
  setBalance,
  starsBalance,
  setStarsBalance,
  bet,
  currency,
  isActive,
  theme = 'durov',
  onTransaction,
  isMuted = false,
  rows = ROWS,
  cols = COLS,
  userId
}: UseGameEngineProps) => {
  const [grid, setGrid] = useState<SymbolData[][]>(() => generateDummyGrid(rows, cols, theme));
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [winData, setWinData] = useState<{ winAmount: number, winningLines: { row: number, col: number }[] } | null>(null);
  const [bonusSpins, setBonusSpins] = useState(3);
  const [bonusTotal, setBonusTotal] = useState(0);
  const [spinningColumns, setSpinningColumns] = useState<boolean[]>(new Array(cols).fill(false));
  const [bonusEffects, setBonusEffects] = useState<{ id: string; from: { r: number, c: number }; to: { r: number, c: number }; type: 'red' | 'yellow' }[]>([]);
  const [activeSpecialCells, setActiveSpecialCells] = useState<{ r: number, c: number, type: 'red' | 'yellow' }[]>([]);
  const [stickyPlanes, setStickyPlanes] = useState<{ r: number, c: number, life: number }[]>([]);

  const spinSoundRef = useRef<HTMLAudioElement | null>(null);
  const winSoundRef = useRef<HTMLAudioElement | null>(null);
  const isSpinningRef = useRef(false);
  const pendingBonusRef = useRef<any>(null);
  const pendingGridRef = useRef<SymbolData[][] | null>(null);

  useEffect(() => {
    spinSoundRef.current = new Audio('/notification-sound.mp3');
    winSoundRef.current = new Audio('/win.mp3');
  }, []);

  const playReelAnimation = useCallback((serverGrid: SymbolData[][], callback: () => void) => {
    let currentReel = 0;
    setTimeout(() => {
      const intervalId = setInterval(() => {
        if (currentReel < cols) {
          const reelIndex = currentReel;
          startTransition(() => {
            setGrid(prevGrid => {
              const nextGrid = [...prevGrid];
              for (let r = 0; r < rows; r++) {
                nextGrid[r] = [...nextGrid[r]];
                nextGrid[r][reelIndex] = serverGrid[r][reelIndex];
              }
              return nextGrid;
            });
            setSpinningColumns(prev => { const next = [...prev]; next[reelIndex] = false; return next; });
          });
          currentReel++;
        } else {
          clearInterval(intervalId);
          callback();
        }
      }, REEL_DELAY);
    }, MIN_SPIN_TIME);
  }, [rows, cols]);

  const handleSpin = useCallback(async () => {
    if (isSpinningRef.current) return;
    if (!userId) return;

    const activeBalance = currency === 'TON' ? balance : starsBalance;
    if (activeBalance < bet || gameState !== GameState.IDLE) return;
    if (activeBalance - bet < 0) return;

    isSpinningRef.current = true;

    if (currency === 'TON') {
      setBalance(prev => Math.max(0, Number((prev - bet).toFixed(2))));
    } else {
      setStarsBalance(prev => Math.max(0, Number((prev - bet).toFixed(2))));
    }

    startTransition(() => {
      setGameState(GameState.SPINNING);
      setWinData(null);
      setBonusTotal(0);
      setSpinningColumns(new Array(cols).fill(true));
    });

    if (isActive && spinSoundRef.current && !isMuted) {
      spinSoundRef.current.currentTime = 0;
      spinSoundRef.current.play().catch(() => {});
    }

    const lockedCells = theme === 'obeziana'
      ? stickyPlanes.filter(p => p.life > 0).map(p => ({ r: p.r, c: p.c }))
      : [];

    try {
      const resp = await fetch('/api/game/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId, bet, theme, lockedCells, currentGrid: grid })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.error('Spin failed:', err);
        if (currency === 'TON') {
          setBalance(prev => Number((prev + bet).toFixed(2)));
        } else {
          setStarsBalance(prev => Number((prev + bet).toFixed(2)));
        }
        setGameState(GameState.IDLE);
        isSpinningRef.current = false;
        return;
      }

      const data = await resp.json();
      const serverGrid: SymbolData[][] = data.grid;

      if (currency === 'STARS') {
        setStarsBalance(data.newBalance);
      } else {
        setBalance(data.newBalance);
      }

      pendingGridRef.current = serverGrid;
      pendingBonusRef.current = data.isBonusTriggered ? data : null;

      playReelAnimation(serverGrid, () => {
        if (data.isBonusTriggered && data.bonus) {
          handleObesianaLocks(serverGrid);
          setTimeout(() => startBonusRoundFromServer(data), 500);
        } else {
          handleObesianaLocks(serverGrid);
          finishRegularSpin(data);
        }
      });
    } catch (e) {
      console.error('Spin request failed:', e);
      if (currency === 'TON') {
        setBalance(prev => Number((prev + bet).toFixed(2)));
      } else {
        setStarsBalance(prev => Number((prev + bet).toFixed(2)));
      }
      setGameState(GameState.IDLE);
      isSpinningRef.current = false;
    }
  }, [userId, balance, starsBalance, bet, gameState, currency, isActive, isMuted, theme, rows, cols, stickyPlanes, setBalance, setStarsBalance, onTransaction, playReelAnimation]);

  const handleObesianaLocks = (finalGrid: SymbolData[][]) => {
    if (theme !== 'obeziana') return;
    const currentPlanes: { r: number, c: number }[] = [];
    finalGrid.forEach((row, r) => row.forEach((cell, c) => {
      if (cell.type === SymbolType.PLANE) currentPlanes.push({ r, c });
    }));
    const newCount = currentPlanes.length;
    const prevCount = stickyPlanes.filter(p => p.life > 0).length;

    if (newCount >= 3) {
      setStickyPlanes([]);
    } else {
      let nextStickies: { r: number, c: number, life: number }[] = [];
      if (newCount > prevCount && newCount > 0) {
        nextStickies = currentPlanes.map(p => ({ ...p, life: 1 }));
      } else {
        nextStickies = stickyPlanes.map(p => ({ ...p, life: p.life - 1 }));
      }
      setStickyPlanes(nextStickies);
    }
  };

  const finishRegularSpin = (data: any) => {
    if (data.winAmount > 0) {
      setWinData({ winAmount: data.winAmount, winningLines: data.winningLines || [] });
      startTransition(() => setGameState(GameState.WIN_ANIMATION));
      if (isActive && winSoundRef.current && !isMuted) {
        winSoundRef.current.currentTime = 0;
        winSoundRef.current.play().catch(() => {});
      }
      setTimeout(() => { setGameState(GameState.IDLE); isSpinningRef.current = false; }, 2500);
    } else {
      setGameState(GameState.IDLE);
      isSpinningRef.current = false;
    }
  };

  const startBonusRoundFromServer = (data: any) => {
    const bonusData = data.bonus;
    const triggerGrid = data.grid;

    const bonusGrid = triggerGrid.map((row: any[]) => row.map((cell: any) => {
      if (cell.type === SymbolType.COIN) return { ...cell, isLocked: true };
      return { ...cell, type: SymbolType.EMPTY, id: Math.random().toString() };
    }));

    startTransition(() => setGrid(bonusGrid));

    let initialTotal = 0;
    bonusGrid.forEach((r: any[]) => r.forEach((c: any) => {
      if (c.type === SymbolType.COIN && c.coinValue) initialTotal += c.coinValue;
    }));
    setBonusTotal(Math.round(initialTotal * 100) / 100);
    setBonusSpins(3);

    startTransition(() => setGameState(GameState.BONUS_TRANSITION));

    setTimeout(() => {
      startTransition(() => setGameState(GameState.BONUS_ACTIVE));
      playBonusSequenceFromServer(bonusGrid, bonusData.spins, 0);
    }, 1500);
  };

  const playBonusSequenceFromServer = (currentGrid: SymbolData[][], serverSpins: any[], spinIndex: number) => {
    if (spinIndex >= serverSpins.length) {
      endBonusRoundFromServer(serverSpins);
      return;
    }

    const spinData = serverSpins[spinIndex];
    const nextGrid: SymbolData[][] = spinData.grid;

    startTransition(() => setSpinningColumns(new Array(cols).fill(true)));

    setTimeout(() => {
      startTransition(() => setSpinningColumns(new Array(cols).fill(false)));

      const landingGrid = nextGrid.map((row: any[]) => row.map((cell: any) => ({ ...cell })));
      const specialCoins: { r: number, c: number, type: 'red' | 'yellow' }[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const oldCell = currentGrid[r]?.[c];
          const newCell = landingGrid[r][c];
          if (oldCell && !oldCell.isLocked && newCell.isLocked && newCell.type === SymbolType.COIN) {
            if (newCell.coinType === CoinType.COLLECT) {
              specialCoins.push({ r, c, type: 'yellow' });
            } else if (newCell.coinType === CoinType.MULTIPLIER) {
              specialCoins.push({ r, c, type: 'red' });
            }
          }
        }
      }

      startTransition(() => setGrid(landingGrid));

      const executeLogic = () => {
        const finalGrid = landingGrid.map((row: any[]) => row.map((cell: any) => ({ ...cell })));
        const effects = spinData.effects || [];

        effects.forEach((eff: any) => {
          if (eff.type === 'red' && eff.from && eff.to) {
            if (finalGrid[eff.to.r]?.[eff.to.c]?.coinValue) {
              finalGrid[eff.to.r][eff.to.c] = {
                ...finalGrid[eff.to.r][eff.to.c],
                coinValue: Math.round(finalGrid[eff.to.r][eff.to.c].coinValue! * (spinData.grid[eff.from.r]?.[eff.from.c]?.coinValue || 2) * 10) / 10
              };
            }
          }
        });

        setBonusTotal(spinData.totalSoFar);

        if (effects.length > 0) {
          startTransition(() => setBonusEffects(effects.map((e: any, i: number) => ({ ...e, id: `eff_${i}` }))));
          setTimeout(() => startTransition(() => setBonusEffects([])), 1500);
          setTimeout(() => {
            startTransition(() => setGrid(finalGrid));
            setTimeout(() => playBonusSequenceFromServer(finalGrid, serverSpins, spinIndex + 1), 1500);
          }, 1400);
        } else {
          startTransition(() => setGrid(finalGrid));
          setTimeout(() => playBonusSequenceFromServer(finalGrid, serverSpins, spinIndex + 1), 1500);
        }
      };

      if (specialCoins.length > 0) {
        startTransition(() => setActiveSpecialCells(specialCoins));
        setTimeout(() => {
          startTransition(() => setActiveSpecialCells([]));
          executeLogic();
        }, 1200);
      } else {
        executeLogic();
      }
    }, 1000);
  };

  const endBonusRoundFromServer = (serverSpins: any[]) => {
    const lastSpin = serverSpins[serverSpins.length - 1];
    const winAmount = lastSpin ? lastSpin.totalSoFar : 0;

    setGameState(GameState.BONUS_PAYOUT);
    setBonusTotal(winAmount);

    if (isActive && winSoundRef.current) {
      winSoundRef.current.currentTime = 0;
      winSoundRef.current.play().catch(() => {});
    }

    setTimeout(() => { setGameState(GameState.IDLE); isSpinningRef.current = false; }, 4000);
  };

  const handleBuyBonus = useCallback(async () => {
    if (isSpinningRef.current) return;
    if (!userId) return;

    const activeBalance = currency === 'TON' ? balance : starsBalance;
    const cost = Math.round(bet * 100);
    if (activeBalance < cost || gameState !== GameState.IDLE) return;

    isSpinningRef.current = true;

    if (currency === 'TON') {
      setBalance(prev => Number((prev - cost).toFixed(2)));
    } else {
      setStarsBalance(prev => Number((prev - cost).toFixed(2)));
    }

    startTransition(() => {
      setGameState(GameState.SPINNING);
      setWinData(null);
      setBonusTotal(0);
      setSpinningColumns(new Array(cols).fill(true));
    });

    if (isActive && spinSoundRef.current && !isMuted) {
      spinSoundRef.current.currentTime = 0;
      spinSoundRef.current.play().catch(() => {});
    }

    try {
      const resp = await fetch('/api/game/buy-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId, bet, theme })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.error('Buy bonus failed:', err);
        if (currency === 'TON') setBalance(prev => Number((prev + cost).toFixed(2)));
        else setStarsBalance(prev => Number((prev + cost).toFixed(2)));
        setGameState(GameState.IDLE);
        isSpinningRef.current = false;
        return;
      }

      const data = await resp.json();

      if (currency === 'STARS') {
        setStarsBalance(data.newBalance);
      } else {
        setBalance(data.newBalance);
      }

      pendingBonusRef.current = { bonus: data.bonus, grid: data.triggerGrid };

      playReelAnimation(data.triggerGrid, () => {
        startBonusRoundFromServer({ grid: data.triggerGrid, bonus: data.bonus });
      });
    } catch (e) {
      console.error('Buy bonus request failed:', e);
      if (currency === 'TON') setBalance(prev => Number((prev + cost).toFixed(2)));
      else setStarsBalance(prev => Number((prev + cost).toFixed(2)));
      setGameState(GameState.IDLE);
      isSpinningRef.current = false;
    }
  }, [userId, balance, starsBalance, bet, gameState, currency, isActive, isMuted, theme, rows, cols, setBalance, setStarsBalance, onTransaction, playReelAnimation]);

  return {
    grid, gameState, winData, bonusSpins, bonusTotal,
    spinningColumns, bonusEffects, activeSpecialCells, stickyPlanes,
    handleSpin, handleBuyBonus
  };
};
