const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { Telegraf } = require('telegraf');
const { Pool } = require('pg');
const slotMath = require('./slotMath.cjs');

// --- Configuration Loading ---
let token = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
let CASINO_URL = (process.env.CASINO_URL || '').replace(/\/+$/, '');
let ADMIN_ID = process.env.ADMIN_ID || '7119839001';
let BOT_USERNAME = '';

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
        if (!ADMIN_ID || ADMIN_ID === '7119839001') {
            const m4 = env.match(/ADMIN_ID\s*=\s*(.+)/);
            if (m4?.[1]) ADMIN_ID = m4[1].trim();
        }
    } catch { }
}

if (!token) { console.error('Bot token is missing'); process.exit(1); }
if (!CASINO_URL) console.warn('WebApp URL is missing (CASINO_URL)');

// --- Setup ---
const app = express();
const bot = new Telegraf(token);
const PORT = process.env.PORT || 3002;

// Trust the first proxy hop (Railway LB) so req.ip reflects the real client IP
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.NODE_ENV === 'production' ? CASINO_URL : true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// --- Rate Limiter (in-memory) ---
const rateLimitMap = new Map();
function rateLimit(windowMs = 60000, maxRequests = 30) {
    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const entry = rateLimitMap.get(key);
        if (!entry || now - entry.start > windowMs) {
            rateLimitMap.set(key, { start: now, count: 1 });
            return next();
        }
        entry.count++;
        if (entry.count > maxRequests) {
            return res.status(429).json({ error: 'Too many requests' });
        }
        next();
    };
}
// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
        if (now - entry.start > 300000) rateLimitMap.delete(key);
    }
}, 300000);
app.use('/api', rateLimit(60000, 30));

// --- Telegram initData verification ---
function verifyInitData(initData, botToken) {
    if (!initData || !botToken) return false;
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        const dataCheckArr = [];
        for (const [key, value] of urlParams.entries()) {
            dataCheckArr.push(`${key}=${value}`);
        }
        dataCheckArr.sort();
        const dataCheckString = dataCheckArr.join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        return computedHash === hash;
    } catch {
        return false;
    }
}

function authMiddleware(req, res, next) {
    if (process.env.NODE_ENV !== 'production') return next();

    const initData = req.headers['x-telegram-initdata'];
    if (!initData) {
        return res.status(401).json({ error: 'Missing Telegram auth' });
    }

    if (!verifyInitData(initData, token)) {
        return res.status(403).json({ error: 'Invalid Telegram auth' });
    }

    try {
        const urlParams = new URLSearchParams(initData);
        const user = JSON.parse(urlParams.get('user') || '{}');
        if (!user.id) {
            return res.status(403).json({ error: 'No user in auth data' });
        }
        req.authUserId = user.id;
        req.authUser = user;
    } catch {
        return res.status(403).json({ error: 'Invalid auth user data' });
    }

    next();
}

