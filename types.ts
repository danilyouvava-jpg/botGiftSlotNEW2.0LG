export enum SymbolType {
  // Low (Common UI icons)
  PLANE = 'PLANE', // Paper Plane
  LOCK = 'LOCK',   // Secret Chat
  SHIELD = 'SHIELD', // Proxy/Security
  
  // Mid (Features)
  BOT = 'BOT',
  STAR = 'STAR',   // Premium
  GIFT = 'GIFT',   // Gift/Giveaway
  
  // High (NFTs/Assets)
  DIAMOND = 'DIAMOND', // TON Gem
  HASH = 'HASH',       // Username (@)
  NUM = 'NUM',         // +888 Number
  
  // Special
  WILD = 'WILD',
  COIN = 'COIN'
}

export enum CoinType {
  STANDARD = 'STANDARD', // TON Blue
  EXPAND = 'EXPAND',     // Green
  MULTIPLIER = 'MULTIPLIER', // Red
  COLLECT = 'COLLECT',   // Gold
  MAGIC = 'MAGIC'        // Purple
}

export interface SymbolData {
  id: string;
  type: SymbolType;
  coinValue?: number;
  coinType?: CoinType;
  isLocked?: boolean;
}

export enum GameState {
  IDLE = 'IDLE',
  SPINNING = 'SPINNING',
  WIN_ANIMATION = 'WIN_ANIMATION',
  BONUS_TRANSITION = 'BONUS_TRANSITION',
  BONUS_ACTIVE = 'BONUS_ACTIVE',
  BONUS_PAYOUT = 'BONUS_PAYOUT'
}

export const ROWS = 4;
export const COLS = 5;