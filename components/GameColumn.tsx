import React from 'react';
import { SymbolData, SymbolType } from '../types';
import { ThemeId } from '../constants';
import SlotCell from './SlotCell';

interface GameColumnProps {
  cIndex: number;
  gridColumn: SymbolData[];
  winningLines: { row: number, col: number }[];
  isSpinning: boolean;
  activeSpecialCells: { r: number, c: number }[];
  theme: ThemeId;
  isBonusMode: boolean;
  // Passing the full grid row-by-row is expensive, so we pass just what we need or the full grid if unavoidable.
  // Ideally we passed pre-sliced column data.
  // For 'isUnderWild', we need to know if the cell ABOVE is a wild.
  // Since we are inside a column, cell [r-1] is just gridColumn[r-1].
  // So we don't need the full grid!
}

const GameColumn: React.FC<GameColumnProps> = ({
  cIndex,
  gridColumn,
  winningLines,
  isSpinning,
  activeSpecialCells,
  theme,
  isBonusMode
}) => {
  const rows = gridColumn.length;
  
  // Bounce animation when spinning stops
  const [isBouncing, setIsBouncing] = React.useState(false);
  const prevSpinning = React.useRef(isSpinning);

  React.useEffect(() => {
      if (prevSpinning.current && !isSpinning) {
          setIsBouncing(true);
          const timer = setTimeout(() => setIsBouncing(false), 400);
          return () => clearTimeout(timer);
      }
      prevSpinning.current = isSpinning;
  }, [isSpinning]);

  return (
    <div className={`flex flex-col gap-2 md:gap-3 ${isBouncing ? 'animate-bounceReel' : ''}`}>
      {gridColumn.map((cell, rIndex) => {
        const isWinning = winningLines.some(l => l.row === rIndex && l.col === cIndex);
        const isActiveSpecial = activeSpecialCells.some(c => c.r === rIndex && c.c === cIndex);
        
        // Check if cell above is Wild (for Flour theme expansion)
        // Since we have the column array, rIndex-1 gives the cell above in the same column.
        const isUnderWild = theme === 'flour' && rIndex > 0 && gridColumn[rIndex - 1].type === SymbolType.WILD;

        return (
          <div key={`${rIndex}-${cIndex}`} className="aspect-square relative" style={{ zIndex: rows - rIndex }}>
            <SlotCell 
              symbol={cell} 
              highlight={!!isWinning} 
              isBonusMode={isBonusMode}
              isSpinning={isSpinning}
              isActiveSpecial={isActiveSpecial}
              theme={theme}
              isUnderWild={isUnderWild}
            />
          </div>
        );
      })}
    </div>
  );
};

function arePropsEqual(prev: GameColumnProps, next: GameColumnProps) {
  // 1. Primitive props check
  if (
    prev.cIndex !== next.cIndex ||
    prev.isSpinning !== next.isSpinning ||
    prev.theme !== next.theme ||
    prev.isBonusMode !== next.isBonusMode
  ) {
    return false;
  }

  // 2. Winning Lines check (array of objects)
  // If lengths differ, changed.
  // If winningLines reference changed, we should check if it affects THIS column.
  // But strictly, winData changes only on win.
  // We can just check reference equality for simplicity, or shallow compare.
  // WinData is recreated on every win.
  if (prev.winningLines !== next.winningLines) {
     // Deep check if this specific column is affected?
     // Actually, just checking reference is usually fine if we memoize winData in parent.
     // But useGameEngine recreates it.
     // Let's do a quick length check and ref check.
     if (prev.winningLines.length !== next.winningLines.length) return false;
     // If lengths same, assume same for now or do full check?
     // Full check is safer.
     const prevRelated = prev.winningLines.filter(l => l.col === prev.cIndex);
     const nextRelated = next.winningLines.filter(l => l.col === next.cIndex);
     if (prevRelated.length !== nextRelated.length) return false;
     for(let i=0; i<prevRelated.length; i++) {
         if (prevRelated[i].row !== nextRelated[i].row) return false;
     }
  }

  // 3. Active Special Cells check
  if (prev.activeSpecialCells !== next.activeSpecialCells) {
     const prevRelated = prev.activeSpecialCells.filter(c => c.c === prev.cIndex);
     const nextRelated = next.activeSpecialCells.filter(c => c.c === next.cIndex);
     if (prevRelated.length !== nextRelated.length) return false;
     for(let i=0; i<prevRelated.length; i++) {
         if (prevRelated[i].r !== nextRelated[i].r) return false;
     }
  }

  // 4. Grid Column Data check (The most important one)
  // We compare the cell references in the array.
  if (prev.gridColumn.length !== next.gridColumn.length) return false;
  for (let i = 0; i < prev.gridColumn.length; i++) {
    if (prev.gridColumn[i] !== next.gridColumn[i]) {
        // If reference changed, it's a new cell.
        return false;
    }
  }

  return true;
}

export default React.memo(GameColumn, arePropsEqual);
