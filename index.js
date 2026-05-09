import bot from './src/bot.js';
import { registerCommands } from './src/commands.js';
import { registerTextHandler, registerPhotoHandler } from './src/handler.js';

// Step 1: Daftar semua command ke bot (/start, /setor, dll)
registerCommands(bot);

// Step 2: Daftar text handler (untuk proses setor + pesan biasa)
registerTextHandler(bot);

// Step 3: Daftar photo handler (untuk broadcast foto)
registerPhotoHandler(bot);

// Step 4: Jalankan bot
bot.launch();

// Stop bot dengan aman saat process dimatikan
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

console.log('🤖 Bot sedang berjalan...');
