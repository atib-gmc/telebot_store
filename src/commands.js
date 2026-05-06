import { Markup } from 'telegraf';
import { ensureUserExists, getUserProfile, getUserGameAccounts } from './database.js';
import { userData } from './state.js';

function buildMainMenu() {
  return Markup.keyboard([
    ['/setor'],
    ['/cancel'],
    ['/myprofile'],
    ['/menu'],
  ]).resize();
}

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

Pilih command di bawah ini:
    `, buildMainMenu());
  });

  // /menu - Tampilkan menu utama dengan tombol
  bot.command('menu', async (ctx) => {
    await ctx.reply(
      `📋 *Menu Utama*\n\n` +
      `/setor — Setor email\n` +
      `/cancel — Batalkan proses setor\n` +
      `/myprofile — Lihat profil dan saldo Anda\n` +
      `/menu — Tampilkan menu ini`,
      {
        parse_mode: 'Markdown',
        ...buildMainMenu()
      }
    );
  });

  // /myprofile - Tampilkan profil user dan saldo
  bot.command('myprofile', async (ctx) => {
    try {
      const profile = await getUserProfile(ctx.from.id);
      const accounts = await getUserGameAccounts(ctx.from.id);

      const balance = profile.balance ? Number(profile.balance).toLocaleString('id-ID') : '0';
      const totalEmails = accounts.length;

      let accountList = '';
      if (totalEmails > 0) {
        accountList = accounts.map((acc, i) => {
          const statusEmoji = acc.status === 'pending' ? '⏳' : acc.status === 'approved' ? '✅' : '❌';
          return `${i + 1}. \`${acc.email}\` — ${statusEmoji} *${acc.status}*`;
        }).join('\n');
      } else {
        accountList = '_Belum ada akun disetor_';
      }

      await ctx.reply(
        `👤 *Profil Anda*\n\n` +
        `• Nama: \`${profile.name}\`\n` +
        `• Username: \`${profile.username ? '@' + profile.username : 'Tidak ada'}\`\n` +
        `• Saldo: \`Rp ${balance}\`\n` +
        `• Terdaftar sejak: \`${new Date(profile.created_at).toLocaleDateString('id-ID')}\`\n\n` +
        `📧 *Total Email (${totalEmails})*\n\n` +
        `| Email | Status |\n` +
        `|---|---|\n` +
        accountList,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('Error fetching profile:', err);
      await ctx.reply('❌ Gagal mengambil data profil. Coba lagi.');
    }
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
    } else {
      await ctx.reply('Tidak ada proses yang sedang berjalan.');
    }
  });

}
