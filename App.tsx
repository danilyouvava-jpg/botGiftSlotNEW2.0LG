import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SymbolData, SymbolType, CoinType, GameState, ROWS, COLS } from './types';
import { ThemeId, THEME_IMAGES } from './constants';
import SlotCell from './components/SlotCell';
import BonusOverlay from './components/BonusOverlay';
import GameGrid from './components/GameGrid';
import InfoModal from './components/InfoModal';
import DepositModal from './components/DepositModal';
import ReferralModal from './components/ReferralModal';
import DailyRouletteModal from './components/DailyRouletteModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2, Wallet, X, Volume2, VolumeX, Settings, Info, Zap, Star, Plus, ChevronLeft, ChevronRight, Box, Users, Gift } from 'lucide-react';
import { useGameEngine } from './hooks/useGameEngine';
import pako from 'pako'; // For preloading Lotties if needed

function getTelegramInitData(): string | undefined {
    try {
        const tg = (window as any).Telegram?.WebApp;
        return tg?.initData || undefined;
    } catch {
        return undefined;
    }
}

function authHeaders(): Record<string, string> {
    const initData = getTelegramInitData();
    return initData ? { 'x-telegram-initdata': initData } : {};
}

// Configuration
const BET_VALUES = [0.1, 0.3, 0.5, 1, 1.5, 2, 2.5];
const STAR_BET_VALUES = [1, 5, 10, 25, 50];

// Global preloader cache to avoid re-running
const PRELOADED = {
    images: false,
    lotties: false
};

