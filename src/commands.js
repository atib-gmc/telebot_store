import { ensureUserExists } from './database.js';
import { userData } from './state.js';

export function registerCommands(bot) {

  // /start - Info user saat pertama kali pakai bot
  bot.start(async (ctx) => {
    // Simpan user ke database secara background (tidak tunggu)
    ensureUserExists(ctx).catch(err => console.error('DB error:', err));

    await ctx.reply(`
👋 Halo ${ctx.from.first_name}!

📱 Info Anda:
• ID: ${ctx.from.id}
• Username: ${ctx.from.username ? '@' + ctx.from.username : 'Tidak ada'}
• Chat ID: ${ctx.chat.id}
    `);
  });


  // /setor - Mulai proses setor akun game (2 step)
  // User harus lewat 2 tahap: (1) kirim akun, (2) kirim harga
  bot.command('setor', async (ctx) => {
    // Import setorSessions dari state.js karena ini dynamic import
    const { setorSessions } = await import('./state.js');

    // Buat session untuk user ini dengan step 'account'
    // Artinya: user sekarang masuk mode setor, belum kirim apa-apa
    setorSessions.set(ctx.from.id, {
      step: 'account'
    });

    await ctx.reply(
      `📥 *Setor Akun Game*\n\n` +
      `*Step 1/2:* Kirim email dan password:\n` +
      `Format: \`gmail;password\`\n\n` +
      `Contoh: \`example@gmail.com;mypassword\`\n\n` +
      `Ketik /cancel untuk batal.`,
      { parse_mode: 'Markdown' }
    );
  });

  // /cancel - Batalkan mode setor
  // Kalau user ada di session, hapus session-nya
  bot.command('cancel', async (ctx) => {
    const { setorSessions } = await import('./state.js');

    if (setorSessions.has(ctx.from.id)) {
      setorSessions.delete(ctx.from.id);
      await ctx.reply('❌ Proses setor dibatalkan.');
    }
  });

}
