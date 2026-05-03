import { ensureUserExists } from '../helpers/user.js';

export function registerStart(bot) {
  bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    const lastName = ctx.from.last_name;
    const username = ctx.from.username;
    const languageCode = ctx.from.language_code;
    const chatId = ctx.chat.id;
    const chatType = ctx.chat.type;
    const messageDate = new Date(ctx.message.date * 1000);

    ensureUserExists(ctx).catch(err => console.error('DB error in /start:', err));

    await ctx.reply(`
📱 Informasi User Anda:
• ID: ${userId}
• Nama: ${firstName} ${lastName || ''}
• Username: ${username ? '@' + username : 'Tidak ada'}
• Bahasa: ${languageCode || 'Tidak diketahui'}
• Chat ID: ${chatId}
• Tipe Chat: ${chatType}
• Waktu: ${messageDate.toLocaleString('id-ID')}
  `);
  });
}