function requireAuth(req, res, next) {
    if (process.env.NODE_ENV !== 'production') {
        req.authUserId = req.body.userId || req.params.userId;
        return next();
    }
    if (!req.authUserId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

// --- PostgreSQL ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS balances (
                user_id BIGINT PRIMARY KEY,
                balance NUMERIC DEFAULT 0
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                user_id BIGINT,
                username TEXT,
                amount NUMERIC,
                currency TEXT,
                payload TEXT,
                type TEXT,
                status TEXT,
                source_user BIGINT
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS referrals (
                user_id BIGINT PRIMARY KEY,
                referrer_id BIGINT
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS referral_counts (
                referrer_id BIGINT,
                referred_user_id BIGINT UNIQUE
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS roulette (
                user_id BIGINT PRIMARY KEY,
                last_spin BIGINT DEFAULT 0
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                user_id BIGINT PRIMARY KEY,
                last_notification BIGINT DEFAULT 0
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS promocodes (
                code TEXT PRIMARY KEY,
                reward NUMERIC DEFAULT 0,
                currency TEXT DEFAULT 'STARS',
                used_by BIGINT[] DEFAULT '{}',
                max_usages INT DEFAULT 0
            );
        `);
        console.log('Database tables initialized');
        await client.query("UPDATE balances SET balance = 0 WHERE balance < 0");
    } finally {
        client.release();
    }
}

// --- DB Helpers ---
async function getBalance(userId) {
    const res = await pool.query('SELECT balance FROM balances WHERE user_id = $1', [userId]);
    return res.rows.length > 0 ? Number(res.rows[0].balance) : 0;
}

async function updateBalance(userId, delta) {
    const res = await pool.query(`
        INSERT INTO balances (user_id, balance) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET balance = ROUND(GREATEST(0, balances.balance + $2)::numeric, 2)
        RETURNING balance
    `, [userId, delta]);
    return Number(res.rows[0].balance);
}

async function logTransaction(data) {
    try {
        await pool.query(`
            INSERT INTO transactions (id, user_id, username, amount, currency, payload, type, status, source_user)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
        `, [data.id, data.userId, data.username, data.amount, data.currency, data.payload, data.type, data.status, data.sourceUser || null]);
        return true;
    } catch (e) {
        console.error('Error logging transaction:', e);
        return false;
    }
}

async function getReferrer(userId) {
    const res = await pool.query('SELECT referrer_id FROM referrals WHERE user_id = $1', [userId]);
    return res.rows.length > 0 ? res.rows[0].referrer_id : null;
}

async function setReferral(userId, referrerId) {
    await pool.query('INSERT INTO referrals (user_id, referrer_id) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING', [userId, referrerId]);
    await pool.query('INSERT INTO referral_counts (referrer_id, referred_user_id) VALUES ($1, $2) ON CONFLICT (referred_user_id) DO NOTHING', [referrerId, userId]);
}

async function getReferralStats(userId) {
    const res = await pool.query('SELECT COUNT(*) as count FROM referral_counts WHERE referrer_id = $1', [userId]);
    const count = parseInt(res.rows[0].count);
    return { count, earned: count * 2 };
}

async function getRouletteLastSpin(userId) {
    const res = await pool.query('SELECT last_spin FROM roulette WHERE user_id = $1', [userId]);
    return res.rows.length > 0 ? Number(res.rows[0].last_spin) : 0;
}

async function setRouletteLastSpin(userId, timestamp) {
    await pool.query(`
        INSERT INTO roulette (user_id, last_spin) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET last_spin = $2
    `, [userId, timestamp]);
}

async function getNotificationTime(userId) {
    const res = await pool.query('SELECT last_notification FROM notifications WHERE user_id = $1', [userId]);
    return res.rows.length > 0 ? Number(res.rows[0].last_notification) : 0;
}

async function setNotificationTime(userId, timestamp) {
    await pool.query(`
        INSERT INTO notifications (user_id, last_notification) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET last_notification = $2
    `, [userId, timestamp]);
}

async function getPromo(code) {
    const res = await pool.query('SELECT * FROM promocodes WHERE code = $1', [code]);
    return res.rows.length > 0 ? res.rows[0] : null;
}

async function usePromo(code, userId) {
    await pool.query('UPDATE promocodes SET used_by = array_append(used_by, $2) WHERE code = $1 AND NOT ($2 = ANY(used_by))', [code, userId]);
}

async function atomicWithdraw(userId, amount) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const res = await client.query(
            'SELECT balance FROM balances WHERE user_id = $1 FOR UPDATE',
            [userId]
        );
        const currentBalance = res.rows.length > 0 ? Number(res.rows[0].balance) : 0;
        if (currentBalance < amount) {
            await client.query('ROLLBACK');
            return { success: false, newBalance: currentBalance };
        }
        const updateRes = await client.query(
            'UPDATE balances SET balance = balance - $1 WHERE user_id = $2 RETURNING balance',
            [amount, userId]
        );
        await client.query('COMMIT');
        return { success: true, newBalance: Number(updateRes.rows[0].balance) };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function atomicRouletteClaim(userId, amount) {
    const cooldownMs = 5 * 60 * 60 * 1000;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const res = await client.query(
            'SELECT last_spin FROM roulette WHERE user_id = $1 FOR UPDATE',
            [userId]
        );
        const lastSpin = res.rows.length > 0 ? Number(res.rows[0].last_spin) : 0;
        const now = Date.now();
        if (now - lastSpin < cooldownMs) {
            await client.query('ROLLBACK');
            return { success: false, remainingMs: cooldownMs - (now - lastSpin) };
        }
        await client.query(`
            INSERT INTO roulette (user_id, last_spin) VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET last_spin = $2
        `, [userId, now]);
        const updateRes = await client.query(
            'UPDATE balances SET balance = balance + $1 WHERE user_id = $2 RETURNING balance',
            [amount, userId]
        );
        if (updateRes.rows.length === 0) {
            await client.query(
                'INSERT INTO balances (user_id, balance) VALUES ($1, $2) RETURNING balance',
                [userId, amount]
            );
        }
        await client.query('COMMIT');
        return { success: true, newBalance: Number(updateRes.rows[0]?.balance || amount) };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function updateTransactionStatus(txId, status) {
    await pool.query('UPDATE transactions SET status = $1 WHERE id = $2', [status, txId]);
}

async function seedPromos() {
    // Remove old promos first
    const oldCodes = ['GIFTUFC', 'GIFTSL', 'SUCHKA', 'MONKEY', 'FREE10', 'GAMEUP', 'SANTA', 'NWESISTEM', 'NEWSISTEM', 'BONUSSS', 'NEWSTART', 'CHINA', 'LOL', 'DGVDJA341KV400-', 'PGBDF60', 'GDFYLXB30', 'MFDSCV30', 'FGBRCAJKV30', 'VDFNNRFDS30', 'SKHNDB30', 'MGKDFC30', 'NNAKFLAS200', 'SAFVADFASS100', 'X2KMVDASDD200F', 'NHFMVLAJFG300', 'FKFMMFKLLDJVKL1000', 'DNVKDLAMFMVKQ1000S', 'HFLVORMLS20', 'GANFKVIK50', 'FVMAKSS60', 'SET', 'COINS'];
    for (const code of oldCodes) {
        await pool.query('DELETE FROM promocodes WHERE code = $1', [code]);
    }

    // Insert current promos (only upsert, never touch balances)
    const promos = [
        { code: 'NEWHOME', reward: 20, maxUsages: 1 },
        { code: 'STIKERS', reward: 15, maxUsages: 1 },
        { code: 'FIX', reward: 3, maxUsages: 0 },
    ];

    for (const p of promos) {
        await pool.query(`
            INSERT INTO promocodes (code, reward, currency, used_by, max_usages)
            VALUES ($1, $2, 'STARS', '{}', $3)
            ON CONFLICT (code) DO UPDATE SET reward = $2, max_usages = $3
        `, [p.code, p.reward, p.maxUsages]);
    }
    console.log('Promocodes seeded successfully');
}

async function getAllBalances() {
    const res = await pool.query('SELECT user_id, balance FROM balances');
    const map = {};
    for (const row of res.rows) {
        map[row.user_id] = Number(row.balance);
    }
    return map;
}

async function getAllRoulette() {
    const res = await pool.query('SELECT user_id, last_spin FROM roulette');
    const map = {};
    for (const row of res.rows) {
        map[row.user_id] = Number(row.last_spin);
    }
    return map;
}

async function getAllNotifications() {
    const res = await pool.query('SELECT user_id, last_notification FROM notifications');
    const map = {};
    for (const row of res.rows) {
        map[row.user_id] = Number(row.last_notification);
    }
    return map;
}

// --- Bot Logic ---
bot.start(async (ctx) => {
    const startPayload = ctx.startPayload || '';
    const userId = ctx.from.id;

    if (startPayload.startsWith('ref')) {
        const referrerId = startPayload.replace('ref', '');

        if (referrerId && referrerId !== String(userId)) {
            const existing = await getReferrer(userId);

            if (!existing) {
                await setReferral(userId, parseInt(referrerId));
                const newBalance = await updateBalance(parseInt(referrerId), 2);

                bot.telegram.sendMessage(referrerId, `\u{1F389} \u041A\u0442\u043E-\u0442\u043E \u043F\u0435\u0440\u0435\u0448\u0435\u043B \u043F\u043E \u0432\u0430\u0448\u0435\u0439 \u0441\u0441\u044B\u043B\u043A\u0435! \u0412\u0430\u043C \u043D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u043E 2 \u0437\u0432\u0435\u0437\u0434\u044B. \u0411\u0430\u043B\u0430\u043D\u0441: ${newBalance}`).catch(() => { });

                console.log(`Referral: ${userId} referred by ${referrerId}`);
            }
        }
    }

    const startPhotoUrl = `${CASINO_URL}/start.png`;
    ctx.replyWithPhoto(startPhotoUrl, {
        caption: '\u0418\u0441\u043F\u044B\u0442\u0430\u0439 \u0443\u0434\u0430\u0447\u0443 \u0432 GiftSlot\n\u{1F381} \u0412\u0432\u043E\u0434\u0438 \u043F\u0440\u043E\u043C\u043E\u043A\u043E\u0434\u044B \u043D\u0430 \u0437\u0432\u0435\u0437\u0434\u044B \u0438 \u0437\u0430\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0439 \u0437\u0432\u0435\u0437\u0434\u044B \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C',
        reply_markup: {
            inline_keyboard: [
                [{ text: '\u0418\u0433\u0440\u0430\u0442\u044C \u0432 GiftSlot', web_app: { url: CASINO_URL } }],
                [{ text: '\u041D\u0430\u0448 \u043A\u0430\u043D\u0430\u043B', url: 'https://t.me/giftslote' }]
            ]
        }
    });
});

bot.on('pre_checkout_query', async (ctx) => {
    await ctx.answerPreCheckoutQuery(true).catch(() => { });
    await bot.telegram.sendMessage(ctx.from.id, '\u23F3 \u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u0432\u0430\u0448\u0435\u0433\u043E \u043F\u043E\u0434\u0430\u0440\u043A\u0430...').catch(() => { });
});

bot.on('successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    const userId = ctx.from.id;
    const amount = payment.total_amount;
    const currency = payment.currency;

    try {
        const newBalance = await updateBalance(userId, amount);

        await logTransaction({
            id: payment.provider_payment_charge_id,
            userId: userId,
            username: ctx.from.username,
            amount: amount,
            currency: currency,
            payload: payment.invoice_payload,
            type: 'deposit'
        }).catch(e => console.error('Transaction log failed (balance already credited):', e));

        await ctx.reply(`\u2705 \u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u043E\u0448\u043B\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E! \u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${amount} \u0437\u0432\u0435\u0437\u0434. \u0411\u0430\u043B\u0430\u043D\u0441: ${newBalance}`);

        if (ADMIN_ID) {
            bot.telegram.sendMessage(ADMIN_ID, `\u{1F4B0} \u041D\u043E\u0432\u043E\u0435 \u043F\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435!\nUser: ${ctx.from.first_name} (@${ctx.from.username})\nAmount: ${amount} Stars`).catch(e => console.error('Admin notify failed', e));
        }
    } catch (e) {
        console.error('CRITICAL: Failed to credit balance for payment:', payment.provider_payment_charge_id, e);
        try {
            await ctx.reply(`\u26A0\uFE0F \u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0430, \u043D\u043E \u043F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u0430 \u043E\u0448\u0438\u0431\u043A\u0430. \u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 @admin \u0434\u043B\u044F \u043F\u043E\u043C\u043E\u0449\u0438.`);
        } catch { }
    }
});

bot.on('inline_query', async (ctx) => {
    const userId = ctx.from.id;
    const refParam = `ref${userId}`;
    const botUserName = ctx.botInfo.username;
    const photoUrl = `${CASINO_URL}/zaberi.png`;

    await ctx.answerInlineQuery([{
        type: 'photo',
        id: 'referral_invite',
        photo_url: photoUrl,
        thumb_url: photoUrl,
        title: '\u0417\u0410\u0411\u0415\u0420\u0418 \u0417\u0412\u0415\u0417\u0414\u042B \u2B50\uFE0F',
        caption: '\u2B50 \u0417\u0430\u0431\u0438\u0440\u0430\u0439 \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0435 \u0437\u0432\u0451\u0437\u0434\u044B \u0441\u043E \u043C\u043D\u043E\u0439 \u0432 GiftSlot.\n\n\u041D\u0430\u0447\u043D\u0438 \u0443\u0436\u0435 \u0437\u0430\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0442\u044C \u{1F447}',
        reply_markup: {
            inline_keyboard: [[
                { text: '\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u{1F381}', url: `https://t.me/${botUserName}?start=${refParam}` }
            ]]
        }
    }], { cache_time: 0, is_personal: true });
});

