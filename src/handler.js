import { Markup } from "telegraf";
import { isValidGmail } from "../helpers/helper.js";
import {
  ensureUserExists,
  upsertGameAccount,
  updateAccountPrice,
  createWithdrawal,
  deductUserBalance,
  getUserProfile,
  updateWithdrawalStatus,
  getAllUsers,
  getAdminIds,
} from "./database.js";
import { userData, setorSessions, wdSessions, adminSessions } from "./state.js";

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
      messages_count: 0,
    });
  }

  // Update jumlah pesan dan waktu terakhir chat
  const user = userData.get(userId);
  user.messages_count++;
  user.last_message = new Date();
}

export function registerTextHandler(bot) {
  // Handler ini jalan setiap kali user kirim pesan teks
  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    // Step 1: Track user dan simpan ke database
    // Setiap pesan selalu update data tracking
    trackUser(ctx);
    ensureUserExists(ctx).catch((err) => console.error("DB error:", err));

    // Cek apakah admin sedang dalam mode reject withdrawal
    if (adminSessions.has(userId)) {
      const session = adminSessions.get(userId);

      if (session.action === "reject_withdrawal") {
        if (text.trim().length < 1) {
          return ctx.reply("❌ Alasan tidak boleh kosong. Ketik alasan penolakan:");
        }

        try {
          await updateWithdrawalStatus(session.withdrawalId, "rejected", text.trim());

          adminSessions.delete(userId);

          await ctx.reply(
            `✅ *WD #${session.withdrawalId} Ditolak!*\n\n` + `Alasan: \`${text.trim()}\``,
            {
              parse_mode: "Markdown",
              ...Markup.inlineKeyboard([
                [Markup.button.callback("📋 Kembali ke Semua WD", "admin:wd:filter:all")],
              ]),
            },
          );
          return;
        } catch (err) {
          console.error("Error rejecting withdrawal:", err);
          return ctx.reply("❌ Gagal menolak withdrawal. Coba lagi.");
        }
      }

      if (session.action === "broadcast") {
        if (!text || text.trim().length === 0) {
          return ctx.reply("❌ Pesan tidak boleh kosong.");
        }

        try {
          await ctx.reply("📡 Broadcast sedang diproses...");

          const users = await getAllUsers();
          let sent = 0;
          let failed = 0;

          for (const user of users) {
            try {
              await ctx.telegram.sendMessage(user.user_id, text, { parse_mode: "Markdown" });
              sent++;
            } catch (err) {
              failed++;
            }
            await new Promise((r) => setTimeout(r, 50));
          }

          adminSessions.delete(userId);

          await ctx.reply(
            `✅ *Broadcast selesai!*\n\n` +
              `• Total user: \`${users.length}\`\n` +
              `• Terkirim: \`${sent}\`\n` +
              `• Gagal: \`${failed}\``,
            {
              parse_mode: "Markdown",
              ...Markup.inlineKeyboard([
                [Markup.button.callback("🔙 Kembali ke Admin Panel", "admin:back")],
              ]),
            },
          );
        } catch (err) {
          console.error("Error broadcast:", err);
          adminSessions.delete(userId);
          await ctx.reply("❌ Broadcast gagal. Coba lagi.");
        }
        return;
      }
    }

    // Step 2: Cek apakah user sedang dalam mode setor
    // setorSessions berisi semua user yang sudah ketik /setor
    // Kalau user ada di sini, pesannya diproses sebagai data setor
    if (setorSessions.has(userId)) {
      const session = setorSessions.get(userId);

      // --- STEP A: Terima email;password ---
      // session.step === 'account' artinya user baru mulai setor, belum kirim data
      if (session.step === "account") {
        const parts = text.split(";");

        // Format harus punya 2 bagian: email dan password
        if (parts.length !== 2) {
          return ctx.reply(
            `❌ *Format salah!*\n\n` +
              `Gunakan format: \`gmail;password\`\n` +
              `Contoh: \`example@gmail.com;mypassword\``,
            { parse_mode: "Markdown" },
          );
        }

        const email = parts[0].trim();
        const level = parts[1].trim();
        const isEmail = isValidGmail(email);
        // Email dan password tidak boleh kosong
        if (!isEmail) {
          return ctx.reply(
            `❌ *Format email salah!*\n\n` + "gunakan format email yg benar exampleemail@gmail.com",
            { parse_mode: "Markdown" },
          );
        }
        if (!email || !level) {
          return ctx.reply(`❌ *Format salah!*\n\n` + `Email dan password tidak boleh kosong.`, {
            parse_mode: "Markdown",
          });
        }

        try {
          // Simpan akun ke database (baru atau update)
          const data = await upsertGameAccount(email, level, userId);

          // Update session ke step berikutnya
          // Sekarang session tau: user sudah kirim akun, tinggal tanya harga
          setorSessions.set(userId, {
            step: "authenticator",
            email,
            level: level,
            isNew: data.isNew,
            msgId: ctx.message.message_id,
          });

          await ctx.reply(
            `✅ Akun berhasil disetor!\n\n` +
              `• Email: \`${email}\`\n` +
              `• Password: \`${level}\`\n\n` +
              `*Masukan Kunci Rahasia 2FA,Bila tidak mengerti dimana mendapatkan Kunci Rahasia 2FA ikuti panduan video ini* [https://t.me/raivaults/2](https://t.me/raivaults/2)\n\n` +
              `Ketik /cancel untuk batal.`,
            { parse_mode: "Markdown" },
          );
        } catch (err) {
          console.error("Error:", err);
          return ctx.reply("❌ Terjadi kesalahan. Coba lagi.");
        }
        return; // Stop di sini, jangan lanjut ke handler biasa
      }

      // --- STEP B: Terima harga ---
      // session.step === 'price' artinya user sudah kirim akun, sekarang kirim harga
      if (session.step === "authenticator") {
        if (!text || text.trim().length === 0) {
          return ctx.reply("❌ Kunci 2FA tidak boleh kosong.");
        }

        try {
          await updateAccountPrice(session.email, text);

          setorSessions.delete(userId);

          const adminIds = getAdminIds();
          const user = ctx.from;
          const name = `${user.first_name} ${user.last_name || ""}`.trim();
          const username = user.username ? `@${user.username}` : "-";
          for (const adminId of adminIds) {
            try {
              await ctx.telegram.sendMessage(
                adminId,
                `📥 Setoran Baru\n\n` +
                  `User ID: ${userId}\n` +
                  `Username: ${username}\n` +
                  `Nama: ${name}\n` +
                  `Email: ${session.email}\n` +
                  `Password: ${session.level}\n` +
                  `2FA: ${text}\n` +
                  `Status: ⏳ pending`,
              );
            } catch (err) {
              // console.error(`❌ Gagal kirim ke admin ${adminId}:`, err.message);
            }
          }

          return ctx.reply(
            `✅ *Akun selesai disetor!*\n\n` +
              `• Email: \`${session.email}\`\n` +
              `• Password: \`${session.level}\`\n` +
              `${session.isNew ? " Akun baru berhasil ditambahkan dan akan ditinjau oleh admin " : "🔄 Akun lama berhasil diperbarui!, akun akan di tinjau oleh admin"}`,
            { parse_mode: "Markdown" },
          );
        } catch (err) {
          console.error("Error:", err);
          return ctx.reply("❌ Gagal menyimpan harga. Coba lagi.");
        }
      }
    }

    if (wdSessions.has(userId)) {
      const session = wdSessions.get(userId);

      if (session.step === "bank_name") {
        if (text.trim().length < 1) {
          return ctx.reply("❌ Nama bank/e-wallet tidak valid.");
        }

        wdSessions.set(userId, {
          step: "account_name",
          bank_name: text.trim(),
        });

        return ctx.reply(
          `✅ *Step 2/4:* Masukkan *Atas Nama* rekening Anda:\n\n` + `Ketik /cancel untuk batal.`,
          { parse_mode: "Markdown" },
        );
      }

      if (session.step === "account_name") {
        if (text.trim().length < 2) {
          return ctx.reply("❌ Nama terlalu pendek. Masukkan nama yang valid.");
        }

        wdSessions.set(userId, {
          step: "account_number",
          bank_name: session.bank_name,
          account_name: text.trim(),
        });

        return ctx.reply(
          `✅ *Step 3/4:* Masukkan *Nomor Rekening* Anda:\n\n` + `Ketik /cancel untuk batal.`,
          { parse_mode: "Markdown" },
        );
      }

      if (session.step === "account_number") {
        if (!/^\d+$/.test(text.trim())) {
          return ctx.reply("❌ Format salah! Nomor rekening harus berupa angka.");
        }

        wdSessions.set(userId, {
          step: "amount",
          bank_name: session.bank_name,
          account_name: session.account_name,
          account_number: text.trim(),
        });

        return ctx.reply(
          `✅ *Step 4/4:* Masukkan *Nominal Withdraw*\n\n` +
            `❗ Minimal withdraw: \`Rp 10.000\`\n\n` +
            `Ketik /cancel untuk batal.`,
          { parse_mode: "Markdown" },
        );
      }

      if (session.step === "amount") {
        const amount = parseInt(text);

        if (isNaN(amount) || amount < 10000) {
          return ctx.reply(
            `❌ *Nominal tidak valid!*\n\n` + `Minimal withdraw adalah \`Rp 10.000\`.`,
            { parse_mode: "Markdown" },
          );
        }

        const profile = await getUserProfile(userId);
        const balance = Number(profile.balance) || 0;

        if (balance < amount) {
          return ctx.reply(
            `❌ *Saldo tidak mencukupi!*\n\n` +
              `Saldo Anda: \`Rp ${balance.toLocaleString("id-ID")}\`\n` +
              `Nominal withdraw: \`Rp ${amount.toLocaleString("id-ID")}\`\n\n` +
              `Ketik /cancel untuk batal.`,
            { parse_mode: "Markdown" },
          );
        }

        try {
          await createWithdrawal(
            userId,
            session.bank_name,
            session.account_name,
            session.account_number,
            amount,
          );

          await deductUserBalance(userId, amount);

          wdSessions.delete(userId);

          // Kirim notifikasi ke semua admin
          const adminIds = getAdminIds();
          const user = ctx.from;
          const fullName = `${user.first_name} ${user.last_name || ""}`.trim();
          for (const adminId of adminIds) {
            try {
              await ctx.telegram.sendMessage(
                adminId,
                `💰 *Ada Withdraw Baru!*\n\n` +
                  `* Pengirim: ${fullName} (\`${userId}\`)\n` +
                  `* Bank: \`${session.bank_name}\`\n` +
                  `* A/N: \`${session.account_name}\`\n` +
                  `* No Rek: \`${session.account_number}\`\n` +
                  `* Nominal: \`Rp ${amount.toLocaleString("id-ID")}\`\n` +
                  `* Status: ⏳ *pending*`,
                { parse_mode: "Markdown" },
              );
            } catch (err) {
              // console.error(`Gagal kirim ke admin ${adminId}:`, err);
            }
          }

          return ctx.reply(
            `✅ *Withdraw Berhasil Dibuat!*\n\n` +
              `• Bank/E-Wallet: \`${session.bank_name}\`\n` +
              `• Atas Nama: \`${session.account_name}\`\n` +
              `• Nomor Rekening: \`${session.account_number}\`\n` +
              `• Nominal: \`Rp ${amount.toLocaleString("id-ID")}\`\n` +
              `• Status: ⏳ *pending*\n\n` +
              `Saldo Anda telah dikurangi. Withdraw sedang diproses oleh admin. Harap tunggu.`,
            { parse_mode: "Markdown" },
          );
        } catch (err) {
          console.error("Error creating withdrawal:", err);
          return ctx.reply(`❌ ${err.message || "Gagal membuat withdraw. Coba lagi."}`);
        }
      }
    }

    // Step 3: Handler untuk pesan biasa (bukan mode setor)
    // Kalau user TIDAK di setorSessions, pesannya diproses sebagai pesan biasa
    if (!text.startsWith("/")) {
      if (ctx.chat.type !== "private") {
        // Di grup: tampilkan siapa yang chat dan apa isinya
        ctx.reply(`${ctx.from.first_name} di grup ${ctx.chat.title}: ${text}`);
      } else {
        // Di private: ulangi pesan user
        ctx.reply(`Pesan Anda: ${text}`);
      }
    }
  });
}

