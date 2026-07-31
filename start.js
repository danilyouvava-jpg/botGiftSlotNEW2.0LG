import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 Initializing GiftSlot System...');

// 1. Start Vite
console.log('📦 Starting Frontend (Vite)...');
const vite = spawn('npm.cmd', ['run', 'dev'], { 
    cwd: __dirname,
    stdio: 'pipe', 
    shell: true 
});

vite.stderr.on('data', d => console.error(`[Vite] ${d}`));

// 2. Start Tunnel (npx localtunnel)
console.log('🚇 Starting Localtunnel...');
const lt = spawn('npx.cmd', ['localtunnel', '--port', '3000'], { 
    stdio: 'pipe',
    shell: true 
});

let botStarted = false;

lt.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[LT] ${output}`);
    
    const match = output.match(/https:\/\/[\w-]+\.loca\.lt/);
    if (match && !botStarted) {
        const url = match[0];
        console.log(`\n✅  PUBLIC URL GENERATED: ${url}`);
        
        updateEnv(url);
        startBot();
        botStarted = true;

        console.log('\n' + '='.repeat(60));
        console.log('⚠️  ACTION REQUIRED:');
        console.log('1. Open BotFather in Telegram');
        console.log('2. Select your bot');
        console.log('3. Go to Bot Settings -> Menu Button -> Configure Menu Button');
        console.log(`4. Send this URL: ${url}`);
        console.log('='.repeat(60) + '\n');
    }
});

lt.stderr.on('data', d => console.error(`[LT Error] ${d}`));
lt.on('close', c => console.log(`[LT] Exited with ${c}`));

function updateEnv(url) {
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    try {
        envContent = fs.readFileSync(envPath, 'utf8');
    } catch (e) { }
    
    let newContent = envContent;
    if (newContent.includes('CASINO_URL=')) {
        newContent = newContent.replace(/CASINO_URL=.*/g, `CASINO_URL=${url}`);
    } else {
        newContent += `\nCASINO_URL=${url}`;
    }
    
    fs.writeFileSync(envPath, newContent);
    console.log('📝 .env updated automatically');
}

function startBot() {
    console.log('🤖 Starting Telegram Bot...');
    const bot = spawn('node', ['bot.cjs'], { 
        cwd: __dirname,
        stdio: 'inherit',
        shell: true 
    });
}

setInterval(() => {}, 1000);

process.on('SIGINT', () => {
    vite.kill();
    lt.kill();
    process.exit();
});