bot.action(/^approve_(\d+)_(\d+)_(.+)$/, async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.answerCbQuery('Only admin can do this');
    }
    const userId = parseInt(ctx.match[1]);
    const amount = parseInt(ctx.match[2]);
    const txId = ctx.match[3];

    await updateTransactionStatus(txId, 'completed');
    await ctx.editMessageText(`\u2705 \u0412\u044B\u0432\u043E\u0434 \u043E\u0434\u043E\u0431\u0440\u0435\u043D\nUser ID: ${userId}\nAmount: ${amount} Stars\nStatus: Completed`);
    await ctx.answerCbQuery('Withdrawal confirmed');
    bot.telegram.sendMessage(userId, `\u2705 \u0412\u0430\u0448 \u0432\u044B\u0432\u043E\u0434 ${amount} \u0437\u0432\u0435\u0437\u0434 \u043E\u0434\u043E\u0431\u0440\u0435\u043D! \u041E\u043D\u0438 \u0441\u043A\u043E\u0440\u043E \u043F\u043E\u0441\u0442\u0443\u043F\u044F\u0442 \u043D\u0430 \u0432\u0430\u0448 \u0441\u0447\u0451\u0442.`).catch(() => { });
});

bot.action(/^decline_(\d+)_(\d+)_(.+)$/, async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.answerCbQuery('Only admin can do this');
    }
    const userId = parseInt(ctx.match[1]);
    const amount = parseInt(ctx.match[2]);
    const txId = ctx.match[3];

    await updateBalance(userId, amount);
    await updateTransactionStatus(txId, 'refunded');
    await ctx.editMessageText(`\u274C \u0412\u044B\u0432\u043E\u0434 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\nUser ID: ${userId}\nAmount: ${amount} Stars\nStatus: Refunded`);
    await ctx.answerCbQuery('Withdrawal declined');
    bot.telegram.sendMessage(userId, `\u274C \u0412\u0430\u0448 \u0432\u044B\u0432\u043E\u0434 ${amount} \u0437\u0432\u0435\u0437\u0434 \u0431\u044B\u043B \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D. \u0421\u0440\u0435\u0434\u0441\u0442\u0432\u0430 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u044B \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441.`).catch(() => { });
});