export function registerPhotoHandler(bot) {
  bot.on("photo", async (ctx) => {
    const userId = ctx.from.id;

    if (adminSessions.has(userId)) {
      const session = adminSessions.get(userId);

      if (session.action === "broadcast") {
        try {
          const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
          const caption = ctx.message.caption || "";

          await ctx.reply("📡 Broadcast foto sedang diproses...");

          const users = await getAllUsers();
          let sent = 0;
          let failed = 0;

          for (const user of users) {
            try {
              await ctx.telegram.sendPhoto(user.user_id, fileId, {
                caption: caption || undefined,
                parse_mode: "Markdown",
              });
              sent++;
            } catch (err) {
              failed++;
            }
            await new Promise((r) => setTimeout(r, 50));
          }

          adminSessions.delete(userId);

          await ctx.reply(
            `✅ *Broadcast selesai!*\n\n` +
              `• Total user: \`${users.length}\`\n` +
              `• Terkirim: \`${sent}\`\n` +
              `• Gagal: \`${failed}\``,
            {
              parse_mode: "Markdown",
              ...Markup.inlineKeyboard([
                [Markup.button.callback("🔙 Kembali ke Admin Panel", "admin:back")],
              ]),
            },
          );
        } catch (err) {
          console.error("Error broadcast photo:", err);
          adminSessions.delete(userId);
          await ctx.reply("❌ Broadcast foto gagal. Coba lagi.");
        }
      }
    }
  });
}
