import React from 'react';
import { motion } from 'framer-motion';

interface BonusOverlayProps {
  spinsLeft: number;
  totalWin: number;
}

const BonusOverlay: React.FC<BonusOverlayProps> = ({ spinsLeft, totalWin }) => {
  return (
    <div className="absolute top-0 left-0 w-full h-12 flex justify-between items-center px-4 bg-gradient-to-b from-black/80 to-transparent z-20 pointer-events-none">
      <div className="flex flex-col">
         <span className="text-xs text-tg-hint uppercase font-bold">Спины</span>
         <div className="flex gap-1">
            {[1, 2, 3].map(i => (
                <motion.div 
                    key={i}
                    animate={{ opacity: i <= spinsLeft ? 1 : 0.2, scale: i <= spinsLeft ? 1 : 0.8 }}
                    className={`w-3 h-3 rounded-full ${i <= spinsLeft ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-gray-600'}`}
                />
            ))}
         </div>
      </div>
      
      <div className="flex flex-col items-end">
          <span className="text-xs text-tg-hint uppercase font-bold">Бонус</span>
          <span className="text-lg font-bold text-yellow-400 drop-shadow-sm">{totalWin.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default BonusOverlay;