// --- API Endpoints ---
app.use('/api', authMiddleware);

app.post('/api/withdraw', requireAuth, async (req, res) => {
    const { userId, amount, username } = req.body;
    const requestUserId = process.env.NODE_ENV === 'production' ? req.authUserId : userId;

    if (!requestUserId || !amount || amount < 500) {
        return res.status(400).json({ error: 'Invalid request. Minimum withdrawal 500 stars.' });
    }

    let success, newBalance;
    try {
        const result = await atomicWithdraw(requestUserId, amount);
        success = result.success;
        newBalance = result.newBalance;
    } catch (e) {
        console.error('Withdraw atomic error:', e);
        return res.status(500).json({ error: 'Internal error' });
    }

    if (!success) {
        return res.status(400).json({ error: 'Insufficient funds' });
    }

    const txId = `withdraw_${requestUserId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await logTransaction({
        id: txId,
        userId: requestUserId,
        username: username,
        amount: amount,
        type: 'withdrawal',
        status: 'pending'
    });

    try {
        if (ADMIN_ID) {
            await bot.telegram.sendMessage(ADMIN_ID,
                `\u{1F4B8} \u0417\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u0432\u044B\u0432\u043E\u0434!\nUser: ${username} (ID: ${requestUserId})\nAmount: ${amount} Stars\nBalance left: ${newBalance}`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '\u2705 \u041E\u0434\u043E\u0431\u0440\u0438\u0442\u044C', callback_data: `approve_${requestUserId}_${amount}_${txId}` },
                                { text: '\u274C \u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C', callback_data: `decline_${requestUserId}_${amount}_${txId}` }
                            ]
                        ]
                    }
                }
            );
        }
        res.json({ success: true, newBalance });
    } catch (e) {
        console.error('Failed to notify admin:', e);
        await updateBalance(requestUserId, amount);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/balance/:userId', requireAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const authId = process.env.NODE_ENV === 'production' ? req.authUserId : userId;
        if (authId !== userId) return res.status(403).json({ error: 'Forbidden' });
        const balance = await getBalance(userId);
        res.json({ stars: balance });
    } catch (e) {
        res.status(500).json({ error: 'Internal error' });
    }
});

app.get('/api/referrals/:userId', requireAuth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const authId = process.env.NODE_ENV === 'production' ? String(req.authUserId) : userId;
        if (authId !== userId) return res.status(403).json({ error: 'Forbidden' });
        const stats = await getReferralStats(userId);
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: 'Internal error' });
    }
});

app.get('/api/roulette/status/:userId', requireAuth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const authId = process.env.NODE_ENV === 'production' ? String(req.authUserId) : userId;
        if (authId !== userId) return res.status(403).json({ error: 'Forbidden' });
        const lastSpin = await getRouletteLastSpin(userId);
        const now = Date.now();
        const cooldownMs = 5 * 60 * 60 * 1000;

        let canSpin = true;
        let nextSpinTime = 0;

        if (now - lastSpin < cooldownMs) {
            canSpin = false;
            nextSpinTime = lastSpin + cooldownMs;
        }

        res.json({ canSpin, nextSpinTime });
    } catch (e) {
        res.status(500).json({ error: 'Internal error' });
    }
});

app.post('/api/roulette/claim', requireAuth, async (req, res) => {
    let { userId, amount } = req.body;
    userId = parseInt(userId);
    const authId = process.env.NODE_ENV === 'production' ? req.authUserId : userId;
    if (authId !== userId) return res.status(403).json({ error: 'Forbidden' });

    if (!userId || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Invalid params' });
    }

    const validPrizes = [1, 1.5, 2];
    if (!validPrizes.includes(amount)) {
        return res.status(400).json({ error: 'Invalid prize amount' });
    }

    try {
        const result = await atomicRouletteClaim(userId, amount);
        if (!result.success) {
            return res.status(400).json({ error: 'Cooldown active', remainingMs: result.remainingMs });
        }
        res.json({ success: true, newBalance: result.newBalance, prize: amount });
    } catch (e) {
        console.error('Roulette claim error:', e);
        res.status(500).json({ error: 'Internal error' });
    }
});

// Server-side state for Obeziana sticky planes (locked cells)
// Trusted source: never accept grid/locked cells from the client.
const lockedCellsByUser = new Map();

function computeNewLocks(theme, prevLocks, finalGrid) {
    if (theme !== 'obeziana') return [];

    const currentPlanes = [];
    finalGrid.forEach((row, r) => row.forEach((cell, c) => {
        if (cell.type === slotMath.SymbolType.PLANE) currentPlanes.push({ r, c });
    }));
    const newCount = currentPlanes.length;
    const prevCount = prevLocks.length;

    if (newCount >= 3) return [];
    if (newCount > prevCount && newCount > 0) {
        return currentPlanes.map(p => ({ ...p, life: 1 }));
    }
    return prevLocks.map(p => ({ ...p, life: p.life - 1 })).filter(p => p.life > 0);
}

app.post('/api/game/spin', requireAuth, async (req, res) => {
    const { userId, bet, theme } = req.body;
    const authId = process.env.NODE_ENV === 'production' ? req.authUserId : userId;
    if (authId !== userId) return res.status(403).json({ error: 'Forbidden' });

    if (!userId || !bet || typeof bet !== 'number' || bet <= 0) {
        return res.status(400).json({ error: 'Invalid bet' });
    }
    if (bet > 500) {
        return res.status(400).json({ error: 'Max bet is 500' });
    }
    const validThemes = ['durov', 'flour', 'obeziana'];
    const spinTheme = validThemes.includes(theme) ? theme : 'durov';

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const balRes = await client.query(
            'SELECT balance FROM balances WHERE user_id = $1 FOR UPDATE',
            [userId]
        );
        const currentBalance = balRes.rows.length > 0 ? Number(balRes.rows[0].balance) : 0;

        if (currentBalance < bet) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        await client.query(
            'UPDATE balances SET balance = balance - $1 WHERE user_id = $2',
            [bet, userId]
        );

        const lockedCells = lockedCellsByUser.get(userId) || [];
        const result = slotMath.runSpin(bet, spinTheme, lockedCells, null);

        lockedCellsByUser.set(userId, computeNewLocks(spinTheme, lockedCells, result.grid));

        let totalWin = result.winAmount;
        if (result.bonus) {
            totalWin += result.bonus.totalWin;
        }

        if (totalWin > 0) {
            await client.query(
                'UPDATE balances SET balance = balance + $1 WHERE user_id = $2',
                [totalWin, userId]
            );
        }

        const finalBalRes = await client.query(
            'SELECT balance FROM balances WHERE user_id = $1',
            [userId]
        );
        const newBalance = Number(finalBalRes.rows[0]?.balance || 0);

        await logTransaction({
            id: `spin_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            userId,
            amount: -bet + totalWin,
            type: 'spin',
            status: 'completed'
        });

        await client.query('COMMIT');

        res.json({
            success: true,
            grid: result.grid,
            winAmount: result.winAmount,
            winningLines: result.winningLines,
            newBalance,
            isBonusTriggered: result.isBonusTriggered,
            bonus: result.bonus
        });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Spin error:', e);
        res.status(500).json({ error: 'Internal error' });
    } finally {
        client.release();
    }
});

