import { isValidGmail } from '../helpers/helper.js';
import { ensureUserExists, upsertGameAccount, updateAccountPrice } from './database.js';
import { userData, setorSessions } from './state.js';

// Track user setiap ada pesan masuk
// Setiap user yang chat, datanya disimpan di memori (userData Map)
function trackUser(ctx) {
  const userId = ctx.from.id;

  // Kalau user belum pernah chat, buat data baru
  if (!userData.has(userId)) {
    userData.set(userId, {
      first_seen: new Date(),
      name: ctx.from.first_name,
      username: ctx.from.username,
      chat_id: ctx.chat.id,
      messages_count: 0
    });
  }

  // Update jumlah pesan dan waktu terakhir chat
  const user = userData.get(userId);
  user.messages_count++;
  user.last_message = new Date();
}

export function registerTextHandler(bot) {

  // Handler ini jalan setiap kali user kirim pesan teks
  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    // Step 1: Track user dan simpan ke database
    // Setiap pesan selalu update data tracking
    trackUser(ctx);
    ensureUserExists(ctx).catch(err => console.error('DB error:', err));

    // Step 2: Cek apakah user sedang dalam mode setor
    // setorSessions berisi semua user yang sudah ketik /setor
    // Kalau user ada di sini, pesannya diproses sebagai data setor
    if (setorSessions.has(userId)) {
      const session = setorSessions.get(userId);

      // --- STEP A: Terima email;password ---
      // session.step === 'account' artinya user baru mulai setor, belum kirim data
      if (session.step === 'account') {
        const parts = text.split(';');

        // Format harus punya 2 bagian: email dan password
        if (parts.length !== 2) {
          return ctx.reply(
            `❌ *Format salah!*\n\n` +
            `Gunakan format: \`gmail;password\`\n` +
            `Contoh: \`example@gmail.com;mypassword\``,
            { parse_mode: 'Markdown' }
          );
        }

        const accountId = parts[0].trim();
        const level = parts[1].trim();
        const isEmail = isValidGmail(accountId);
        // Email dan password tidak boleh kosong
        if (!isEmail) {
          return ctx.reply(
            `❌ *Format email salah!*\n\n` +
            'gunakan format email yg benar exampleemail@gmail.com',
            { parse_mode: 'Markdown' }
          )
        }
        if (!accountId || !level) {
          return ctx.reply(
            `❌ *Format salah!*\n\n` +
            `Email dan password tidak boleh kosong.`,
            { parse_mode: 'Markdown' }
          );
        }

        try {
          // Simpan akun ke database (baru atau update)
          const data = await upsertGameAccount(accountId, level);

          // Update session ke step berikutnya
          // Sekarang session tau: user sudah kirim akun, tinggal tanya harga
          setorSessions.set(userId, {
            step: 'authenticator',              // pindah ke step harga
            accountId: accountId,       // simpan email untuk nanti
            level: level,               // simpan password untuk nanti
            isNew: data.isNew           // flag: akun baru atau update
          });

          await ctx.reply(
            `✅ Akun berhasil disetor!\n\n` +
            `• Email: \`${accountId}\`\n` +
            `• Password: \`${level}\`\n\n` +
            `*Masukan Kunci Rahasia 2FA,Bila tidak mengerti dimana mendapatkan Kunci Rahasia 2FA ikuti panduan video ini*\n\n` +
            `Ketik /cancel untuk batal.`,
            { parse_mode: 'Markdown' }
          );
        } catch (err) {
          console.error('Error:', err);
          return ctx.reply('❌ Terjadi kesalahan. Coba lagi.');
        }
        return; // Stop di sini, jangan lanjut ke handler biasa
      }

      // --- STEP B: Terima harga ---
      // session.step === 'price' artinya user sudah kirim akun, sekarang kirim harga
      if (session.step === 'authenticator') {
        const price = parseInt(text);

        // Harga harus angka dan lebih dari 0
        if (isNaN(price) || price <= 0) {
          return ctx.reply(
            `❌ *Format salah!*\n\n` +
            `Kirim harga dalam angka (contoh: \`50000\`).`,
            { parse_mode: 'Markdown' }
          );
        }

        try {
          // Update harga ke database pakai accountId yang disimpan di step sebelumnya
          await updateAccountPrice(session.accountId, price);

          // Hapus session karena proses setor sudah selesai total
          // User sekarang keluar dari mode setor
          setorSessions.delete(userId);

          await ctx.reply(
            `✅ *Akun selesai disetor!*\n\n` +
            `• Email: \`${session.accountId}\`\n` +
            `• Password: \`${session.level}\`\n` +
            // `• Harga: \`${price.toLocaleString('id-ID')}\`\n\n` +
            `${session.isNew ? ' Akun baru berhasil ditambahkan dan akan ditinjau oleh admin ' : '🔄 Akun lama berhasil diperbarui!, akun akan di tinjau oleh admin'}`,
            { parse_mode: 'Markdown' }
          );
        } catch (err) {
          console.error('Error:', err);
          return ctx.reply('❌ Gagal menyimpan harga. Coba lagi.');
        }

        return;
      }
    }

    // Step 3: Handler untuk pesan biasa (bukan mode setor)
    // Kalau user TIDAK di setorSessions, pesannya diproses sebagai pesan biasa
    if (!text.startsWith('/')) {
      if (ctx.chat.type !== 'private') {
        // Di grup: tampilkan siapa yang chat dan apa isinya
        ctx.reply(`${ctx.from.first_name} di grup ${ctx.chat.title}: ${text}`);
      } else {
        // Di private: ulangi pesan user
        ctx.reply(`Pesan Anda: ${text}`);
      }
    }
  });

}
