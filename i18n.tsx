import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Lang = 'ru' | 'en';

type Dict = Record<string, string>;

const translations: Record<Lang, Dict> = {
  ru: {
    // Header / App
    total_balance: 'Общий баланс',
    bet: 'Ставка',
    win: 'Выигрыш',
    wait: 'Ждите...',
    spin: 'КРУТИТЬ',
    bet_amount: 'Сумма ставки',
    bet_locked: 'Ставка заблокирована',
    lang_switch_title: 'Сменить язык',
    // InfoModal
    rules_title: 'Правила и Выплаты',
    how_to_play: 'Как играть',
    obez_goal: '<strong>Цель:</strong> Соберите 3 одинаковых обезьяны в ряд, чтобы получить выигрыш.',
    obez_field: '<strong>Поле:</strong> Компактное поле 3x3 — идеально для быстрых побед.',
    obez_symbols: '<strong>Символы:</strong> Каждая обезьяна имеет свою ценность. Чем реже символ, тем больше награда!',
    obez_maxwin: '<strong>Максимальный выигрыш:</strong> Поймайте 3 Горячию Обезьяну и умножте ставку в <strong>x20</strong> раз!',
    obez_strategy: '<strong>Стратегия:</strong> Играйте чаще — мелкие выигрыши выпадают постоянно, поддерживая баланс.',
    rules_line: 'Соберите 3, 4 или 5 символов на линии для выигрыша.',
    rules_ltr: 'Линии оплачиваются слева направо.',
    rules_coins: '5+ Монет запускают Бонусную Игру.',
    rules_wild: 'WILD заменяет любой символ, кроме Бонусных Монет.',
    paytable: 'Таблица Выплат',
    wild_expand: 'Расширяется на 2 клетки',
    wild_replace: 'Заменяет символы',
    features: 'Особенности',
    bonus_game_title: 'Бонусная Игра',
    bonus_game_desc: 'Поймайте 5 или больше Монет, чтобы запустить бонус Hold & Win. Начните с 3 спинов. Каждая новая монета сбрасывает счетчик спинов до 3.',
    bonus_end: 'В конце вы забираете сумму всех монет!',
    red_coins: 'Красные Монеты (X): Умножают случайную монету на x2 или x3.',
    yellow_coins: 'Желтые Монеты (SUM): Собирают сумму всех видимых монет.',
    expanding_wild: 'Расширяющийся Wild',
    expanding_wild_desc: 'В этой теме WILD символ расширяется вертикально, занимая 2 клетки, что увеличивает шансы на победу!',
    win_multipliers: 'Множители Выигрыша',
    win_multipliers_desc: 'Соберите 4 символа для множителя выигрыша x2. Соберите 5 символов для множителя x5!',
    // DepositModal
    deposit_success: 'Пополнение успешно!\nВаш баланс обновлен.',
    withdraw_success: 'Заявка отправлена!\nЗвезды скоро появятся на вашем счете в Gift подарке.',
    promo_success: 'Промокод активирован!',
    error: 'Ошибка',
    wallet: 'Кошелек',
    deposit_tab: 'Пополнение',
    withdraw_tab: 'Вывод',
    promo_tab: 'Промо',
    enter_amount: 'Введите сумму',
    pay: 'Оплатить',
    enter_withdraw_amount: 'Введите сумму вывода',
    min_withdraw: 'Минимальный вывод: 500 звезд',
    withdraw_btn: 'Вывести',
    promo_title: 'Активация промокода',
    promo_hint: 'Введите промокод, чтобы получить бонусные звезды на счет.',
    enter_promo: 'Введите промокод',
    activate: 'Активировать',
    // DailyRouletteModal
    roulette_title: 'Ежедневная рулетка',
    credited: 'Начислено на баланс!',
    spinning: 'Крутится...',
    available_in: 'Доступно через',
    time_left: '{h}ч {m}м',
    // ReferralModal
    referral_title: 'Реферальная система',
    invited: 'Приглашено',
    earned: 'Заработано',
    referral_hint: 'Приглашай друзей и получай <b>2 ⭐</b> за каждого!',
    invite_friend: 'Пригласить друга',
    // BonusOverlay / GameGrid
    spins: 'Спины',
    bonus: 'Бонус',
    big_win: 'Большой Выигрыш',
    bonus_collected: 'Бонус Собран',
  },
  en: {
    // Header / App
    total_balance: 'Total balance',
    bet: 'Bet',
    win: 'Win',
    wait: 'Wait...',
    spin: 'SPIN',
    bet_amount: 'Bet amount',
    bet_locked: 'Bet locked',
    lang_switch_title: 'Change language',
    // InfoModal
    rules_title: 'Rules & Payouts',
    how_to_play: 'How to play',
    obez_goal: '<strong>Goal:</strong> Collect 3 matching monkeys in a row to win.',
    obez_field: '<strong>Field:</strong> Compact 3x3 grid — perfect for quick wins.',
    obez_symbols: '<strong>Symbols:</strong> Each monkey has its own value. The rarer the symbol, the bigger the reward!',
    obez_maxwin: '<strong>Max win:</strong> Catch 3 Hot Monkey and multiply your bet by <strong>x20</strong>!',
    obez_strategy: '<strong>Strategy:</strong> Play often — small wins drop constantly, keeping your balance up.',
    rules_line: 'Collect 3, 4 or 5 symbols on a line to win.',
    rules_ltr: 'Lines pay left to right.',
    rules_coins: '5+ Coins trigger the Bonus Game.',
    rules_wild: 'WILD substitutes any symbol except Bonus Coins.',
    paytable: 'Paytable',
    wild_expand: 'Expands to 2 cells',
    wild_replace: 'Substitutes symbols',
    features: 'Features',
    bonus_game_title: 'Bonus Game',
    bonus_game_desc: 'Catch 5 or more Coins to trigger the Hold & Win bonus. Start with 3 spins. Each new coin resets the spin counter to 3.',
    bonus_end: 'At the end you collect the sum of all coins!',
    red_coins: 'Red Coins (X): Multiply a random coin by x2 or x3.',
    yellow_coins: 'Yellow Coins (SUM): Collect the sum of all visible coins.',
    expanding_wild: 'Expanding Wild',
    expanding_wild_desc: 'In this theme the WILD symbol expands vertically, covering 2 cells and boosting your chances to win!',
    win_multipliers: 'Win Multipliers',
    win_multipliers_desc: 'Collect 4 symbols for a x2 win multiplier. Collect 5 symbols for a x5 multiplier!',
    // DepositModal
    deposit_success: 'Deposit successful!\nYour balance has been updated.',
    withdraw_success: 'Request sent!\nStars will appear in your Gift account soon.',
    promo_success: 'Promo code activated!',
    error: 'Error',
    wallet: 'Wallet',
    deposit_tab: 'Deposit',
    withdraw_tab: 'Withdraw',
    promo_tab: 'Promo',
    enter_amount: 'Enter amount',
    pay: 'Pay',
    enter_withdraw_amount: 'Enter withdrawal amount',
    min_withdraw: 'Minimum withdrawal: 500 stars',
    withdraw_btn: 'Withdraw',
    promo_title: 'Promo code activation',
    promo_hint: 'Enter a promo code to get bonus stars on your balance.',
    enter_promo: 'Enter promo code',
    activate: 'Activate',
    // DailyRouletteModal
    roulette_title: 'Daily roulette',
    credited: 'Credited to balance!',
    spinning: 'Spinning...',
    available_in: 'Available in',
    time_left: '{h}h {m}m',
    // ReferralModal
    referral_title: 'Referral system',
    invited: 'Invited',
    earned: 'Earned',
    referral_hint: 'Invite friends and get <b>2 ⭐</b> for each!',
    invite_friend: 'Invite a friend',
    // BonusOverlay / GameGrid
    spins: 'Spins',
    bonus: 'Bonus',
    big_win: 'Big Win',
    bonus_collected: 'Bonus Collected',
  }
};

function detectInitialLang(): Lang {
  try {
    const saved = localStorage.getItem('giftslot_lang');
    if (saved === 'ru' || saved === 'en') return saved;
  } catch { }
  try {
    const code = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    if (typeof code === 'string' && code.toLowerCase().startsWith('en')) return 'en';
  } catch { }
  return 'ru';
}

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'ru',
  setLang: () => { },
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('giftslot_lang', l); } catch { }
    try { document.documentElement.lang = l; } catch { }
  };

  useEffect(() => {
    try { document.documentElement.lang = lang; } catch { }
  }, [lang]);

  const t = (key: string) => translations[lang][key] ?? key;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