app.post('/api/game/buy-bonus', requireAuth, async (req, res) => {
    const { userId, bet, theme } = req.body;
    const authId = process.env.NODE_ENV === 'production' ? req.authUserId : userId;
    if (authId !== userId) return res.status(403).json({ error: 'Forbidden' });

    if (!userId || !bet || typeof bet !== 'number' || bet <= 0) {
        return res.status(400).json({ error: 'Invalid bet' });
    }
    const cost = Math.round(bet * 100);
    const validThemes = ['durov', 'flour', 'obeziana'];
    const spinTheme = validThemes.includes(theme) ? theme : 'durov';

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const balRes = await client.query(
            'SELECT balance FROM balances WHERE user_id = $1 FOR UPDATE',
            [userId]
        );
        const currentBalance = balRes.rows.length > 0 ? Number(balRes.rows[0].balance) : 0;

        if (currentBalance < cost) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        await client.query(
            'UPDATE balances SET balance = balance - $1 WHERE user_id = $2',
            [cost, userId]
        );

        const triggerGrid = slotMath.generateGrid(slotMath.ROWS, slotMath.COLS, false, bet, spinTheme);
        let coinsCount = slotMath.countCoins(triggerGrid);
        while (coinsCount < 5) {
            const r = Math.floor(Math.random() * slotMath.ROWS);
            const c = Math.floor(Math.random() * slotMath.COLS);
            if (triggerGrid[r][c].type !== slotMath.SymbolType.COIN) {
                triggerGrid[r][c] = {
                    id: crypto.randomBytes(6).toString('base64url'),
                    type: slotMath.SymbolType.COIN,
                    coinValue: Math.max(0.1, Math.round(bet * (Math.random() * 0.5 + 0.1) * 10) / 10),
                    coinType: 'STANDARD',
                    isLocked: false
                };
                coinsCount++;
            }
        }

        const bonusResult = slotMath.simulateBonusRound(triggerGrid, bet, spinTheme);

        await client.query(
            'UPDATE balances SET balance = balance + $1 WHERE user_id = $2',
            [bonusResult.totalWin, userId]
        );

        const finalBalRes = await client.query(
            'SELECT balance FROM balances WHERE user_id = $1',
            [userId]
        );
        const newBalance = Number(finalBalRes.rows[0]?.balance || 0);

        await logTransaction({
            id: `bonus_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            userId,
            amount: -cost + bonusResult.totalWin,
            type: 'buy_bonus',
            status: 'completed'
        });

        await client.query('COMMIT');

        res.json({
            success: true,
            triggerGrid,
            bonus: bonusResult,
            newBalance
        });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Buy bonus error:', e);
        res.status(500).json({ error: 'Internal error' });
    } finally {
        client.release();
    }
});

app.post('/api/promocode/activate', requireAuth, async (req, res) => {
    const { userId, code } = req.body;
    const authId = process.env.NODE_ENV === 'production' ? req.authUserId : userId;
    if (authId !== userId) return res.status(403).json({ error: 'Forbidden' });

    if (!userId || !code) {
        return res.status(400).json({ success: false, error: 'Missing userId or code' });
    }

    const upperCode = code.toUpperCase().trim();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const promoRes = await client.query('SELECT * FROM promocodes WHERE code = $1 FOR UPDATE', [upperCode]);
        const promo = promoRes.rows.length > 0 ? promoRes.rows[0] : null;

        if (!promo || !promo.reward) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: '\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043F\u0440\u043E\u043C\u043E\u043A\u043E\u0434' });
        }

        const userIdStr = String(userId);
        const usedByStr = (promo.used_by || []).map(id => String(id));

        if (usedByStr.includes(userIdStr)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: '\u0412\u044B \u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043B\u0438 \u044D\u0442\u043E\u0442 \u043F\u0440\u043E\u043C\u043E\u043A\u043E\u0434' });
        }

        if (promo.max_usages > 0 && usedByStr.length >= promo.max_usages) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: '\u042D\u0442\u043E\u0442 \u043F\u0440\u043E\u043C\u043E\u043A\u043E\u0434 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u0435\u043D (\u043B\u0438\u043C\u0438\u0442 \u0438\u0441\u0447\u0435\u0440\u043F\u0430\u043D)' });
        }

        const reward = Number(promo.reward);
        const promoUpdate = await client.query('UPDATE promocodes SET used_by = array_append(used_by, $2) WHERE code = $1 AND NOT ($2 = ANY(used_by))', [upperCode, userId]);

        if (promoUpdate.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: '\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434 \u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D' });
        }

        const balRes = await client.query(`
            INSERT INTO balances (user_id, balance) VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET balance = ROUND((balances.balance + $2)::numeric, 2)
            RETURNING balance
        `, [userId, reward]);

        await client.query('COMMIT');

        const newBalance = Number(balRes.rows[0].balance);
        await logTransaction({
            id: `promo_${upperCode}_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            userId: userId,
            amount: reward,
            type: 'promo',
            payload: upperCode
        });

        res.json({ success: true, newBalance, reward });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Promo activate error:', e);
        res.status(500).json({ error: 'Internal error' });
    } finally {
        client.release();
    }
});

