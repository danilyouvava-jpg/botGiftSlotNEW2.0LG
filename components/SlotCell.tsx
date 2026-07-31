import React, { useEffect, useState, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SymbolData, SymbolType, CoinType } from '../types';
import { SYMBOL_CONFIG, THEME_IMAGES, ThemeId } from '../constants';
import Lottie from 'lottie-react';
import pako from 'pako';

// Global cache for Lottie animations to prevent re-fetching/re-parsing
const lottieCache: Record<string, any> = {};
const pendingRequests: Record<string, Promise<any>> = {};

interface SlotCellProps {
  symbol: SymbolData;
  highlight: boolean;
  isBonusMode: boolean;
  isSpinning: boolean;
  isActiveSpecial?: boolean;
  theme: ThemeId;
  isUnderWild?: boolean;
}

const standardStrip: SymbolType[] = [
  SymbolType.HASH, SymbolType.NUM, SymbolType.STAR, SymbolType.DIAMOND, SymbolType.BOT, SymbolType.SHIELD, SymbolType.PLANE, SymbolType.GIFT
];
const bonusStrip: SymbolType[] = [
  SymbolType.COIN, SymbolType.EMPTY, SymbolType.COIN, SymbolType.EMPTY, SymbolType.COIN
];

// Helper component for spinning state to avoid hook conditional issues
const SpinningCell = React.memo(({ theme, isBonusMode }: { theme: ThemeId, isBonusMode: boolean }) => {
    // Only use basic symbols for spinning strip to reduce load
    // Remove heavy Lotties or complex components from here
    const stripSymbols = React.useMemo(() => {
        if (isBonusMode) return [SymbolType.COIN, SymbolType.EMPTY, SymbolType.COIN, SymbolType.EMPTY];
        // Only use static image symbols for the strip
        return [
            SymbolType.SHIELD, 
            SymbolType.BOT, 
            SymbolType.STAR, 
            SymbolType.DIAMOND, 
            SymbolType.HASH, 
            SymbolType.NUM
        ];
    }, [isBonusMode]);
    
    // Helper to get image URL (duplicated from main component to avoid prop drilling overkill)
    const getImageUrl = (type: SymbolType) => {
        return THEME_IMAGES[theme][type] || SYMBOL_CONFIG[type].imageUrl;
    };

    // Pre-calculate the rendered strip to avoid mapping on every render if props don't change
    const renderedStrip = React.useMemo(() => {
        // Reduced number of repeats for performance
        // We only need enough symbols to create the blur effect
        const simpleStrip = [SymbolType.SHIELD, SymbolType.HASH, SymbolType.BOT, SymbolType.NUM]; 
        
        return [...simpleStrip, ...simpleStrip].map((type, i) => {
            const conf = SYMBOL_CONFIG[type];
            if (!conf && type !== SymbolType.COIN) {
                 return <div key={i} className="h-full w-full aspect-square" />;
            }
            
            const imgUrl = type === SymbolType.COIN ? THEME_IMAGES[theme]['COIN_STRIP'] : getImageUrl(type);
            
            return (
                <div key={i} className="h-full w-full aspect-square flex items-center justify-center">
                     {imgUrl ? (
                         <img 
                            src={imgUrl} 
                            className={`${theme === 'obeziana' ? 'w-[85%] h-[85%]' : 'w-3/5 h-3/5'} object-contain transform scale-y-[1.2]`} 
                            alt="" 
                            decoding="async"
                            loading="eager" 
                            style={{ backfaceVisibility: 'hidden' }}
                         />
                     ) : (
                         <div style={{ color: conf.color }} className="scale-75">{conf.icon}</div>
                     )}
                </div>
            );
        });
    }, [theme, isBonusMode]);

    return (
      <div className={`w-full h-full rounded-xl ${theme === 'flour' ? 'bg-[#839843] border-black/5' : theme === 'obeziana' ? 'bg-[#7D8359] border-black/5' : 'bg-[#232e3c] border-white/5'} overflow-hidden relative transform-gpu`} style={{ willChange: 'transform', backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)', contain: 'strict', contentVisibility: 'auto' }}>
         <div className="flex flex-col w-full absolute top-0 left-0 animate-[spinReel_0.4s_linear_infinite] will-change-transform" style={{ backfaceVisibility: 'hidden', perspective: '1000px' }}>
            {renderedStrip}
         </div>
      </div>
    );
});

const SlotCell: React.FC<SlotCellProps> = React.memo(function SlotCell({ symbol, highlight, isBonusMode, isSpinning, isActiveSpecial, theme, isUnderWild }) {
  // OPTIMIZATION: If spinning, DO NOT render the complex cell content.
  // Just render the spinning strip overlay.
  // IMPORTANT: Do NOT spin if cell is locked (e.g. Obeziana sticky plane or Bonus coins)
  if (isSpinning && !symbol.isLocked) {
      return (
        <div className="w-full h-full relative" style={{ zIndex: 0 }}>
             <SpinningCell theme={theme} isBonusMode={isBonusMode} />
        </div>
      );
  }

  const [lottieData, setLottieData] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const config = SYMBOL_CONFIG[symbol.type];
  // If config is missing, we return null but hooks must have run already
  const shouldRender = !!config;

  // Handle Expansion for Flour Wild
  useEffect(() => {
    if (theme === 'flour' && symbol.type === SymbolType.WILD && !isSpinning) {
       const timer = setTimeout(() => {
           setIsExpanded(true);
       }, 2000); // Expand after 2s animation
       return () => clearTimeout(timer);
    } else {
        setIsExpanded(false);
    }
  }, [theme, symbol.type, isSpinning]);

  // Handle Hiding for cell under Wild
  useEffect(() => {
    if (isUnderWild && !isSpinning) {
      const timer = setTimeout(() => {
        setIsHidden(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setIsHidden(false);
    }
  }, [isUnderWild, isSpinning]);


  // Helper to get image URL based on theme
  const getImageUrl = (type: SymbolType) => {
    return THEME_IMAGES[theme][type] || SYMBOL_CONFIG[type].imageUrl;
  };

  useEffect(() => {
      let animationPath: string | null = null;
      if (symbol.type === SymbolType.PLANE) {
          animationPath = THEME_IMAGES[theme]['ANIMATION_PLANE'];
      } else if (symbol.type === SymbolType.WILD) {
          animationPath = THEME_IMAGES[theme]['ANIMATION_WILD'];
      }

      if (animationPath) {
          const cacheKey = `lottie:${animationPath}`;
          if (lottieCache[animationPath]) {
              setLottieData(lottieCache[animationPath]);
              return;
          }
          try {
              const cached = typeof window !== 'undefined' ? window.localStorage.getItem(cacheKey) : null;
              if (cached) {
                  const data = JSON.parse(cached);
                  lottieCache[animationPath] = data;
                  setLottieData(data);
                  return;
              }
          } catch {}

          if (!pendingRequests[animationPath]) {
              pendingRequests[animationPath] = fetch(animationPath)
                  .then(response => response.arrayBuffer())
                  .then(buffer => {
                      return new Promise<any>((resolve, reject) => {
                          const ric = (typeof window !== 'undefined' && (window as any).requestIdleCallback) ? (window as any).requestIdleCallback : (cb: any) => setTimeout(cb, 0);
                          ric(() => {
                              try {
                                  const json = JSON.parse(new TextDecoder().decode(pako.inflate(buffer)));
                                  lottieCache[animationPath!] = json;
                                  try { if (typeof window !== 'undefined') window.localStorage.setItem(cacheKey, JSON.stringify(json)); } catch {}
                                  resolve(json);
                              } catch (e) {
                                  reject(e);
                              } finally {
                                  delete pendingRequests[animationPath!];
                              }
                          });
                      });
                  });
          }

          let isMounted = true;
          pendingRequests[animationPath].then(json => {
              if (isMounted) startTransition(() => setLottieData(json));
          }).catch(() => {
             if (isMounted) startTransition(() => setLottieData(null));
          });
          
          return () => { isMounted = false; };
      } else {
          setLottieData(null);
      }
  }, [symbol.type, theme]);
  
  // Spinning State (Real Reel Animation) - Only for non-locked cells
  if (isSpinning && !symbol.isLocked) {
    // Generate a consistent random strip for this cell instance
    // We'll use a mix of symbols to simulate the "blur" of known items
    // useMemo must be at the top level in a real refactor, but here it's conditional return
    // HOWEVER, since isSpinning changes, this conditional return causes hook mismatch if we use hooks below.
    // We need to move all hooks to the top.
    // FORTUNATELY: We already moved useState/useEffect to top.
    // BUT: useMemo below is conditional. That is BAD.
    // Let's move useMemo up.
    return (
      <SpinningCell theme={theme} isBonusMode={isBonusMode} />
    );
  }

  // Handle Empty Slot (Bonus Mode)
  if (symbol.type === SymbolType.EMPTY) {
      return (
          <div className={`w-full h-full rounded-xl ${theme === 'flour' ? 'bg-[#839843] border-black/5' : 'bg-[#232e3c] border-white/5'} shadow-sm`} />
      );
  }

  if (!shouldRender || !config) return null;

  if (isHidden) {
      return <div className="w-full h-full bg-transparent" />;
  }

  // Render Coin (TON Style)
  if (symbol.type === SymbolType.COIN) {
    return (
      <div className={`w-full h-full p-1.5 flex items-center justify-center`}>
        <div 
          className={`w-full h-full rounded-full flex flex-col items-center justify-center text-white relative group overflow-hidden transition-all duration-300 ${isActiveSpecial ? 'z-20 scale-110' : ''}`}
          style={{
              boxShadow: isActiveSpecial 
                  ? (symbol.coinType === CoinType.MULTIPLIER ? "0 0 20px #ef4444" : "0 0 20px #eab308")
                  : "0 4px 12px rgba(0,0,0,0.4)"
          }}
        >
          {/* Active Glow Overlay - Simplified */}
          {isActiveSpecial && (
              <div 
                  className={`absolute inset-0 z-10 mix-blend-overlay animate-pulse ${
                      symbol.coinType === CoinType.MULTIPLIER ? 'bg-red-400' : 'bg-yellow-400'
                  }`}
              />
          )}

          {/* Image Background */}
          <img src={THEME_IMAGES[theme]['COIN_STRIP']} className="absolute inset-0 w-full h-full object-cover" alt="coin" />
          
          {/* Type Tint Overlay */}
          {symbol.coinType === CoinType.MULTIPLIER && <div className="absolute inset-0 bg-red-500/40 mix-blend-multiply z-0" />}
          {symbol.coinType === CoinType.COLLECT && <div className="absolute inset-0 bg-yellow-500/40 mix-blend-multiply z-0" />}

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
            
            {(symbol.coinValue > 0 || symbol.coinType !== CoinType.COLLECT) && (
                <span 
                    className="text-sm sm:text-lg font-bold drop-shadow-md leading-none text-white bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-[2px]"
                >
                    {Number(symbol.coinValue).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
            )}
            
            {symbol.coinType !== CoinType.STANDARD && (
                <span className="absolute -bottom-3 text-[8px] font-bold bg-black/40 px-1.5 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-sm border border-white/10 text-white z-20">
                {symbol.coinType === CoinType.MULTIPLIER ? 'X' : 
                symbol.coinType === CoinType.COLLECT ? 'SUM' : 
                symbol.coinType?.substring(0,3)}
                </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // In bonus mode, standard symbols are dimmed placeholders
  if (isBonusMode && symbol.type !== SymbolType.COIN) {
    return (
        <div className="w-full h-full bg-[#121a24] rounded-xl border border-white/5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] flex items-center justify-center group">
            {/* Subtle empty slot indicator */}
            <div className="w-8 h-8 rounded-full border-2 border-dashed border-white/5 group-hover:border-white/10 transition-colors" />
        </div>
    );
  }

  // Render Standard Symbol (NFT / Sticker Style)
  const isHighValue = [SymbolType.DIAMOND, SymbolType.HASH, SymbolType.NUM, SymbolType.WILD].includes(symbol.type);

  // Locked/Sticky Visuals for Obeziana
  const isSticky = theme === 'obeziana' && symbol.isLocked && symbol.type === SymbolType.PLANE;

  return (
    <div className={`
        relative w-full h-full flex flex-col items-center justify-center rounded-xl transition-all duration-300 
        ${(isExpanded && theme === 'flour') ? 'overflow-visible z-50' : 'overflow-hidden'}
        ${isSticky ? 'border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)] bg-[#5a2e2e]' : ''}
        ${highlight 
            ? (theme === 'flour' 
                ? 'bg-[#617524] shadow-[0_0_15px_#617524] z-10 scale-[1.02] border border-[#839843]' 
                : theme === 'obeziana'
                    ? 'bg-[#8E9465] shadow-[0_0_15px_#8E9465] z-10 scale-[1.02] border border-[#A0A672]'
                    : 'bg-gradient-to-b from-[#2b5278] to-[#1e3a57] shadow-[0_0_15px_#5288c1] z-10 scale-[1.02] border border-[#5288c1]')
            : (theme === 'flour' ? 'bg-[#839843] border-black/5 shadow-sm hover:bg-[#9ab355]' : theme === 'obeziana' ? 'bg-[#7D8359] border-black/5 shadow-sm hover:bg-[#8E9465]' : 'bg-[#232e3c] border border-white/5 shadow-sm hover:bg-[#2c394b]')
        }
    `} style={{ 
        willChange: 'transform', 
        backfaceVisibility: 'hidden', 
        contain: (isExpanded && theme === 'flour') ? 'none' : 'strict', 
        contentVisibility: (isExpanded && theme === 'flour') ? 'visible' : 'auto' 
    }}>
      {!(isExpanded && theme === 'flour' && symbol.type === SymbolType.WILD) && (
      <div 
        style={{ color: config.color }} 
        className={`w-full h-full flex items-center justify-center transform transition-transform duration-300 ${highlight ? 'scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] animate-winPulse' : 'scale-100'}`}
      >
         {/* Icon or Image Container */}
         {(symbol.type === SymbolType.PLANE || symbol.type === SymbolType.WILD) && lottieData ? (
             <div className="w-4/5 h-4/5" style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}>
                <Lottie animationData={lottieData} loop={true} rendererSettings={{ preserveAspectRatio: 'xMidYMid meet', progressiveLoad: true }} />
             </div>
         ) : getImageUrl(symbol.type) ? (
          <img 
            src={getImageUrl(symbol.type)} 
            alt={config.label} 
            className={`${theme === 'obeziana' ? 'w-[95%] h-[95%]' : (theme === 'flour' && [SymbolType.GIFT, SymbolType.DIAMOND, SymbolType.NUM, SymbolType.STAR, SymbolType.BOT, SymbolType.SHIELD].includes(symbol.type)) ? 'w-[95%] h-[95%]' : 'w-4/5 h-4/5'} object-contain drop-shadow-lg ${highlight ? 'brightness-110' : ''}`}
            decoding="async"
          />
         ) : (
           React.cloneElement(config.icon as React.ReactElement, { 
               size: highlight ? 42 : 36, 
               strokeWidth: isHighValue ? 2.5 : 2,
               className: isHighValue ? "drop-shadow-lg" : ""
           })
         )}
      </div>
      )}
      
      {/* Label (like NFT name) */}
      {!isBonusMode && !(isExpanded && theme === 'flour' && symbol.type === SymbolType.WILD) && symbol.type === SymbolType.WILD && (
          <span className={`absolute bottom-1 text-[9px] font-bold uppercase tracking-wider ${highlight ? 'text-white' : 'text-[#707579] opacity-80'}`}>
            WILD
          </span>
      )}

      {/* Wild Effect */}
      {symbol.type === SymbolType.WILD && (
        <>
            {isExpanded && theme === 'flour' ? (
                 // Expanded Wild (Frame 13 Style)
                 <div 
                   className="absolute top-[-2px] left-[-4px] w-[calc(100%+8px)] h-[calc(200%+14px)] md:h-[calc(200%+18px)] z-50 flex flex-col items-start p-[22px_17px_14px_22px] rounded-[13px] overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.3)] bg-[#839843] border border-black/5"
                   style={{
                       backgroundImage: `url(${getImageUrl(symbol.type)})`,
                       backgroundPosition: 'center',
                       backgroundSize: 'cover',
                       backgroundRepeat: 'no-repeat',
                   }}
                 >
                    <div className="flex-grow w-full flex flex-col items-center justify-end pb-1">
                        <div className="flex items-center justify-center w-full bg-[#445d35bd] rounded-[5px] py-1 px-4">
                            <span className="text-white font-black text-2xl tracking-widest">WILD</span>
                        </div>
                    </div>
                 </div>
            ) : (
                <>
                <div className="absolute inset-0 rounded-xl border-2 border-yellow-400/50 animate-pulse pointer-events-none" />
                <div className="absolute inset-0 bg-yellow-400/5 rounded-full pointer-events-none" />
                </>
            )}
        </>
      )}

      {/* Sticky Effect for Obeziana */}
      {isSticky && (
          <div className="absolute inset-0 z-20 pointer-events-none">
              <div className="absolute inset-0 border-2 border-red-500 rounded-xl animate-pulse" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-[10px] text-white font-bold">L</span>
              </div>
          </div>
      )}
    </div>
  );
}, (prev, next) => {
  if (prev.theme !== next.theme) return false;
  if (prev.highlight !== next.highlight) return false;
  if (prev.isBonusMode !== next.isBonusMode) return false;
  if (prev.isSpinning !== next.isSpinning) return false;
  if ((prev.isActiveSpecial || false) !== (next.isActiveSpecial || false)) return false;
  if ((prev.isUnderWild || false) !== (next.isUnderWild || false)) return false;
  if (prev.symbol.type !== next.symbol.type) return false;
  if ((prev.symbol.isLocked || false) !== (next.symbol.isLocked || false)) return false;
  if ((prev.symbol.coinType || null) !== (next.symbol.coinType || null)) return false;
  if ((prev.symbol.coinValue || 0) !== (next.symbol.coinValue || 0)) return false;
  return true;
});

export default SlotCell;
