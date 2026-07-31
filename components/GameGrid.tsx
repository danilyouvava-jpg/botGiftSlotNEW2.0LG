import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SymbolData, GameState } from '../types';
import { ThemeId } from '../constants';
import BonusOverlay from './BonusOverlay';
import GameColumn from './GameColumn';

interface GameGridProps {
  grid: SymbolData[][];
  gameState: GameState;
  winData: { winAmount: number, winningLines: { row: number, col: number }[] } | null;
  bonusSpins: number;
  bonusTotal: number;
  spinningColumns: boolean[];
  bonusEffects: { id: string, from: {r: number, c: number}, to: {r: number, c: number}, type: 'red' | 'yellow' }[];
  activeSpecialCells: { r: number, c: number, type: 'red' | 'yellow' }[];
  currentTheme: ThemeId;
  currency: 'TON' | 'STARS';
}

const GameGrid: React.FC<GameGridProps> = ({
  grid,
  gameState,
  winData,
  bonusSpins,
  bonusTotal,
  spinningColumns,
  bonusEffects,
  activeSpecialCells,
  currentTheme,
  currency
}) => {
  const isBonus = gameState === GameState.BONUS_ACTIVE || gameState === GameState.BONUS_TRANSITION || gameState === GameState.BONUS_PAYOUT;
  
  const cols = grid[0]?.length || 5;
  const rows = grid.length || 4;

  const getGridColsClass = () => {
      if (cols === 3) return 'grid-cols-3';
      if (cols === 5) return 'grid-cols-5';
      return 'grid-cols-5'; // default
  };

  return (
    <div className={`relative p-3 rounded-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden ${currentTheme === 'flour' ? 'bg-[#52612D]' : currentTheme === 'obeziana' ? 'bg-[#393D2B]' : 'bg-[#17212b]'}`} style={{ contentVisibility: 'auto', contain: 'paint' }}>
      {/* Decorative Top Shine */}
      <div className="absolute top-0 left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

      {isBonus && <BonusOverlay spinsLeft={bonusSpins} totalWin={bonusTotal} />}
      
      {/* Effect Layer for Coin Animations */}
      <AnimatePresence>
        {bonusEffects.map(effect => {
            const colWidth = 100 / cols;
            const rowHeight = 100 / rows;
            const startX = `${effect.from.c * colWidth + colWidth/2}%`;
            const startY = `${effect.from.r * rowHeight + rowHeight/2}%`;
            const endX = `${effect.to.c * colWidth + colWidth/2}%`;
            const endY = `${effect.to.r * rowHeight + rowHeight/2}%`;

            return (
                <motion.div
                    key={effect.id}
                    initial={{ left: startX, top: startY, opacity: 1, scale: 1 }}
                    animate={{ left: endX, top: endY, opacity: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    className={`absolute w-6 h-6 rounded-full z-40 pointer-events-none shadow-[0_0_20px_currentColor] ${
                        effect.type === 'red' ? 'bg-red-500 text-red-500' : 'bg-yellow-400 text-yellow-400'
                    }`}
                >
                    <div className={`absolute inset-0 rounded-full blur-sm ${effect.type === 'red' ? 'bg-red-500' : 'bg-yellow-400'}`} />
                </motion.div>
            );
        })}
      </AnimatePresence>

      <div className={`grid ${getGridColsClass()} gap-2 md:gap-3`} style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}>
        {Array.from({ length: cols }).map((_, cIndex) => {
            // Pre-slice the column data
            const gridColumn = grid.map(row => row[cIndex]);
            
            return (
                <GameColumn 
                    key={cIndex}
                    cIndex={cIndex}
                    gridColumn={gridColumn}
                    winningLines={winData?.winningLines || []}
                    isSpinning={spinningColumns[cIndex]}
                    activeSpecialCells={activeSpecialCells}
                    theme={currentTheme}
                    isBonusMode={isBonus}
                />
            );
        })}
      </div>
      
      {/* Win Popup Overlay */}
      <AnimatePresence>
      {gameState === GameState.WIN_ANIMATION && (
        <motion.div 
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center"
        >
            <div className="bg-gradient-to-br from-yellow-500 to-orange-600 p-[2px] rounded-2xl shadow-[0_0_50px_rgba(255,165,0,0.6)]">
                <div className="bg-[#17212b] px-10 py-6 rounded-2xl flex flex-col items-center border border-white/10">
                    <span className="text-yellow-400 font-black uppercase text-2xl tracking-widest drop-shadow-md">Большой Выигрыш</span>
                    <span className="text-5xl font-bold text-white mt-2 drop-shadow-lg tracking-tighter">{winData?.winAmount.toFixed(2)}</span>
                </div>
            </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Bonus Payout Overlay */}
      <AnimatePresence>
      {gameState === GameState.BONUS_PAYOUT && (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-3xl"
        >
            <div className="text-center">
                <motion.div 
                    initial={{ scale: 0 }} animate={{ scale: 1 }} 
                    className="text-2xl font-bold text-white mb-2"
                >
                    Бонус Собран
                </motion.div>
                <motion.div 
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} delay={0.2}
                    className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 drop-shadow-lg"
                >
                    {bonusTotal.toFixed(2)}
                </motion.div>
                <div className="text-sm text-gray-400 mt-2">{currency === 'TON' ? 'TON COINS' : 'STARS'}</div>
            </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(GameGrid);