app.post('/api/create-invoice', requireAuth, async (req, res) => {
    const { amount, userId } = req.body;
    const authId = process.env.NODE_ENV === 'production' ? req.authUserId : userId;
    if (authId !== userId) return res.status(403).json({ error: 'Forbidden' });

    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount or userId' });
    }

    try {
        const title = 'Gift Stars';
        const description = `Gift ${amount} Stars`;
        const payload = `deposit_${userId}_${Date.now()}`;
        const providerToken = "";
        const currency = "XTR";
        const prices = [{ label: "Stars", amount: Math.floor(amount) }];

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

app.post('/api/prepare-share', requireAuth, async (req, res) => {
    const { userId } = req.body;
    const authId = process.env.NODE_ENV === 'production' ? req.authUserId : userId;
    if (authId !== userId) return res.status(403).json({ error: 'Forbidden' });

    try {
        const botUserName = (await bot.telegram.getMe()).username;
        const refParam = `ref${userId}`;
        const photoUrl = `${CASINO_URL}/zaberi.png`;

        const result = {
            type: 'photo',
            id: `referral_${userId}_${Date.now()}`,
            photo_url: photoUrl,
            thumbnail_url: photoUrl,
            title: '\u0417\u0410\u0411\u0415\u0420\u0418 \u0417\u0412\u0415\u0417\u0414\u042B \u2B50\uFE0F',
            caption: '\u2B50 \u0417\u0430\u0431\u0438\u0440\u0430\u0439 \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0435 \u0437\u0432\u0451\u0437\u0434\u044B \u0441\u043E \u043C\u043D\u043E\u0439 \u0432 GiftSlot.\n\n\u041D\u0430\u0447\u043D\u0438 \u0443\u0436\u0435 \u0437\u0430\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0442\u044C \u{1F447}',
            reply_markup: {
                inline_keyboard: [[
                    { text: '\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u{1F381}', url: `https://t.me/${botUserName}?start=${refParam}` }
                ]]
            }
        };

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

app.post('/api/test/add-balance', requireAuth, async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    const { userId, amount } = req.body;
    if (!userId || !amount) return res.status(400).json({ error: 'Invalid params' });

    const newBalance = await updateBalance(userId, amount);
    await logTransaction({
        id: `test_deposit_${userId}_${Date.now()}`,
        userId,
        amount,
        type: 'test_deposit',
        status: 'completed'
    });
    res.json({ success: true, newBalance });
});

app.post('/api/referral/activate', requireAuth, async (req, res) => {
    const { userId, referrerId } = req.body;
    const authId = process.env.NODE_ENV === 'production' ? req.authUserId : userId;
    if (authId !== userId) return res.status(403).json({ error: 'Forbidden' });

    if (!userId || !referrerId) {
        return res.status(400).json({ success: false, error: 'Missing params' });
    }

    if (String(userId) === String(referrerId)) {
        return res.status(400).json({ success: false, error: 'Self referral' });
    }

    const cleanReferrerId = String(referrerId).replace('ref', '');

    if (!/^\d+$/.test(cleanReferrerId)) {
        return res.status(400).json({ success: false, error: 'Invalid referrer ID' });
    }

    const existing = await getReferrer(userId);
    if (existing) {
        return res.status(400).json({ success: false, error: 'Already referred', referrer: existing });
    }

    await setReferral(userId, parseInt(cleanReferrerId));

    const rewardAmount = 2;
    const newReferrerBalance = await updateBalance(parseInt(cleanReferrerId), rewardAmount);

    await logTransaction({
        id: `ref_reward_${cleanReferrerId}_${userId}_${Date.now()}`,
        userId: parseInt(cleanReferrerId),
        amount: rewardAmount,
        type: 'referral_reward',
        sourceUser: userId
    });

    bot.telegram.sendMessage(cleanReferrerId, `\u{1F389} \u041A\u0442\u043E-\u0442\u043E \u043F\u0435\u0440\u0435\u0448\u0435\u043B \u043F\u043E \u0432\u0430\u0448\u0435\u0439 \u0441\u0441\u044B\u043B\u043A\u0435! \u0412\u0430\u043C \u043D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u043E ${rewardAmount} \u0437\u0432\u0435\u0437\u0434\u044B.`).catch(() => { });

    console.log(`Referral activated: ${userId} referred by ${cleanReferrerId}`);
    res.json({ success: true, reward: rewardAmount });
});

app.get('/api/debug/bot-info', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    bot.telegram.getMe().then(me => {
        res.json({ username: me.username, id: me.id, is_bot: me.is_bot });
    }).catch(e => {
        res.status(500).json({ error: 'Failed', details: e.message });
    });
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
    try {
        const balances = await getAllBalances();
        const rouletteData = await getAllRoulette();
        const notifications = await getAllNotifications();
        const now = Date.now();
        const COOLDOWN = 5 * 60 * 60 * 1000;

        for (const userId of Object.keys(balances)) {
            const lastSpin = rouletteData[userId] || 0;
            const lastNotification = notifications[userId] || 0;

            const nextSpinTime = lastSpin + COOLDOWN;
            const isEligible = now >= nextSpinTime;

            if (isEligible && lastNotification < nextSpinTime) {
                try {
                    await bot.telegram.sendMessage(userId,
                        '\u{1F3B0} *Ежедневная Рулетка Доступна!* \u{1F3B0}\n\n' +
                        'Прошло 5 часов! Самое время испытать удачу и забрать свой бонус.\n\n' +
                        '\u{1F447} Жми кнопку ниже!',
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '\u{1F3B0} Крутить Рулетку', web_app: { url: CASINO_URL } }]
                                ]
                            }
                        }
                    );

                    await setNotificationTime(parseInt(userId), now);
                    console.log(`Notification sent to ${userId}`);
                } catch (e) {
                    if (e.description && e.description.includes('blocked')) {
                        await setNotificationTime(parseInt(userId), now);
                    }
                }
            }
        }
    } catch (e) {
        console.error('checkDailyNotifications failed:', e);
    }
}

