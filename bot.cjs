const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Telegraf } = require('telegraf');

// --- Configuration Loading ---
let token = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
let CASINO_URL = (process.env.CASINO_URL || '').replace(/\/+$/, '');
let ADMIN_ID = '7119839001';
let BOT_USERNAME = '';

// Skip .env loading in production (Railway sets env vars automatically)
if ((!token || !CASINO_URL) && process.env.NODE_ENV !== 'production') {
    try {
        const env = fs.readFileSync('.env', 'utf8');
        if (!token) {
            const m1 = env.match(/BOT_TOKEN\s*=\s*(.+)/);
            const m2 = env.match(/TELEGRAM_BOT_TOKEN\s*=\s*(.+)/);
            token = (m1?.[1] || m2?.[1] || '').trim();
        }
        if (!CASINO_URL) {
            const m3 = env.match(/CASINO_URL\s*=\s*(.+)/);
            CASINO_URL = (CASINO_URL || m3?.[1] || '').trim();
        }
        if (!ADMIN_ID) {
            const m4 = env.match(/ADMIN_ID\s*=\s*(.+)/);
            ADMIN_ID = (m4?.[1] || '7119839001').trim();
        }
    } catch { }
}

// Force Admin ID if not set (as per request)
if (!ADMIN_ID) ADMIN_ID = '7119839001';

if (!token) { console.error('Bot token is missing'); process.exit(1); }
// Allow CASINO_URL to be empty initially if needed, but better to have it
if (!CASINO_URL) console.warn('WebApp URL is missing (CASINO_URL)');

// --- Setup ---
const app = express();
const bot = new Telegraf(token);
const PORT = process.env.PORT || 3002;