export default function App() {
    // Preload Images and Lotties
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. Preload Static Images
        if (!PRELOADED.images) {
            PRELOADED.images = true;
            const allThemes: ThemeId[] = ['durov', 'flour', 'obeziana'];
            const imagesToLoad: string[] = [];

            allThemes.forEach(t => {
                Object.values(THEME_IMAGES[t]).forEach(url => {
                    if (url && (url.endsWith('.png') || url.endsWith('.svg') || url.endsWith('.jpg'))) {
                        imagesToLoad.push(url);
                    }
                });
            });

            // Also preload Backgrounds
            imagesToLoad.push("/fonsik 2.png", "/makakaFON.png", "/fonflow.png", "/durovslot.png", "/flourslot.png", "/OBEZIANANANA.png");

            imagesToLoad.forEach(src => {
                const img = new Image();
                img.src = src;
                // Optional: img.decode()
                if (img.decode) {
                    img.decode().catch(() => { });
                }
            });
            console.log(`Preloading ${imagesToLoad.length} images...`);
        }

        // 2. Preload Lottie Animations (Fetch & Cache)
        // We can't parse them easily here without duplicating SlotCell logic, but we can FETCH them to disk cache.
        if (!PRELOADED.lotties) {
            PRELOADED.lotties = true;
            const lotties = [
                THEME_IMAGES['durov']['ANIMATION_PLANE'],
                THEME_IMAGES['durov']['ANIMATION_WILD'],
                THEME_IMAGES['flour']['ANIMATION_PLANE'],
                THEME_IMAGES['flour']['ANIMATION_WILD'],
                THEME_IMAGES['obeziana']['ANIMATION_PLANE'],
                THEME_IMAGES['obeziana']['ANIMATION_WILD'],
            ].filter(Boolean);

            lotties.forEach(url => {
                fetch(url).catch(() => { }); // Just fetch to populate browser cache
            });
        }

    }, []);

    useEffect(() => {
        const w = window as any;
        if (w.Telegram && w.Telegram.WebApp) {
            w.Telegram.WebApp.ready();
            try { w.Telegram.WebApp.expand(); } catch { }
            const tp = w.Telegram.WebApp.themeParams || {};
            if (tp.bg_color) document.documentElement.style.setProperty('--tg-bg', tp.bg_color);
            if (tp.text_color) document.documentElement.style.setProperty('--tg-text', tp.text_color);
            if (tp.secondary_bg_color) document.documentElement.style.setProperty('--tg-secondary', tp.secondary_bg_color);
            if (tp.button_color) document.documentElement.style.setProperty('--tg-accent', tp.button_color);

            const id = w.Telegram.WebApp.initDataUnsafe?.user?.id;
            if (id) {
                setUserId(id);

                fetch(`/api/balance/${id}`, { headers: authHeaders() })
                    .then(r => r.json())
                    .then(d => {
                        if (d.stars !== undefined) setStarsBalance(d.stars);
                    })
                    .catch(e => console.error('Failed to fetch balance', e));

                const startParam = w.Telegram.WebApp.initDataUnsafe?.start_param;
                if (typeof startParam === 'string' && startParam.startsWith('ref') && startParam.length > 3) {
                    fetch('/api/referral/activate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...authHeaders() },
                        body: JSON.stringify({ userId: id, referrerId: startParam.replace('ref', '') })
                    }).catch(e => console.error('Referral activate error', e));
                }
            } else {
                // DEV MODE: If no Telegram User, use Test ID but NO auto-stars
                // const TEST_ID = 123456;
                // setUserId(TEST_ID);
                // setStarsBalance(1000); 
                // console.log('Dev Mode: 1000 Stars added to Test User (DISABLED FOR PROD)');
            }
        } else {
            // Fallback for browser (outside Telegram)
            // const TEST_ID = 123456;
            // setUserId(TEST_ID);
            // setStarsBalance(1000);
            // console.log('Browser Dev Mode: 1000 Stars added');
        }
    }, []);
    const [currency, setCurrency] = useState<'TON' | 'STARS'>('STARS');
    const [currentTheme, setCurrentTheme] = useState<ThemeId>('durov');
    const [bgUrl, setBgUrl] = useState<string>("/fonsik 2.png");
    const [bgReady, setBgReady] = useState<boolean>(true);
    const [userId, setUserId] = useState<number | null>(null);
    const [isMuted, setIsMuted] = useState(false);

    const handleWithdraw = async (amount: number) => {
        if (!userId) return false;
        try {
            const tg = (window as any).Telegram?.WebApp;
            const username = tg?.initDataUnsafe?.user?.username || 'Unknown';

            const resp = await fetch('/api/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ userId, amount, username })
            });

            const data = await resp.json();
            if (data.success) {
                setStarsBalance(data.newBalance);
                return true;
            }
            return false;
        } catch (e) {
            console.error('Withdraw error', e);
            return false;
        }
    };

    const handleTransaction = (amount: number) => {
        if (!userId) return;
        fetch('/api/game/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ userId, amount })
        }).catch(e => console.error('Sync error', e));
    };

    // Shared balances
    const [balance, setBalance] = useState(0);
    const [starsBalance, setStarsBalance] = useState(0);

    const [bet, setBet] = useState(BET_VALUES[0]);
    const [showInfo, setShowInfo] = useState(false);
    const [showDeposit, setShowDeposit] = useState(false);
    const [showReferral, setShowReferral] = useState(false);
    const [showRoulette, setShowRoulette] = useState(false);

    const handleDeposit = async (amount: number, currencyType: 'TON' | 'STARS') => {
        if (currencyType === 'TON') {
            return false;
        }

        const tg = (window as any).Telegram?.WebApp;
        const userId = tg?.initDataUnsafe?.user?.id;

        if (!tg || !userId) {
            // If running in browser without Telegram, we can't process payment
            return false;
        }

        try {
            const resp = await fetch('/api/create-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ amount: Math.floor(amount), userId })
            });
            const data = await resp.json();
            if (!data?.link) return false;

            return await new Promise<boolean>((resolve) => {
                const handler = (payload: any) => {
                    tg.offEvent('invoiceClosed', handler);
                    if (payload?.status === 'paid') {
                        setStarsBalance(prev => prev + amount);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                };
                try { tg.onEvent('invoiceClosed', handler); } catch { }
                try { tg.openInvoice(data.link, (status: string) => { /* fallback */ }); } catch { }
            });
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const handleActivatePromo = async (code: string) => {
        if (!userId) return { success: false, message: 'User not found' };
        try {
            const resp = await fetch('/api/promocode/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ userId, code })
            });
            const data = await resp.json();
            if (data.success) {
                setStarsBalance(data.newBalance);
                return { success: true, message: 'Промокод активирован!', reward: data.reward };
            } else {
                return { success: false, message: data.error || 'Ошибка активации' };
            }
        } catch (e) {
            console.error('Promo activation error', e);
            return { success: false, message: 'Ошибка сети' };
        }
    };

    // Initialize Game Engines for each theme
    const durovEngine = useGameEngine({
        balance,
        setBalance,
        starsBalance,
        setStarsBalance,
        bet,
        currency,
        isActive: currentTheme === 'durov',
        theme: 'durov',
        onTransaction: handleTransaction,
        isMuted,
        userId
    });

    const flourEngine = useGameEngine({
        balance,
        setBalance,
        starsBalance,
        setStarsBalance,
        bet,
        currency,
        isActive: currentTheme === 'flour',
        theme: 'flour',
        onTransaction: handleTransaction,
        isMuted,
        userId
    });

    const obezianaEngine = useGameEngine({
        balance,
        setBalance,
        starsBalance,
        setStarsBalance,
        bet,
        currency,
        isActive: currentTheme === 'obeziana',
        theme: 'obeziana',
        onTransaction: handleTransaction,
        isMuted,
        userId,
        rows: 3,
        cols: 3
    });

    // Select active engine based on theme
    const activeEngine = currentTheme === 'durov' ? durovEngine :
        currentTheme === 'flour' ? flourEngine : obezianaEngine;

    const {
        grid,
        gameState,
        winData,
        bonusSpins,
        bonusTotal,
        spinningColumns,
        bonusEffects,
        activeSpecialCells,
        stickyPlanes,
        handleSpin,
        handleBuyBonus
    } = activeEngine;

    // Reset bet when currency changes
    useEffect(() => {
        setBet(currency === 'TON' ? BET_VALUES[0] : STAR_BET_VALUES[0]);
    }, [currency]);

    const currentBetValues = currency === 'TON' ? BET_VALUES : STAR_BET_VALUES;
    const currentBalance = currency === 'TON' ? balance : starsBalance;

    // New logic: Lock bet if there are sticky planes in Obeziana theme
    const hasStickyPlanes = currentTheme === 'obeziana' && stickyPlanes && stickyPlanes.some(p => p.life > 0);
    const isBetLocked = hasStickyPlanes;

    const increaseBet = () => {
        if (isBetLocked) return;
        const idx = currentBetValues.indexOf(bet);
        if (idx < currentBetValues.length - 1) setBet(currentBetValues[idx + 1]);
    };

    const decreaseBet = () => {
        if (isBetLocked) return;
        const idx = currentBetValues.indexOf(bet);
        if (idx > 0) setBet(currentBetValues[idx - 1]);
    };

    const isGameLocked = gameState === GameState.SPINNING || gameState === GameState.BONUS_TRANSITION || gameState === GameState.BONUS_ACTIVE || gameState === GameState.BONUS_PAYOUT;
    const isBonus = gameState === GameState.BONUS_ACTIVE || gameState === GameState.BONUS_TRANSITION || gameState === GameState.BONUS_PAYOUT;

    useEffect(() => {
        const nextUrl = currentTheme === 'durov' ? "/fonsik 2.png" : currentTheme === 'obeziana' ? "/makakaFON.png" : "/fonflow.png";
        const img = new Image();
        img.src = nextUrl;
        setBgReady(false);
        img.decode().then(() => {
            setBgUrl(nextUrl);
            setBgReady(true);
        }).catch(() => {
            setBgUrl(nextUrl);
            setBgReady(true);
        });
    }, [currentTheme]);

    return (
        <div className="min-h-screen flex flex-col md:flex-row text-white font-sans overflow-hidden">

            <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} theme={currentTheme} />
            <ReferralModal isOpen={showReferral} onClose={() => setShowReferral(false)} userId={userId} />
            <DailyRouletteModal
                isOpen={showRoulette}
                onClose={() => setShowRoulette(false)}
                userId={userId}
                onWin={(amount) => setStarsBalance(prev => prev + amount)}
            />
            <DepositModal
                isOpen={showDeposit}
                onClose={() => setShowDeposit(false)}
                onDeposit={handleDeposit}
                onWithdraw={handleWithdraw}
                onActivatePromo={handleActivatePromo}
                currentCurrency={currency}
            />

            {/* Sidebar (Desktop) / Header (Mobile) */}
            <div className={`w-full md:w-80 md:border-r border-white/5 flex flex-col z-20 shadow-xl ${currentTheme === 'flour' ? 'bg-[#132a13]' : currentTheme === 'obeziana' ? 'bg-[#363529]' : 'bg-[#17212b]'}`}>
                {/* Header */}
                <div className={`h-14 flex items-center justify-between px-4 border-b border-white/5 ${currentTheme === 'flour' ? 'bg-[#132a13]' : currentTheme === 'obeziana' ? 'bg-[#363529]' : 'bg-[#232e3c]'}`}>
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                            <span className="font-bold text-sm leading-tight">GIFT SLOT</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowReferral(true)}
                            className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-full flex items-center gap-1.5 transition-all shadow-lg shadow-blue-500/20"
                        >
                            <Users size={16} className="text-white" />
                            <span className="text-xs font-bold text-white">+2⭐</span>
                        </button>
                        <button
                            onClick={() => setShowRoulette(true)}
                            className="p-2 hover:bg-white/5 rounded-full"
                        >
                            <Gift size={18} className="text-gray-400" />
                        </button>
                        <button
                            className="p-2 hover:bg-white/5 rounded-full"
                            onClick={() => setIsMuted(!isMuted)}
                        >
                            {isMuted ? <VolumeX size={18} className="text-gray-400" /> : <Volume2 size={18} className="text-gray-400" />}
                        </button>
                        <button
                            onClick={() => setShowInfo(true)}
                            className="p-2 hover:bg-white/5 rounded-full"
                        >
                            <Info size={18} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Balance Card & Currency Switch */}
                <div className="p-4 flex flex-col gap-3">
                    {/* Currency Switcher Removed */}
                    <div className={`${currentTheme === 'flour' ? 'bg-[#31572c] border border-white/10' : currentTheme === 'obeziana' ? 'bg-[#363529] border border-white/10' : 'glass-panel'} p-4 rounded-2xl flex flex-col gap-1 relative overflow-hidden group`}>
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                            {currency === 'TON' ? <Wallet size={48} /> : <Star size={48} />}
                        </div>
                        <div className="flex justify-between items-start relative z-10">
                            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Общий баланс</span>
                            <button
                                onClick={() => setShowDeposit(true)}
                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${currency === 'TON' ? 'bg-blue-500 hover:bg-blue-400' : 'bg-yellow-500 hover:bg-yellow-400'}`}
                            >
                                <Plus size={14} className="text-white" />
                            </button>
                        </div>
                        <div className="flex items-end gap-1.5 relative z-10">
                            <span className="text-3xl font-bold tracking-tight">
                                {currency === 'TON' ? balance.toLocaleString() : starsBalance.toLocaleString()}
                            </span>
                            <span className={`font-bold mb-1 ${currency === 'TON' ? 'text-blue-400' : 'text-yellow-400'}`}>
                                {currency === 'TON' ? 'TON' : 'STARS'}
                            </span>
                        </div>
                    </div>
                </div>



                {/* Desktop Controls Spacer */}
                <div className="hidden md:flex flex-1 flex-col justify-between p-4 gap-4">
                    <div className="flex flex-col gap-4">
                        {/* Durov Slot Button */}
                        <button
                            onClick={() => !isGameLocked && !isBetLocked && setCurrentTheme('durov')}
                            disabled={isGameLocked || isBetLocked}
                            className={`w-full hover:scale-105 transition-transform duration-200 group ${currentTheme === 'durov' ? 'ring-2 ring-blue-500 rounded-xl' : ''} ${isGameLocked || isBetLocked ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                        >
                            <img src="/durovslot.png" alt="Durov Slot" className="w-full h-auto rounded-xl shadow-lg border border-white/10 group-hover:shadow-blue-500/20" />
                        </button>

                        {/* Flour Slot Button */}
                        <button
                            onClick={() => !isGameLocked && !isBetLocked && setCurrentTheme('flour')}
                            disabled={isGameLocked || isBetLocked}
                            className={`w-full hover:scale-105 transition-transform duration-200 group ${currentTheme === 'flour' ? 'ring-2 ring-blue-500 rounded-xl' : ''} ${isGameLocked || isBetLocked ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                        >
                            <img src="/flourslot.png" alt="Flour Slot" className="w-full h-auto rounded-xl shadow-lg border border-white/10 group-hover:shadow-blue-500/20" />
                        </button>

                        {/* Third Button */}
                        <button
                            onClick={() => !isGameLocked && !isBetLocked && setCurrentTheme('obeziana')}
                            disabled={isGameLocked || isBetLocked}
                            className={`w-full hover:scale-105 transition-transform duration-200 group ${currentTheme === 'obeziana' ? 'ring-2 ring-blue-500 rounded-xl' : ''} ${isGameLocked || isBetLocked ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                        >
                            <img src="/OBEZIANANANA.png" alt="Obeziana Slot" className="w-full h-auto rounded-xl shadow-lg border border-white/10 group-hover:shadow-blue-500/20" />
                        </button>
                    </div>


                </div>
            </div>

            {/* Main Game Stage */}
            <main
                className={`flex-1 relative flex flex-col items-center justify-center p-4 md:p-8 perspective-1000`}
            >
                {/* Animated Background */}
                <div className="absolute inset-0 z-0">
                    <AnimatePresence mode="popLayout">
                        <motion.div
                            key={bgUrl}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                            style={{
                                backgroundImage: bgReady ? `url('${bgUrl}')` : undefined,
                                willChange: 'opacity, transform',
                                backfaceVisibility: 'hidden',
                                contain: 'paint'
                            }}
                        />
                    </AnimatePresence>
                </div>

                {/* Background Atmosphere - Optimized with Radial Gradient instead of blur */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(59,130,246,0.15)_0%,transparent_70%)]" />
                </div>

                {/* Game Container */}
                <ErrorBoundary>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentTheme}
                            initial={{ x: 300, opacity: 0, rotateY: 90 }}
                            animate={{ x: 0, opacity: 1, rotateY: 0 }}
                            exit={{ x: -300, opacity: 0, rotateY: -90 }}
                            transition={{ duration: 0.5, type: "spring", damping: 20, stiffness: 100 }}
                            className="relative z-10 w-full max-w-lg md:max-w-2xl"
                            style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
                        >

                            {/* Header Info (Bet/Win) */}
                            <div className="flex justify-between items-center mb-4 px-2">
                                <div className="glass-panel px-4 py-1.5 rounded-full flex items-center gap-2">
                                    <span className="text-xs text-gray-400 uppercase">Ставка</span>
                                    <span className="font-bold text-white">{bet}</span>
                                </div>
                                <div className="glass-panel px-4 py-1.5 rounded-full flex items-center gap-2">
                                    <span className="text-xs text-gray-400 uppercase">Выигрыш</span>
                                    <span className="font-bold text-yellow-400">{winData ? winData.winAmount.toFixed(2) : '0.00'}</span>
                                </div>
                            </div>

                            {/* THE GRID */}
                            <GameGrid
                                grid={grid}
                                gameState={gameState}
                                winData={winData}
                                bonusSpins={bonusSpins}
                                bonusTotal={bonusTotal}
                                spinningColumns={spinningColumns}
                                bonusEffects={bonusEffects}
                                activeSpecialCells={activeSpecialCells}
                                currentTheme={currentTheme}
                                currency={currency}
                            />
                        </motion.div>
                    </AnimatePresence>
                </ErrorBoundary>
            </main>

            {/* Controls Bar (Mobile Bottom / Desktop Bottom Sticky) */}
            <div className={`${currentTheme === 'flour' ? 'bg-[#132a13]' : currentTheme === 'obeziana' ? 'bg-[#363529]' : 'bg-[#17212b]'} border-t border-white/5 p-4 z-30 md:hidden relative`}>

                {/* RTP Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow-sm">
                    <Box size={10} className="text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-300">RTP 97%</span>
                </div>

                {/* Mobile Theme Switcher */}
                <div className="flex items-center justify-between gap-2 mb-2">
                    <button
                        onClick={() => {
                            if (isGameLocked) return;
                            if (currentTheme === 'durov') setCurrentTheme('obeziana');
                            else if (currentTheme === 'flour') setCurrentTheme('durov');
                            else setCurrentTheme('flour');
                        }}
                        disabled={isGameLocked}
                        className="p-1 rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="flex-1 h-16 flex items-center justify-center relative bg-white/5 rounded-xl p-1 border border-white/5">
                        <AnimatePresence mode="wait">
                            <motion.img
                                key={currentTheme}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }}
                                src={currentTheme === 'durov' ? "/durovslot.png" : currentTheme === 'flour' ? "/flourslot.png" : "/OBEZIANANANA.png"}
                                alt="Theme Preview"
                                className="h-full w-full object-contain drop-shadow-lg pointer-events-none"
                            />
                        </AnimatePresence>
                    </div>

                    <button
                        onClick={() => {
                            if (isGameLocked) return;
                            if (currentTheme === 'durov') setCurrentTheme('flour');
                            else if (currentTheme === 'flour') setCurrentTheme('obeziana');
                            else setCurrentTheme('durov');
                        }}
                        disabled={isGameLocked}
                        className="p-1 rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Simple Mobile Controls - mirrored from sidebar logic but simplified */}
                <div className="flex gap-2">
                    <div className={`flex-1 ${currentTheme === 'obeziana' ? 'bg-[#2D2F23]' : 'glass-panel'} rounded-xl p-1 flex items-center justify-between px-2 relative`}>
                        {isBetLocked && (
                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded pointer-events-none whitespace-nowrap">
                                Ставка заблокирована
                            </div>
                        )}
                        <button onClick={decreaseBet} disabled={isGameLocked || isBetLocked || bet <= currentBetValues[0]} className="w-8 h-8 rounded bg-white/5 text-blue-400 font-bold disabled:opacity-50">-</button>
                        <span className={`font-bold text-sm ${isBetLocked ? 'text-gray-400' : 'text-white'}`}>{bet}</span>
                        <button onClick={increaseBet} disabled={isGameLocked || isBetLocked || bet >= currentBetValues[currentBetValues.length - 1]} className="w-8 h-8 rounded bg-white/5 text-blue-400 font-bold disabled:opacity-50">+</button>
                    </div>

                    {/* Buy Bonus Mobile */}
                    {/* <button
                    onClick={handleBuyBonus}
                    disabled={isGameLocked || currentBalance < Math.round(bet * 100)}
                    className={`
                        px-3 rounded-xl flex flex-col items-center justify-center shadow-lg transition-all
                        ${isGameLocked || currentBalance < Math.round(bet * 100)
                           ? 'bg-gray-700 text-gray-500' 
                           : 'bg-gradient-to-b from-yellow-500 to-yellow-700 text-white active:scale-95'
                        }
                    `}
                 >
                    <Zap size={16} fill="currentColor" />
                    <span className="text-[10px] font-bold leading-none mt-0.5">{Math.round(bet * 100)}</span>
                 </button> */}

                    <button
                        onClick={handleSpin}
                        disabled={isGameLocked}
                        className={`
                 flex-[1.5] h-12 rounded-xl text-lg font-bold transition-all shadow-lg
                 flex items-center justify-center gap-2
                 ${isGameLocked
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : currentTheme === 'obeziana'
                                    ? 'bg-[#74884F] text-white shadow-[#74884F]/30 active:scale-95'
                                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-500/30 active:scale-95'
                            }
               `}
                    >
                        {isGameLocked ? (
                            gameState === GameState.SPINNING ? <Loader2 className="animate-spin" /> : <span>Ждите...</span>
                        ) : (
                            'КРУТИТЬ'
                        )}
                    </button>
                </div>
            </div>

            {/* Floating Desktop Controls (Bottom Center) */}
            <div className="hidden md:flex absolute bottom-8 left-[62%] -translate-x-1/2 z-40 gap-6 items-center">
                {/* Bet Control */}
                <div className="glass-panel rounded-full p-2 flex items-center gap-4 px-6 shadow-2xl transform hover:scale-105 transition-transform">
                    <span className="text-gray-400 text-xs font-bold uppercase">Сумма ставки</span>
                    <div className="flex items-center gap-3">
                        <button onClick={decreaseBet} disabled={isGameLocked || bet <= currentBetValues[0]} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            -
                        </button>
                        <span className="text-xl font-bold min-w-[3ch] text-center">{bet}</span>
                        <button onClick={increaseBet} disabled={isGameLocked || bet >= currentBetValues[currentBetValues.length - 1]} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            +
                        </button>
                    </div>
                </div>

                {/* Buy Bonus Button Desktop */}
                {/* <button
                onClick={handleBuyBonus}
                disabled={isGameLocked || currentBalance < Math.round(bet * 100)}
                className={`
                    w-20 h-20 rounded-full font-bold text-xs transition-all shadow-xl border-2 border-[#17212b]
                    flex flex-col items-center justify-center gap-1 group relative overflow-hidden
                    ${isGameLocked || currentBalance < Math.round(bet * 100)
                       ? 'bg-gray-700 text-gray-500 grayscale' 
                       : 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white hover:shadow-[0_0_30px_#facc15] hover:scale-105 active:scale-95'
                    }
                `}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Zap size={24} fill="currentColor" className="drop-shadow-sm" />
                <div className="flex flex-col items-center leading-none">
                    <span className="font-black text-sm">КУПИТЬ</span>
                    <span className="text-[10px] opacity-90">{Math.round(bet * 100)}</span>
                </div>
            </button> */}

                {/* Spin Button */}
                <button
                    onClick={handleSpin}
                    disabled={isGameLocked}
                    className={`
                 w-24 h-24 rounded-full font-black text-xl tracking-wider transition-all shadow-[0_0_30px_rgba(0,0,0,0.5)] border-4 border-[#17212b]
                 flex items-center justify-center group relative overflow-hidden
                 ${isGameLocked
                            ? 'bg-gray-700 text-gray-500 grayscale'
                            : 'bg-gradient-to-br from-blue-400 to-blue-600 text-white hover:shadow-[0_0_50px_#5288c1] hover:scale-105 active:scale-95'
                        }
               `}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {gameState === GameState.SPINNING ? (
                        <Loader2 className="animate-spin" size={32} />
                    ) : (
                        <span className="group-hover:animate-pulse">КРУТИТЬ</span>
                    )}
                </button>

                {/* Auto/Max Buttons (Visual only for now) */}
                <div className="glass-panel rounded-full p-2 flex items-center gap-2 px-4 shadow-2xl">
                    <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={() => setShowInfo(true)}
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                    >
                        <Info size={18} />
                    </button>
                </div>
            </div>

        </div>
    );
}
