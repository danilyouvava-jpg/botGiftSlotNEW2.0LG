import React from 'react';
import { SymbolType, CoinType } from './types';
import { Shield, Bot, Star, Zap, Hexagon, Gem } from 'lucide-react';

export type ThemeId = 'durov' | 'flour' | 'obeziana';

export const THEME_IMAGES: Record<ThemeId, Record<string, string>> = {
  durov: {
    [SymbolType.PLANE]: '/dogtg.png',
    [SymbolType.LOCK]: '/knopka.png',
    [SymbolType.SHIELD]: '/futbolka.png',
    [SymbolType.BOT]: '/kepka.svg',
    [SymbolType.STAR]: '/rukzak.svg',
    [SymbolType.GIFT]: '/morozenoi.png',
    [SymbolType.DIAMOND]: '/kerpuch.svg',
    [SymbolType.HASH]: '/obuv.png',
    [SymbolType.NUM]: '/ohcki.png',
    [SymbolType.WILD]: '/download_4.4400000000003885.svg',
    'COIN_STRIP': '/moneta.svg',
    'ANIMATION_PLANE': '/chpic.su_-_Gift_NFT_005.tgs',
    'ANIMATION_WILD': '/sozdatel.tgs'
  },
  flour: {
    [SymbolType.PLANE]: '/rediska.svg',
    [SymbolType.LOCK]: '/siran.svg',
    [SymbolType.SHIELD]: '/podsolnuxNEW.png',
    [SymbolType.BOT]: '/kuvsinNEW.png',
    [SymbolType.STAR]: '/romashkaNEW.png',
    [SymbolType.GIFT]: '/kusaka_0.svg',
    [SymbolType.DIAMOND]: '/kaktus.png',
    [SymbolType.HASH]: '/flourtiporosi.svg',
    [SymbolType.NUM]: '/chtve0.svg',
    [SymbolType.WILD]: '/wildkusaka.png',
    'COIN_STRIP': '/coinflow.png',
    'ANIMATION_PLANE': '/rediska.tgs',
    'ANIMATION_WILD': '/chpic.su_-_Loving_Gift_by_EmojiRu_Bot_006.tgs'
  },
  obeziana: {
    // Reuse Durov images for now, but NO WILD functionality will be used
    [SymbolType.PLANE]: '/demonmakaka.svg',
    [SymbolType.LOCK]: '/knopka.png',
    [SymbolType.SHIELD]: '/mamamamakaka.png',
    [SymbolType.BOT]: '/bubamakaka.png',
    [SymbolType.STAR]: '/orangemakaka.png',
    [SymbolType.GIFT]: '/SONMAKAKA.png',
    [SymbolType.DIAMOND]: '/wolfmakaka.png',
    [SymbolType.HASH]: '/bamm.png',
    [SymbolType.NUM]: '/Yelolmakaka.png',
    [SymbolType.WILD]: '/download_4.4400000000003885.svg', // Fallback, won't appear
    'COIN_STRIP': '/moneta.svg',
    'ANIMATION_PLANE': '/demonanimmakaka.tgs',
    'ANIMATION_WILD': '/sozdatel.tgs'
  }
};

export const SYMBOL_CONFIG: Record<SymbolType, { color: string, icon?: React.ReactNode, imageUrl?: string, label?: string, multiplier: number }> = {
  // Low
  [SymbolType.PLANE]: { 
    color: '#5cabeb', 
    imageUrl: '/dogtg.png', 
    label: 'DogTG', 
    multiplier: 20.0 
  },
  [SymbolType.LOCK]: { 
    color: '#879099', 
    imageUrl: '/knopka.png', 
    label: 'Knopka', 
    multiplier: 10.0 
  },
  [SymbolType.SHIELD]: { 
    color: '#51b26c', 
    imageUrl: '/futbolka.png', 
    label: 'Futbolka', 
    multiplier: 1.0 
  },
  
  // Mid
  [SymbolType.BOT]: { 
    color: '#4cb4f7', 
    imageUrl: '/kepka.svg', 
    label: 'Kepka', 
    multiplier: 1.5 
  },
  [SymbolType.STAR]: { 
    color: '#9b51e0', 
    imageUrl: '/rukzak.svg', 
    label: 'Rukzak', 
    multiplier: 2.0 
  },
  [SymbolType.GIFT]: { 
    color: '#f4569e', 
    imageUrl: '/morozenoi.png', 
    label: 'Moroz', 
    multiplier: 2.5 
  },
  
  // High (NFTs)
  [SymbolType.DIAMOND]: { 
    color: '#0098ea', 
    imageUrl: '/kerpuch.svg', 
    label: 'Kerpuch', 
    multiplier: 4.0 
  },
  [SymbolType.HASH]: { 
    color: '#f2994a', 
    imageUrl: '/obuv.png', 
    label: 'Obuv', 
    multiplier: 0.7 
  },
  [SymbolType.NUM]: { 
    color: '#fbc531', 
    imageUrl: '/ohcki.png', 
    label: 'Ochki', 
    multiplier: 0.8 
  },
  
  // Specials
  [SymbolType.WILD]: { color: '#ffffff', imageUrl: '/download_4.4400000000003885.svg', label: 'WILD', multiplier: 0 },
  [SymbolType.COIN]: { color: '#0097EC', icon: <Hexagon />, label: 'TON', multiplier: 0 },
};

