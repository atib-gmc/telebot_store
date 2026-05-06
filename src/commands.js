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

  // /myinfo - Tampilkan detail info user dalam format JSON
  bot.command('myinfo', async (ctx) => {
    const info = {
      id: ctx.from.id,
      nama: `${ctx.from.first_name} ${ctx.from.last_name || ''}`,
      username: ctx.from.username,
      chat_id: ctx.chat.id,
      chat_tipe: ctx.chat.type
    };

    await ctx.reply(`\`\`\`json\n${JSON.stringify(info, null, 2)}\n\`\`\``, {
      parse_mode: 'Markdown'
    });
  });

  // /echo - Bot mengulang pesan yang dikirim user setelah command
  bot.command('echo', (ctx) => {
    // Ambil semua teks setelah "/echo "
    const text = ctx.message.text.split(' ').slice(1).join(' ');

    if (text) {
      ctx.reply(`${ctx.from.first_name} berkata: ${text}`);
    } else {
      ctx.reply('Gunakan: /echo [pesan]');
    }
  });

  // /stats - Tampilkan statistik pesan user (dari data memori)
  bot.command('stats', (ctx) => {
    const user = userData.get(ctx.from.id);

    if (user) {
      ctx.reply(`
📊 Statistik Anda:
• Pesan terkirim: ${user.messages_count}
• Pertama chat: ${user.first_seen.toLocaleString('id-ID')}
• Terakhir chat: ${user.last_message.toLocaleString('id-ID')}
      `);
    } else {
      ctx.reply('Belum ada statistik untuk Anda');
    }
  });

  // /debug - Tampilkan debug info untuk developer
  bot.command('debug', (ctx) => {
    const debugInfo = {
      user: { id: ctx.from.id, name: ctx.from.first_name },
      chat: { id: ctx.chat.id, type: ctx.chat.type },
      message: { id: ctx.message.message_id, text: ctx.message.text }
    };

    ctx.reply(`\`\`\`json\n${JSON.stringify(debugInfo, null, 2)}\n\`\`\``, {
      parse_mode: 'Markdown'
    });
  });

  // /avatar - Tampilkan foto profil user
  bot.command('avatar', async (ctx) => {
    try {
      const photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id);

      if (photos.total_count > 0) {
        // Ambil foto pertama, resolusi pertama
        await ctx.replyWithPhoto(photos.photos[0][0].file_id, {
          caption: '📸 Foto profil Anda!'
        });
      } else {
        ctx.reply('Anda belum memiliki foto profil.');
      }
    } catch (error) {
      console.error('Error:', error);
      ctx.reply('Gagal mengambil foto profil.');
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
    }
  });

}