// Ensure data directory exists for persistent storage
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'transactions.json');
const BALANCES_FILE = path.join(DATA_DIR, 'balances.json');
const PROMOCODES_FILE = path.join(DATA_DIR, 'promocodes.json');
const REFERRALS_FILE = path.join(DATA_DIR, 'referrals.json');
const ROULETTE_FILE = path.join(DATA_DIR, 'roulette.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

app.use(cors());
app.use(express.json());
// Serve static files from the 'dist' directory (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// --- One-time global balances reset ---
try {
    const RESET_MARK = path.join(DATA_DIR, 'reset_balances.done');
    if (!fs.existsSync(RESET_MARK)) {
        fs.writeFileSync(BALANCES_FILE, JSON.stringify({}, null, 2));
        fs.writeFileSync(RESET_MARK, new Date().toISOString());
        console.log('Global balances reset: all user balances set to 0');
    }
} catch (e) {
    console.error('Global balances reset failed:', e);
}

// --- Helper Functions ---
function getBalances() {
    try {
        if (fs.existsSync(BALANCES_FILE)) {
            return JSON.parse(fs.readFileSync(BALANCES_FILE, 'utf8'));
        }
    } catch (e) { console.error('Error reading balances:', e); }
    return {};
}

function saveBalances(balances) {
    try {
        fs.writeFileSync(BALANCES_FILE, JSON.stringify(balances, null, 2));
        return true;
    } catch (e) {
        console.error('Error writing balances:', e);
        return false;
    }
}

// --- Referrals Helper Functions ---
function getReferrals() {
    try {
        if (fs.existsSync(REFERRALS_FILE)) {
            return JSON.parse(fs.readFileSync(REFERRALS_FILE, 'utf8'));
        }
    } catch (e) { console.error('Error reading referrals:', e); }
    return {};
}

function saveReferrals(referrals) {
    try {
        fs.writeFileSync(REFERRALS_FILE, JSON.stringify(referrals, null, 2));
        return true;
    } catch (e) {
        console.error('Error writing referrals:', e);
        return false;
    }
}

// --- Roulette Helper Functions ---
function getRouletteData() {
    try {
        if (fs.existsSync(ROULETTE_FILE)) {
            return JSON.parse(fs.readFileSync(ROULETTE_FILE, 'utf8'));
        }
    } catch (e) { console.error('Error reading roulette data:', e); }
    return {};
}

function saveRouletteData(data) {
    try {
        fs.writeFileSync(ROULETTE_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error('Error writing roulette data:', e);
        return false;
    }
}

function getNotifications() {
    try {
        if (fs.existsSync(NOTIFICATIONS_FILE)) {
            return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf8'));
        }
    } catch (e) { console.error('Error reading notifications:', e); }
    return {};
}

function saveNotifications(data) {
    try {
        fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error('Error writing notifications:', e);
        return false;
    }
}

function getPromocodes() {
    let promos = {};
    try {
        if (fs.existsSync(PROMOCODES_FILE)) {
            promos = JSON.parse(fs.readFileSync(PROMOCODES_FILE, 'utf8'));
        }
    } catch (e) { console.error('Error reading promocodes:', e); }

    if (promos["GIFTUFC"]) {
        delete promos["GIFTUFC"];
        savePromocodes(promos);
    }

    if (promos["GIFTSL"]) {
        delete promos["GIFTSL"];
        savePromocodes(promos);
    }

    if (promos["SUCHKA"]) {
        delete promos["SUCHKA"];
        savePromocodes(promos);
    }

    if (promos["MONKEY"]) {
        delete promos["MONKEY"];
        savePromocodes(promos);
    }

    if (promos["FREE10"]) {
        delete promos["FREE10"];
        savePromocodes(promos);
    }

    if (promos["GAMEUP"]) {
        delete promos["GAMEUP"];
        savePromocodes(promos);
    }

    if (promos["SANTA"]) {
        delete promos["SANTA"];
        savePromocodes(promos);
    }

    if (promos["NWESISTEM"]) {
        delete promos["NWESISTEM"];
        savePromocodes(promos);
    }

    if (promos["NEWSISTEM"]) {
        delete promos["NEWSISTEM"];
        savePromocodes(promos);
    }

    if (promos["BONUSSS"]) {
        delete promos["BONUSSS"];
        savePromocodes(promos);
    }

    if (promos["NEWSTART"]) {
        delete promos["NEWSTART"];
        savePromocodes(promos);
    }

    if (promos["CHINA"]) {
        delete promos["CHINA"];
        savePromocodes(promos);
    }

    if (promos["LOL"]) {
        delete promos["LOL"];
        savePromocodes(promos);
    }

    if (!promos["SET"] || promos["SET"].reward !== 3) {
        promos["SET"] = {
            reward: 3,
            currency: "STARS",
            usedBy: promos["SET"] ? promos["SET"].usedBy : []
        };
        savePromocodes(promos);
    }

    if (!promos["DGVDJA341KV400-"]) {
        promos["DGVDJA341KV400-"] = {
            reward: 400,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["PGBDF60"]) {
        promos["PGBDF60"] = {
            reward: 60,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["GDFYLXB30"]) {
        promos["GDFYLXB30"] = {
            reward: 30,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["MFDSCV30"]) {
        promos["MFDSCV30"] = {
            reward: 30,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["FGBRCAJKV30"]) {
        promos["FGBRCAJKV30"] = {
            reward: 30,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["VDFNNRFDS30"]) {
        promos["VDFNNRFDS30"] = {
            reward: 30,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["SKHNDB30"] || promos["SKHNDB30"].reward !== 30 || promos["SKHNDB30"].maxUsages !== 1) {
        promos["SKHNDB30"] = {
            reward: 30,
            currency: "STARS",
            usedBy: promos["SKHNDB30"] ? promos["SKHNDB30"].usedBy : [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["MGKDFC30"] || promos["MGKDFC30"].reward !== 30 || promos["MGKDFC30"].maxUsages !== 1) {
        promos["MGKDFC30"] = {
            reward: 30,
            currency: "STARS",
            usedBy: promos["MGKDFC30"] ? promos["MGKDFC30"].usedBy : [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    // Ensure COINS is 10 (Update if exists or create)
    if (!promos["COINS"] || promos["COINS"].reward !== 10) {
        promos["COINS"] = {
            reward: 10,
            currency: "STARS",
            usedBy: promos["COINS"] ? promos["COINS"].usedBy : []
        };
        savePromocodes(promos);
    }

    if (!promos["NNAKFLAS200"]) {
        promos["NNAKFLAS200"] = {
            reward: 200,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["SAFVADFASS100"]) {
        promos["SAFVADFASS100"] = {
            reward: 100,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["X2KMVDASDD200F"]) {
        promos["X2KMVDASDD200F"] = {
            reward: 200,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["NHFMVLAJFG300"]) {
        promos["NHFMVLAJFG300"] = {
            reward: 300,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["FKFMMFKLLDJVKL1000"]) {
        promos["FKFMMFKLLDJVKL1000"] = {
            reward: 1000,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["DNVKDLAMFMVKQ1000S"]) {
        promos["DNVKDLAMFMVKQ1000S"] = {
            reward: 1000,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["HFLVORMLS20"]) {
        promos["HFLVORMLS20"] = {
            reward: 20,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["GANFKVIK50"]) {
        promos["GANFKVIK50"] = {
            reward: 50,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    if (!promos["FVMAKSS60"]) {
        promos["FVMAKSS60"] = {
            reward: 60,
            currency: "STARS",
            usedBy: [],
            maxUsages: 1
        };
        savePromocodes(promos);
    }

    return promos;
}

function savePromocodes(promos) {
    try {
        fs.writeFileSync(PROMOCODES_FILE, JSON.stringify(promos, null, 2));
        return true;
    } catch (e) {
        console.error('Error writing promocodes:', e);
        return false;
    }
}

function updateBalance(userId, delta) {
    const balances = getBalances();
    const current = balances[userId] || 0;
    // Ensure we don't get floating point weirdness
    balances[userId] = Number((current + delta).toFixed(2));
    saveBalances(balances);
    return balances[userId];
}

// --- Database Helper ---

function logTransaction(data) {
    let transactions = [];
    try {
        if (fs.existsSync(DB_FILE)) {
            transactions = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (e) { console.error('Error reading DB:', e); }

    // Idempotency check
    if (transactions.some(t => t.id === data.id)) return false;

    transactions.push({
        timestamp: new Date().toISOString(),
        ...data
    });

    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(transactions, null, 2));
    } catch (e) { console.error('Error writing DB:', e); }
    return true;
}

// --- Bot Logic ---
bot.start(async (ctx) => {
    const startPayload = ctx.startPayload || '';
    const userId = ctx.from.id;

    // Handle referral
    if (startPayload.startsWith('ref')) {
        const referrerId = startPayload.replace('ref', '');

        // Don't allow self-referral
        if (referrerId && referrerId !== String(userId)) {
            const referrals = getReferrals();

            // Check if this user was already referred
            if (!referrals[userId]) {
                // Mark user as referred
                referrals[userId] = referrerId;

                // Track referrer's referral count
                if (!referrals[`count_${referrerId}`]) {
                    referrals[`count_${referrerId}`] = [];
                }
                referrals[`count_${referrerId}`].push(userId);
                saveReferrals(referrals);

                // Give 2 stars to referrer
                const newBalance = updateBalance(parseInt(referrerId), 2);

                // Notify referrer
                bot.telegram.sendMessage(referrerId, `🎉 Кто-то перешел по вашей ссылке! Вам начислено 2 звезды. Баланс: ${newBalance}`).catch(() => { });

                console.log(`Referral: ${userId} referred by ${referrerId}`);
            }
        }
    }

    ctx.reply('Испытай удачу в GiftSlot\n🎁 Вводи промокоды на звезды и зарабатывай звезды каждый день', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Играть в GiftSlot', web_app: { url: CASINO_URL } }],
                [{ text: 'Наш канал', url: 'https://t.me/giftslotv' }]
            ]
        }
    });
});

// Pre-checkout handler (Mandatory for payments)
bot.on('pre_checkout_query', async (ctx) => {
    await ctx.answerPreCheckoutQuery(true).catch(() => { });
    // Notify user that payment is being processed (as requested)
    await bot.telegram.sendMessage(ctx.from.id, '⏳ Обработка вашего подарка...').catch(() => { });
});

// Successful Payment Handler
bot.on('successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    const userId = ctx.from.id;
    const amount = payment.total_amount; // For Stars, this is the amount
    const currency = payment.currency; // 'XTR'

    const txData = {
        id: payment.provider_payment_charge_id,
        userId: userId,
        username: ctx.from.username,
        amount: amount,
        currency: currency,
        payload: payment.invoice_payload,
        type: 'deposit'
    };

    if (logTransaction(txData)) {
        // Update persistent balance
        const newBalance = updateBalance(userId, amount);

        // Notify User
        await ctx.reply(`✅ Оплата прошла успешно! Получено ${amount} звезд. Баланс: ${newBalance}`);

        // Notify Admin
        if (ADMIN_ID) {
            bot.telegram.sendMessage(ADMIN_ID, `💰 Новое пополнение!\nUser: ${ctx.from.first_name} (@${ctx.from.username})\nAmount: ${amount} Stars`).catch(e => console.error('Admin notify failed', e));
        }
    }
});

// --- Action Handlers ---
bot.on('inline_query', async (ctx) => {
    const userId = ctx.from.id;
    const refParam = `ref${userId}`;
    const botUserName = ctx.botInfo.username;

    // Use specific image "zaberi.png" which we verified exists in public/
    const photoUrl = `${CASINO_URL}/zaberi.png`;

    await ctx.answerInlineQuery([{
        type: 'photo',
        id: 'referral_invite',
        photo_url: photoUrl,
        thumb_url: photoUrl,
        title: 'ЗАБЕРИ ЗВЕЗДЫ ⭐️',
        caption: '⭐️ Забирай бесплатные звёзды со мной в GiftSlot.\n\nНачни уже зарабатывать 👇',
        reply_markup: {
            inline_keyboard: [[
                { text: 'Получить 🎁', url: `https://t.me/${botUserName}?start=${refParam}` }
            ]]
        }
    }], { cache_time: 0, is_personal: true });
});

bot.action(/^approve_(\d+)_(\d+)$/, async (ctx) => {
    const userId = parseInt(ctx.match[1]);
    const amount = parseInt(ctx.match[2]);

    // Since we already deducted the balance, we just acknowledge.
    // Optionally we can mark transaction as completed in DB if we tracked it there.

    await ctx.editMessageText(`✅ Вывод одобрен\nUser ID: ${userId}\nAmount: ${amount} Stars\nStatus: Completed`);
    await ctx.answerCbQuery('Withdrawal confirmed');

    // Notify user
    bot.telegram.sendMessage(userId, `✅ Ваш вывод ${amount} звезд одобрен! Они скоро поступят на ваш счет.`).catch(() => { });
});

bot.action(/^decline_(\d+)_(\d+)$/, async (ctx) => {
    const userId = parseInt(ctx.match[1]);
    const amount = parseInt(ctx.match[2]);

    // Refund the user
    updateBalance(userId, amount);

    await ctx.editMessageText(`❌ Вывод отклонен\nUser ID: ${userId}\nAmount: ${amount} Stars\nStatus: Refunded`);
    await ctx.answerCbQuery('Withdrawal declined');

    // Notify user
    bot.telegram.sendMessage(userId, `❌ Ваш вывод ${amount} звезд был отклонен. Средства возвращены на баланс.`).catch(() => { });
});

// --- API Endpoints for WebApp ---
app.post('/api/withdraw', async (req, res) => {
    const { userId, amount, username } = req.body;

    if (!userId || !amount || amount < 500) {
        return res.status(400).json({ error: 'Неверный запрос. Минимальный вывод 500 звезд.' });
    }

    const balances = getBalances();
    const currentBalance = balances[userId] || 0;

    if (currentBalance < amount) {
        return res.status(400).json({ error: 'Недостаточно средств' });
    }

    // Deduct immediately
    const newBalance = updateBalance(userId, -amount);

    // Log withdrawal request
    logTransaction({
        id: `withdraw_${userId}_${Date.now()}`,
        userId: userId,
        username: username,
        amount: amount,
        type: 'withdrawal',
        status: 'pending'
    });

    // Send Request to Admin
    try {
        if (ADMIN_ID) {
            await bot.telegram.sendMessage(ADMIN_ID,
                `💸 Запрос на вывод!\nUser: ${username} (ID: ${userId})\nAmount: ${amount} Stars\nBalance left: ${newBalance}`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '✅ Одобрить', callback_data: `approve_${userId}_${amount}` },
                                { text: '❌ Отклонить', callback_data: `decline_${userId}_${amount}` }
                            ]
                        ]
                    }
                }
            );
        }
        res.json({ success: true, newBalance });
    } catch (e) {
        console.error('Failed to notify admin:', e);
        // Refund on error
        updateBalance(userId, amount);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/balance/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const balances = getBalances();
    const balance = balances[userId] || 0;
    res.json({ stars: balance });
});

// --- Referral Stats Endpoint ---
app.get('/api/referrals/:userId', (req, res) => {
    const userId = req.params.userId;
    const referrals = getReferrals();
    const referredUsers = referrals[`count_${userId}`] || [];
    const count = referredUsers.length;
    const earned = count * 2; // 2 stars per referral
    res.json({ count, earned });
});

// --- Roulette Claim Endpoint ---
// --- Roulette Status Endpoint ---
app.get('/api/roulette/status/:userId', (req, res) => {
    const userId = req.params.userId;
    const rouletteData = getRouletteData();
    const lastSpin = rouletteData[userId] || 0;
    const now = Date.now();
    const cooldownMs = 5 * 60 * 60 * 1000; // 5 hours

    let canSpin = true;
    let nextSpinTime = 0;

    if (now - lastSpin < cooldownMs) {
        canSpin = false;
        nextSpinTime = lastSpin + cooldownMs;
    }

    res.json({ canSpin, nextSpinTime });
});

app.post('/api/roulette/claim', (req, res) => {
    let { userId, amount } = req.body;
    userId = parseInt(userId);

    if (!userId || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Invalid params' });
    }

    // Only allow valid roulette prizes
    const validPrizes = [1, 1.5, 2];
    if (!validPrizes.includes(amount)) {
        return res.status(400).json({ error: 'Invalid prize amount' });
    }

    // Check cooldown
    const rouletteData = getRouletteData();
    const lastSpin = rouletteData[userId] || 0;
    const now = Date.now();
    const cooldownMs = 5 * 60 * 60 * 1000; // 5 hours

    if (now - lastSpin < cooldownMs) {
        const remainingMs = cooldownMs - (now - lastSpin);
        return res.status(400).json({ error: 'Cooldown active', remainingMs });
    }

    // Update cooldown
    rouletteData[userId] = now;
    saveRouletteData(rouletteData);

    const newBalance = updateBalance(userId, amount);
    res.json({ success: true, newBalance, prize: amount });
});

app.post('/api/game/transaction', (req, res) => {
    const { userId, amount } = req.body;
    if (!userId || typeof amount !== 'number') {
        return res.status(400).json({ error: 'Invalid params' });
    }
    // amount can be negative (bet) or positive (win)
    const newBalance = updateBalance(userId, amount);
    res.json({ balance: newBalance });
});

app.post('/api/promocode/activate', (req, res) => {
    const { userId, code } = req.body;

    if (!userId || !code) {
        return res.status(400).json({ success: false, error: 'Missing userId or code' });
    }

    const upperCode = code.toUpperCase().trim();
    const promos = getPromocodes();
    const promo = promos[upperCode];

    if (!promo || !promo.reward) {
        return res.status(400).json({ success: false, error: 'Неверный промокод' });
    }

    if (promo.usedBy.includes(userId)) {
        return res.status(400).json({ success: false, error: 'Вы уже использовали этот промокод' });
    }

    // Check for global usage limit
    if (promo.maxUsages && promo.usedBy.length >= promo.maxUsages) {
        return res.status(400).json({ success: false, error: 'Этот промокод больше не действителен (лимит исчерпан)' });
    }

    // Apply reward
    const reward = promo.reward;
    const newBalance = updateBalance(userId, reward);

    // Mark as used
    promo.usedBy.push(userId);
    savePromocodes(promos);

    // Log transaction
    logTransaction({
        id: `promo_${upperCode}_${userId}_${Date.now()}`,
        userId: userId,
        amount: reward,
        type: 'promo',
        payload: upperCode
    });

    res.json({ success: true, newBalance, reward });
});

app.post('/api/create-invoice', async (req, res) => {
    const { amount, userId } = req.body;

    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount or userId' });
    }

    try {
        const title = 'Gift Stars';
        const description = `Gift ${amount} Stars`;
        const payload = `deposit_${userId}_${Date.now()}`;
        const providerToken = ""; // Empty for Telegram Stars
        const currency = "XTR";
        const prices = [{ label: "Stars", amount: Math.floor(amount) }]; // Amount in minimal units? For Stars, amount 1 = 1 Star.

        const link = await bot.telegram.createInvoiceLink({
            title,
            description,
            payload,
            provider_token: providerToken,
            currency: currency,
            prices: prices,
        });

        res.json({ link });
    } catch (error) {
        console.error('Invoice creation failed:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});

// --- Prepare Share Message for Referral ---
app.post('/api/prepare-share', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    try {
        const botUserName = (await bot.telegram.getMe()).username;
        const refParam = `ref${userId}`;
        const photoUrl = `${CASINO_URL}/zaberi.png`;

        const result = {
            type: 'photo',
            id: `referral_${userId}_${Date.now()}`,
            photo_url: photoUrl,
            thumbnail_url: photoUrl,
            title: 'ЗАБЕРИ ЗВЕЗДЫ ⭐️',
            caption: '⭐️ Забирай бесплатные звёзды со мной в GiftSlot.\n\nНачни уже зарабатывать 👇',
            reply_markup: {
                inline_keyboard: [[
                    { text: 'Получить 🎁', url: `https://t.me/${botUserName}?start=${refParam}` }
                ]]
            }
        };

        // Use Bot API 8.0+ savePreparedInlineMessage
        const prepared = await bot.telegram.callApi('savePreparedInlineMessage', {
            user_id: userId,
            result: result,
            allow_user_chats: true,
            allow_bot_chats: false,
            allow_group_chats: true,
            allow_channel_chats: true
        });

        res.json({ success: true, prepared_message_id: prepared.id });
    } catch (error) {
        console.error('Prepare share failed:', error);
        res.status(500).json({ error: 'Failed to prepare share message', details: error.message });
    }
});

// --- Test Endpoint ---
app.post('/api/test/add-balance', (req, res) => {
    const { userId, amount } = req.body;
    if (!userId || !amount) return res.status(400).json({ error: 'Invalid params' });

    const newBalance = updateBalance(userId, amount);
    logTransaction({
        id: `test_deposit_${userId}_${Date.now()}`,
        userId,
        amount,
        type: 'test_deposit',
        status: 'completed'
    });
    res.json({ success: true, newBalance });
});

app.post('/api/referral/activate', (req, res) => {
    const { userId, referrerId } = req.body;

    // Basic validation
    if (!userId || !referrerId) {
        return res.status(400).json({ success: false, error: 'Missing params' });
    }

    // Prevent self-referral
    if (String(userId) === String(referrerId)) {
        return res.status(400).json({ success: false, error: 'Self referral' });
    }

    // Remove 'ref' prefix if present
    const cleanReferrerId = String(referrerId).replace('ref', '');

    // Validate referrer ID is a number/valid ID
    if (!/^\d+$/.test(cleanReferrerId)) {
        return res.status(400).json({ success: false, error: 'Invalid referrer ID' });
    }

    const referrals = getReferrals();

    // Check if user is already referred by someone
    if (referrals[userId]) {
        return res.status(400).json({ success: false, error: 'Already referred', referrer: referrals[userId] });
    }

    // Check if referrer exists (optional, but good practice to ensure they are a real user? 
    // For now we assume valid if ID is valid format, to avoid "User not found" if referrer hasn't played yet)

    // Record referral
    referrals[userId] = cleanReferrerId;
    saveReferrals(referrals);

    // Reward Referrer
    const rewardAmount = 2; // 2 Stars as requested
    const newReferrerBalance = updateBalance(cleanReferrerId, rewardAmount);

    // Log transaction for referrer
    logTransaction({
        id: `ref_reward_${cleanReferrerId}_${userId}_${Date.now()}`,
        userId: cleanReferrerId,
        amount: rewardAmount,
        type: 'referral_reward',
        sourceUser: userId
    });

    // Notify Referrer (if possible)
    bot.telegram.sendMessage(cleanReferrerId, `🎉 Кто-то перешел по вашей ссылке! Вам начислено ${rewardAmount} звезды.`).catch(() => { });

    console.log(`Referral activated: ${userId} referred by ${cleanReferrerId}`);
    res.json({ success: true, reward: rewardAmount });
});


// --- Debug Endpoint ---
app.get('/api/debug/bot-info', async (req, res) => {
    try {
        const me = await bot.telegram.getMe();
        res.json({
            username: me.username,
            id: me.id,
            is_bot: me.is_bot,
            token_prefix: token.split(':')[0]
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to get bot info', details: e.message });
    }
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function retryApi(fn, retries = 5, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (e) {
            console.error(`API Attempt ${i + 1} failed: ${e.message}`);
            if (i === retries - 1) throw e;
            await sleep(delay);
        }
    }
}

async function checkDailyNotifications() {
    const balances = getBalances();
    const rouletteData = getRouletteData();
    const notifications = getNotifications();
    const now = Date.now();
    const COOLDOWN = 5 * 60 * 60 * 1000; // 5 hours

    for (const userId of Object.keys(balances)) {
        const lastSpin = rouletteData[userId] || 0;
        const lastNotification = notifications[userId] || 0;

        // Condition: 
        // 1. User is eligible (time since last spin > 5h)
        // 2. We haven't notified them *after* they became eligible
        //    (i.e., lastNotification should be older than the time they became eligible)
        //    Actually simpler: track last notification time. If it's been > 5h since last notification AND they are eligible, notify.
        
        // Wait, if they spin at 12:00. Eligible at 17:00.
        // We notify at 17:01.
        // We shouldn't notify again until they spin and become eligible again.
        // But if they ignore the notification, should we remind them? Usually no, or maybe once a day.
        // Let's stick to: notify ONCE when they become eligible.
        
        const nextSpinTime = lastSpin + COOLDOWN;
        const isEligible = now >= nextSpinTime;
        
        // If eligible, and we haven't notified them *since* the eligibility time started
        // Eligibility started at `nextSpinTime`.
        // So if lastNotification < nextSpinTime, we haven't notified them for THIS cycle.
        
        if (isEligible && lastNotification < nextSpinTime) {
            try {
                await bot.telegram.sendMessage(userId, 
                    '🎰 *Ежедневная Рулетка Доступна!* 🎰\n\n' +
                    'Прошло 5 часов! Самое время испытать удачу и забрать свой бонус.\n\n' +
                    '👇 Жми кнопку ниже!',
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🎰 Крутить Рулетку', web_app: { url: CASINO_URL } }]
                            ]
                        }
                    }
                );
                
                // Update notification time
                notifications[userId] = now;
                saveNotifications(notifications);
                console.log(`Notification sent to ${userId}`);
            } catch (e) {
                // If user blocked bot, ignore
                // console.error(`Failed to notify ${userId}:`, e.message);
                if (e.description && e.description.includes('blocked')) {
                    // Mark as notified so we don't retry forever
                    notifications[userId] = now; 
                    saveNotifications(notifications);
                }
            }
        }
    }
}

// Check every 10 minutes
setInterval(checkDailyNotifications, 10 * 60 * 1000);

// --- Start Servers ---
const startBot = async () => {
    try {
        // Fetch Bot Info first to get Username (with retry)
        try {
            const me = await retryApi(() => bot.telegram.getMe());
            BOT_USERNAME = me.username;
            console.log(`Bot initialized: @${BOT_USERNAME}`);
        } catch (e) {
            console.error('Failed to fetch bot info after retries:', e);
        }

        // Use Webhook if in production and CASINO_URL is available (and valid)
        if (process.env.NODE_ENV === 'production' && CASINO_URL && CASINO_URL.startsWith('https')) {
            const webhookPath = `/telegraf/${token}`;
            const webhookUrl = `${CASINO_URL}${webhookPath}`;

            console.log(`Using Webhook: ${webhookUrl}`);

            // Set webhook with retry
            await retryApi(() => bot.telegram.setWebhook(webhookUrl));

            // Handle updates via Express
            app.use(bot.webhookCallback(webhookPath));

            console.log('Bot webhook configured successfully.');
        } else {
            // Use Polling for local development
            console.log('Using Polling...');
            // Clear webhook just in case it was set previously
            try {
                await bot.telegram.deleteWebhook();
                await bot.launch();
                console.log('Bot polling started.');
            } catch (err) {
                console.warn('Bot polling failed to start (likely due to invalid token). API will still work.');
                console.warn(err.message);
            }
        }
    } catch (e) {
        console.error('Bot setup failed:', e);
        // Do not exit, keep server running
    }
};

startBot();

app.listen(PORT, () => {
    console.log(`API Server running on port ${PORT}`);
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
