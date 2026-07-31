const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const BALANCES_FILE = path.join(DATA_DIR, 'balances.json');
const PROMOS_FILE = path.join(DATA_DIR, 'promocodes.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch { }
  return fallback;
}

function writeJson(file, obj) {
  try {
    fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  } catch { }
}

function getBalances() {
  return readJson(BALANCES_FILE, {});
}

function setBalance(userId, delta) {
  const balances = getBalances();
  const current = balances[userId] || 0;
  const next = current + delta;
  balances[userId] = next < 0 ? 0 : next;
  writeJson(BALANCES_FILE, balances);
  return balances[userId];
}

function getPromos() {
  const promos = readJson(PROMOS_FILE, {});
  // Required: only NEWSISTEM (+3 stars)
  if (promos['GAMEUP']) {
    delete promos['GAMEUP'];
    writeJson(PROMOS_FILE, promos);
  }
  if (promos['SANTA']) {
    delete promos['SANTA'];
    writeJson(PROMOS_FILE, promos);
  }
  if (promos['NWESISTEM']) {
    delete promos['NWESISTEM'];
    writeJson(PROMOS_FILE, promos);
  }
  if (promos['NEWSISTEM']) {
    delete promos['NEWSISTEM'];
    writeJson(PROMOS_FILE, promos);
  }
  if (promos['BONUSSS']) {
    delete promos['BONUSSS'];
    writeJson(PROMOS_FILE, promos);
  }
  if (promos['NEWSTART']) {
    delete promos['NEWSTART'];
    writeJson(PROMOS_FILE, promos);
  }
  if (promos['CHINA']) {
    delete promos['CHINA'];
    writeJson(PROMOS_FILE, promos);
  }
  if (promos['LOL']) {
    delete promos['LOL'];
    writeJson(PROMOS_FILE, promos);
  }
  if (!promos['SET'] || promos['SET'].reward !== 3) {
    promos['SET'] = { reward: 3, currency: 'STARS', usedBy: promos['SET'] ? promos['SET'].usedBy : [] };
    writeJson(PROMOS_FILE, promos);
  }
  if (!promos['DGVDJA341KV400-']) {
    promos['DGVDJA341KV400-'] = { reward: 400, currency: 'STARS', usedBy: [], maxUsages: 1 };
    writeJson(PROMOS_FILE, promos);
  }
  if (!promos['PGBDF60']) {
    promos['PGBDF60'] = { reward: 60, currency: 'STARS', usedBy: [], maxUsages: 1 };
    writeJson(PROMOS_FILE, promos);
  }
  if (!promos['GDFYLXB30']) {
    promos['GDFYLXB30'] = { reward: 30, currency: 'STARS', usedBy: [], maxUsages: 1 };
    writeJson(PROMOS_FILE, promos);
  }
  if (!promos['MFDSCV30']) {
    promos['MFDSCV30'] = { reward: 30, currency: 'STARS', usedBy: [], maxUsages: 1 };
    writeJson(PROMOS_FILE, promos);
  }
  if (!promos['FGBRCAJKV30']) {
    promos['FGBRCAJKV30'] = { reward: 30, currency: 'STARS', usedBy: [], maxUsages: 1 };
    writeJson(PROMOS_FILE, promos);
  }
  if (!promos['VDFNNRFDS30']) {
    promos['VDFNNRFDS30'] = { reward: 30, currency: 'STARS', usedBy: [], maxUsages: 1 };
    writeJson(PROMOS_FILE, promos);
  }
  if (!promos['SKHNDB30'] || promos['SKHNDB30'].reward !== 30 || promos['SKHNDB30'].maxUsages !== 1) {
    promos['SKHNDB30'] = { reward: 30, currency: 'STARS', usedBy: promos['SKHNDB30'] ? promos['SKHNDB30'].usedBy : [], maxUsages: 1 };
    writeJson(PROMOS_FILE, promos);
  }
  if (!promos['MGKDFC30'] || promos['MGKDFC30'].reward !== 30 || promos['MGKDFC30'].maxUsages !== 1) {
    promos['MGKDFC30'] = { reward: 30, currency: 'STARS', usedBy: promos['MGKDFC30'] ? promos['MGKDFC30'].usedBy : [], maxUsages: 1 };
    writeJson(PROMOS_FILE, promos);
  }
  if (!promos['GANFKVIK50']) {
    promos['GANFKVIK50'] = { reward: 50, currency: 'STARS', usedBy: [], maxUsages: 1 };
    writeJson(PROMOS_FILE, promos);
  }
  if (!promos['FVMAKSS60']) {
    promos['FVMAKSS60'] = { reward: 60, currency: 'STARS', usedBy: [], maxUsages: 1 };
    writeJson(PROMOS_FILE, promos);
  }
  return promos;
}

function savePromos(promos) {
  writeJson(PROMOS_FILE, promos);
}

app.post('/api/promocode/activate', (req, res) => {
  const { userId, code } = req.body || {};
  if (!userId || !code) return res.status(400).json({ error: 'invalid_request' });

  const promos = getPromos();
  const promo = promos[code];
  if (!promo) return res.status(404).json({ error: 'not_found' });

  const usedBy = promo.usedBy || [];
  if (usedBy.includes(userId)) return res.status(409).json({ error: 'already_used' });

  if (promo.maxUsages && usedBy.length >= promo.maxUsages) {
    return res.status(409).json({ error: 'limit_reached' });
  }

  const amount = Number(promo.reward) || 0;
  setBalance(userId, amount);
  usedBy.push(userId);
  promo.usedBy = usedBy;
  promos[code] = promo;
  savePromos(promos);

  res.json({ ok: true, added: amount, balance: getBalances()[userId] });
});

app.post('/api/game/transaction', (req, res) => {
  // Accept but do nothing in local mode
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Local API running on port ${PORT}`);
});
