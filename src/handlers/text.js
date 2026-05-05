import { ensureUserExists } from '../helpers/user.js';
import { upsertGameAccount } from '../helpers/game-accounts.js';

export function registerTextHandler(bot, userData, setorSessions) {
  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const userName = ctx.from.first_name;
    const text = ctx.message.text;

    ensureUserExists(ctx).catch(err => console.error('DB error in text handler:', err));

    if (!userData.has(userId)) {
      userData.set(userId, {
        first_seen: new Date(),
        name: userName,
        username: ctx.from.username,
        chat_id: ctx.chat.id,
        messages_count: 0
      });
      console.log(`User baru terdeteksi: ${userName} (${userId})`);
    }

    const user = userData.get(userId);
    user.messages_count++;
    user.last_message = new Date();
    userData.set(userId, user);

    console.log('\n=== PESAN BARU ===');
    console.log(`User: ${userName} ${ctx.from.last_name || ''} (${userId})`);
    console.log(`Username: @${ctx.from.username || 'tidak ada'}`);
    console.log(`Chat ID: ${ctx.chat.id} | Tipe: ${ctx.chat.type}`);
    console.log(`Pesan: ${text}`);
    console.log(`Waktu: ${new Date(ctx.message.date * 1000).toLocaleString('id-ID')}`);
    console.log('==================\n');

    if (setorSessions && setorSessions.has(userId)) {

      const parts = text.split(';');
      if (parts.length !== 2) {
        return ctx.reply(
          `❌ *Format salah!*\n\n` +
          `Gunakan format: \`gmail;password\`\n` +
          `Contoh: \`example@gmail.com;examplepassword\``,
          { parse_mode: 'Markdown' }
        );
      }

      const accountId = parts[0].trim();
      const level = parts[1].trim();

      if (!accountId || !level) {
        return ctx.reply(
          `❌ *Format salah!*\n\n` +
          `Account ID dan level tidak boleh kosong.\n` +
          `Gunakan format: \`gmail;password\``,
          { parse_mode: 'Markdown' }
        );
      }

      try {
        const data = await upsertGameAccount(accountId, level);

        setorSessions.delete(userId);

        if (data.isNew) {
          await ctx.reply(
            `✅ *Akun baru berhasil disetor!*\n\n` +
            `• email: \`${data.account_id}\`\n` +
            `• password: \`${data.level}\``,
            { parse_mode: 'Markdown' }
          );
        } else {
          await ctx.reply(
            `🔄 *Akun sudah ada, password diperbarui!*\n\n` +
            `• email ID: \`${data.account_id}\`\n` +
            `• password baru: \`${data.level}\``,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (err) {
        console.error('Error upserting game account:', err);
        return ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
      }

      return;
    }

    if (!text.startsWith('/')) {
      if (ctx.chat.type !== 'private') {
        ctx.reply(`${userName} di grup ${ctx.chat.title}: ${text}`);
      } else {
        ctx.reply(`Pesan Anda: ${text}`);
      }
    }
  });
}
