export function registerStats(bot, userData) {
  bot.command('stats', (ctx) => {
    const userId = ctx.from.id;
    const user = userData.get(userId);

    if (user) {
      ctx.reply(`
📊 Statistik Anda:
• Pesan terkirim: ${user.messages_count}
• Pertama kali chat: ${user.first_seen.toLocaleString('id-ID')}
• Terakhir chat: ${user.last_message.toLocaleString('id-ID')}
        `);
    } else {
      ctx.reply('Belum ada statistik untuk Anda');
    }
  });
}