export const COIN_COLORS: Record<CoinType, string> = {
  [CoinType.STANDARD]: 'bg-[#0097EC] from-[#29b6f6] to-[#0086d1]', // TON Blue
  [CoinType.EXPAND]: 'bg-[#4caf50] from-[#66bb6a] to-[#388e3c]', // Green
  [CoinType.MULTIPLIER]: 'bg-[#e53935] from-[#ef5350] to-[#c62828]', // Red
  [CoinType.COLLECT]: 'bg-[#ffc107] from-[#ffca28] to-[#ff6f00]', // Gold
  [CoinType.MAGIC]: 'bg-[#9c27b0] from-[#ab47bc] to-[#7b1fa2]', // Purple
};

export const DUROV_WEIGHTS: { type: SymbolType; weight: number }[] = [
  // High Volatility: Rare but Big
  // Low weights for High Paying symbols
  { type: SymbolType.PLANE, weight: 3 },    // Very Rare (20x) (Reduced from 4)
  { type: SymbolType.LOCK, weight: 3 },     // Rare (10x) (Reduced from 4)
  { type: SymbolType.SHIELD, weight: 120 }, // Common Filler (1x) (Increased from 100)
  { type: SymbolType.BOT, weight: 100 },    // Common Filler (1.5x) (Increased from 80)
  { type: SymbolType.STAR, weight: 50 },    // Mid (2x) (Reduced from 60)
  { type: SymbolType.GIFT, weight: 8 },     // Rare (2.5x) (Reduced from 10)
  { type: SymbolType.DIAMOND, weight: 6 },  // Rare (4x) (Reduced from 8)
  { type: SymbolType.HASH, weight: 120 },   // Common Filler (0.7x) (Increased from 100)
  { type: SymbolType.NUM, weight: 120 },    // Common Filler (0.8x) (Increased from 100)
  { type: SymbolType.WILD, weight: 4 },     // Very Rare (Connects everything) (Reduced from 5)
  { type: SymbolType.COIN, weight: 8 },     // Rare Bonus (Reduced from 10)
];

export const FLOUR_WEIGHTS: { type: SymbolType; weight: number }[] = [
  // Low Volatility: Frequent but Small
  // High weights for Low Paying symbols and Wilds (Connections)
  { type: SymbolType.PLANE, weight: 2 },    // Very Rare High (Reduced from 4)
  { type: SymbolType.LOCK, weight: 2 },     // Very Rare High (Reduced from 4)
  { type: SymbolType.SHIELD, weight: 90 },  // Common Filler (1x) (Increased from 70)
  { type: SymbolType.BOT, weight: 90 },     // Common Filler (1.5x) (Increased from 70)
  { type: SymbolType.STAR, weight: 30 },    // Less Frequent (2x) (Reduced from 40)
  { type: SymbolType.GIFT, weight: 20 },    // Less Frequent (2.5x) (Reduced from 30)
  { type: SymbolType.DIAMOND, weight: 8 },  // Rare (4x) (Reduced from 15)
  { type: SymbolType.HASH, weight: 90 },    // Common Filler (0.7x) (Increased from 70)
  { type: SymbolType.NUM, weight: 90 },     // Common Filler (0.8x) (Increased from 70)
  { type: SymbolType.WILD, weight: 25 },    // Less Frequent Wilds (Reduced from 50)
  { type: SymbolType.COIN, weight: 15 },    // Less Frequent Bonus (Reduced from 25)
];

export const OBEZIANA_WEIGHTS: { type: SymbolType; weight: number }[] = [
  // Medium Volatility: Bonus Focused
  // Bonus (Plane) is the main goal
  { type: SymbolType.PLANE, weight: 4 },    // Achievable Bonus (Reduced from 5)
  // No LOCK
  { type: SymbolType.SHIELD, weight: 80 },  // Standard (Increased from 70)
  { type: SymbolType.BOT, weight: 60 },     // Standard (Increased from 50)
  { type: SymbolType.STAR, weight: 35 },    // Standard (Reduced from 40)
  { type: SymbolType.GIFT, weight: 20 },    // Standard (Reduced from 25)
  { type: SymbolType.DIAMOND, weight: 8 },  // Rare High (Reduced from 10)
  { type: SymbolType.HASH, weight: 100 },   // Filler (Increased from 90)
  { type: SymbolType.NUM, weight: 100 },    // Filler (Increased from 90)
  // No WILD, No COIN
];

export const BONUS_WEIGHTS: { type: SymbolType; weight: number }[] = [
  { type: SymbolType.EMPTY, weight: 300 }, // Increased empty space for bonus
  { type: SymbolType.COIN, weight: 10 },
];