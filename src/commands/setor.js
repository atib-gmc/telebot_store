export function registerSetor(bot, setorSessions) {
  bot.command('setor', async (ctx) => {
    setorSessions.set(ctx.from.id, { active: true });

    await ctx.reply(
      `📥 *Setor Akun Game*\n\n` +
      `Masukkan data akun dengan format:\n` +
      `\`accountid;level\`\n\n` +
      `*Contoh:*\n` +
      `\`acc12345;Gold III\`\n\n` +
      `Ketik /cancel untuk membatalkan.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('cancel', async (ctx) => {
    if (setorSessions.has(ctx.from.id)) {
      setorSessions.delete(ctx.from.id);
      await ctx.reply('❌ Proses setor dibatalkan.');
    }
  });
}
