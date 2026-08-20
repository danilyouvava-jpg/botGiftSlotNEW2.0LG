import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift } from 'lucide-react';
import { useI18n } from '../i18n';

function authHeaders(): Record<string, string> {
    try {
        const initData = (window as any).Telegram?.WebApp?.initData;
        return initData ? { 'x-telegram-initdata': initData } : {};
    } catch { return {}; }
}

interface DailyRouletteModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: number | null;
    onWin?: (amount: number) => void;
}

// Segments with prizes - winnable and display-only
const ROULETTE_SEGMENTS = [
    { value: 1, color: '#374151', winnable: true },
    { value: 5, color: '#4b5563', winnable: false },
    { value: 1.5, color: '#374151', winnable: true },
    { value: 10, color: '#4b5563', winnable: false },
    { value: 2, color: '#374151', winnable: true },
    { value: 20, color: '#4b5563', winnable: false },
    { value: 1, color: '#374151', winnable: true },
    { value: 25, color: '#4b5563', winnable: false },
    { value: 0, color: '#374151', winnable: false, image: '/misaka.png' },
];

// Indices of winnable segments
const WINNABLE_INDICES = [0, 2, 4, 6];
const SEGMENT_COUNT = ROULETTE_SEGMENTS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

export default function DailyRouletteModal({ isOpen, onClose, userId, onWin }: DailyRouletteModalProps) {
    const { t } = useI18n();
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [wonPrize, setWonPrize] = useState<number | null>(null);
    const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [canSpin, setCanSpin] = useState(true);
    const [nextSpinTime, setNextSpinTime] = useState<number>(0);
    const [timeLeft, setTimeLeft] = useState<string>("");

    // Reset state & check status when modal opens
    useEffect(() => {
        if (!isOpen) {
            setWonPrize(null);
            setIsSpinning(false);
            if (spinTimeoutRef.current) {
                clearTimeout(spinTimeoutRef.current);
            }
        } else if (userId) {
            fetch(`/api/roulette/status/${userId}`, { headers: authHeaders() })
                .then(res => res.json())
                .then(data => {
                    setCanSpin(data.canSpin);
                    setNextSpinTime(data.nextSpinTime || 0);
                })
                .catch(err => console.error("Error fetching roulette status:", err));
        }
    }, [isOpen, userId]);

    // Timer effect
    useEffect(() => {
        if (canSpin || nextSpinTime === 0) {
            setTimeLeft("");
            return;
        }

        const updateTimer = () => {
            const now = Date.now();
            const diff = nextSpinTime - now;

            if (diff <= 0) {
                setCanSpin(true);
                setNextSpinTime(0);
                setTimeLeft("");
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setTimeLeft(t('time_left').replace('{h}', String(hours)).replace('{m}', String(minutes).padStart(2, '0')));
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000); // Update every minute is enough for hours/mins

        return () => clearInterval(interval);
    }, [canSpin, nextSpinTime, t]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (spinTimeoutRef.current) {
                clearTimeout(spinTimeoutRef.current);
            }
        };
    }, []);

    const handleSpin = async () => {
        if (isSpinning || !userId || !canSpin) return;

        setIsSpinning(true);
        setWonPrize(null);

        // Pick a random winnable segment index
        const winningIndex = WINNABLE_INDICES[Math.floor(Math.random() * WINNABLE_INDICES.length)];
        const prize = ROULETTE_SEGMENTS[winningIndex].value;

        // Calculate rotation to land on winning segment
        // Pointer is at TOP (0 degrees)
        // Segment N center is at: N * SEGMENT_ANGLE + SEGMENT_ANGLE/2
        // To put segment N at top, we need to rotate wheel so that segment center is at 0 degrees
        // Target Absolute Angle: 360 - (N * SEGMENT_ANGLE + SEGMENT_ANGLE/2)

        const segmentCenterAngle = winningIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
        const targetAngle = 360 - segmentCenterAngle;

        // Calculate adjustments
        const currentAngle = rotation % 360;
        let angleDelta = targetAngle - currentAngle;

        // Ensure strictly positive rotation (clockwise)
        if (angleDelta <= 0) {
            angleDelta += 360;
        }

        // Add random offset within segment (but stay within segment bounds)
        // Max offset: +/- 0.35 * SEGMENT_ANGLE
        const maxOffset = SEGMENT_ANGLE * 0.35;
        const randomOffset = (Math.random() - 0.5) * maxOffset * 2;

        // Add 5-7 full spins
        const fullSpins = 5 + Math.floor(Math.random() * 3);
        const totalRotation = fullSpins * 360 + angleDelta + randomOffset;

        const newRotation = rotation + totalRotation;
        setRotation(newRotation);

        // Wait for spin to complete, then give prize
        spinTimeoutRef.current = setTimeout(async () => {
            setIsSpinning(false);
            setWonPrize(prize);

            // Call API to add prize to balance
            try {
                const response = await fetch('/api/roulette/claim', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ userId, amount: prize })
                });
                const data = await response.json();
                if (data.success && onWin) {
                    onWin(prize);
                    setCanSpin(false);
                    setNextSpinTime(Date.now() + 5 * 60 * 60 * 1000);
                } else if (!data.success && data.remainingMs) {
                    setCanSpin(false);
                    setNextSpinTime(Date.now() + data.remainingMs);
                }
            } catch (error) {
                console.error('Failed to claim roulette prize:', error);
            }
        }, 4000);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
