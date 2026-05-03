export function registerMyinfo(bot) {
  bot.command('myinfo', async (ctx) => {
    const userInfo = {
      id: ctx.from.id,
      nama_lengkap: `${ctx.from.first_name} ${ctx.from.last_name || ''}`,
      username: ctx.from.username,
      is_bot: ctx.from.is_bot,
      bahasa: ctx.from.language_code,
      chat_id: ctx.chat.id,
      chat_tipe: ctx.chat.type,
      pesan_id: ctx.message.message_id,
      waktu: new Date(ctx.message.date * 1000).toISOString()
    };

    await ctx.reply(`Informasi user:\n\`\`\`json\n${JSON.stringify(userInfo, null, 2)}\n\`\`\``, {
      parse_mode: 'Markdown'
    });

    console.log('User Info:', userInfo);
  });
}