setInterval(checkDailyNotifications, 10 * 60 * 1000);

// --- Start ---
const startBot = async () => {
    try {
        // Init database
        await initDB();
        await seedPromos();

        try {
            const me = await retryApi(() => bot.telegram.getMe());
            BOT_USERNAME = me.username;
            console.log(`Bot initialized: @${BOT_USERNAME}`);
        } catch (e) {
            console.error('Failed to fetch bot info after retries:', e);
        }

        if (process.env.NODE_ENV === 'production' && CASINO_URL && CASINO_URL.startsWith('https')) {
            const webhookSecret = require('crypto').createHash('sha256').update(token).digest('hex').slice(0, 32);
            const webhookPath = `/webhook/${webhookSecret}`;
            const webhookUrl = `${CASINO_URL}${webhookPath}`;

            console.log(`Using Webhook: ${webhookUrl}`);

            await retryApi(() => bot.telegram.setWebhook(webhookUrl));

            // Telegram webhook IP filtering
            const TELEGRAM_IP_RANGES = [
                '149.154.160.0/20',
                '91.108.4.0/22'
            ];
            function ipToInt(ip) {
                return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
            }
            function ipInCIDR(ip, cidr) {
                const [range, bits] = cidr.split('/');
                const mask = ~(2 ** (32 - parseInt(bits)) - 1);
                return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
            }
            function isTelegramIP(ip) {
                return TELEGRAM_IP_RANGES.some(cidr => ipInCIDR(ip, cidr));
            }

            app.use(webhookPath, (req, res, next) => {
                const clientIP = req.ip || req.connection.remoteAddress?.replace('::ffff:', '');
                if (process.env.NODE_ENV === 'production' && clientIP && !isTelegramIP(clientIP)) {
                    console.warn(`Blocked webhook request from non-TG IP: ${clientIP}`);
                    return res.status(403).json({ error: 'Forbidden' });
                }
                next();
            });

            app.use(bot.webhookCallback(webhookPath));
            console.log('Bot webhook configured successfully.');
        } else {
            console.log('Using Polling...');
            try {
                await bot.telegram.deleteWebhook();
                await bot.launch();
                console.log('Bot polling started.');
            } catch (err) {
                console.warn('Bot polling failed to start:', err.message);
            }
        }
    } catch (e) {
        console.error('Bot setup failed:', e);
    }
};

startBot();

app.listen(PORT, () => {
    console.log(`API Server running on port ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