className="ios-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={onClose}
              >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="ios-modal w-full max-w-md overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="ios-modal-header">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Gift className="text-white/60" size={22} />
                            {t('roulette_title')}
                        </h2>
                        <button
                            onClick={onClose}
                            className="ios-icon-btn"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Roulette Wheel */}
                    <div className="p-6 flex flex-col items-center">
                        {/* Wheel Container */}
                        <div className="relative w-64 h-64 mb-6">
                            {/* Pointer */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
                                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-gray-400 drop-shadow-lg" />
                            </div>

                            {/* Wheel */}
                            <motion.div
                                className="w-full h-full rounded-full relative overflow-hidden shadow-2xl border-4 border-white/10"
                                animate={{ rotate: rotation }}
                                transition={{
                                    duration: isSpinning ? 4 : 0,
                                    ease: [0.17, 0.67, 0.12, 0.99]
                                }}
                            >
                                <svg viewBox="0 0 100 100" className="w-full h-full">
                                    {ROULETTE_SEGMENTS.map((segment, index) => {
                                        const startAngle = index * SEGMENT_ANGLE;
                                        const endAngle = (index + 1) * SEGMENT_ANGLE;
                                        const startRad = (startAngle - 90) * Math.PI / 180;
                                        const endRad = (endAngle - 90) * Math.PI / 180;

                                        const x1 = 50 + 50 * Math.cos(startRad);
                                        const y1 = 50 + 50 * Math.sin(startRad);
                                        const x2 = 50 + 50 * Math.cos(endRad);
                                        const y2 = 50 + 50 * Math.sin(endRad);

                                        const largeArc = SEGMENT_ANGLE > 180 ? 1 : 0;

                                        // Position for star image
                                        const midAngle = (startAngle + endAngle) / 2 - 90;
                                        const midRad = midAngle * Math.PI / 180;
                                        
                                        // Center position for custom image
                                        const centerX = 50 + 35 * Math.cos(midRad);
                                        const centerY = 50 + 35 * Math.sin(midRad);

                                        const imgX = 50 + 28 * Math.cos(midRad);
                                        const imgY = 50 + 28 * Math.sin(midRad);

                                        // Position for number
                                        const numX = 50 + 38 * Math.cos(midRad);
                                        const numY = 50 + 38 * Math.sin(midRad);

                                        return (
                                            <g key={index}>
                                                <path
                                                    d={`M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                                    fill={segment.color}
                                                    stroke="#17212b"
                                                    strokeWidth="0.5"
                                                />
                                                {/* @ts-ignore */}
                                                {segment.image ? (
                                                    <image
                                                        // @ts-ignore
                                                        href={segment.image}
                                                        x={centerX - 10}
                                                        y={centerY - 10}
                                                        width="20"
                                                        height="20"
                                                        transform={`rotate(${(startAngle + endAngle) / 2}, ${centerX}, ${centerY})`}
                                                    />
                                                ) : (
                                                    <>
                                                        {/* Star image */}
                                                        <image
                                                            href="/stars.png"
                                                            x={imgX - 6}
                                                            y={imgY - 6}
                                                            width="12"
                                                            height="12"
                                                            transform={`rotate(${(startAngle + endAngle) / 2}, ${imgX}, ${imgY})`}
                                                        />
                                                        {/* Number */}
                                                        <text
                                                            x={numX}
                                                            y={numY}
                                                            fill="white"
                                                            fontSize="4"
                                                            fontWeight="bold"
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                            transform={`rotate(${(startAngle + endAngle) / 2}, ${numX}, ${numY})`}
                                                        >
                                                            {segment.value}
                                                        </text>
                                                    </>
                                                )}
                                            </g>
                                        );
                                    })}
                                    {/* Center circle */}
                                    <circle cx="50" cy="50" r="8" fill="#17212b" stroke="#374151" strokeWidth="2" />
                                </svg>
                            </motion.div>
                        </div>

                        {/* Won Prize Display */}
                        {wonPrize !== null && (
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="mb-4 text-center"
                            >
                                <div className="text-yellow-400 text-2xl font-bold flex items-center justify-center gap-2">
                                    +{wonPrize} <img src="/stars.png" alt="stars" className="w-10 h-10 object-contain" />
                                </div>
                                <div className="text-gray-400 text-sm">{t('credited')}</div>
                            </motion.div>
                        )}

                        <button
                            onClick={handleSpin}
                            disabled={isSpinning || !canSpin}
                            className="ios-btn ios-btn-primary w-full py-4 text-lg"
                        >
                            {isSpinning ? t('spinning') : !canSpin ? `${t('available_in')} ${timeLeft || '...'}` : t('spin')}
                        </button>
                    </div>

                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
