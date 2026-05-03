import { bot } from './src/index.js';

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

console.log("Bot sedang berjalan...");
