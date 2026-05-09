import { Markup } from "telegraf";
import {
  ensureUserExists,
  getUserProfile,
  getUserGameAccounts,
  getAllGameAccounts,
  updateAccountStatus,
  isAdmin,
  getUserPendingWithdrawals,
  getUserWithdrawalHistory,
  getAllWithdrawals,
  updateWithdrawalStatus,
} from "./database.js";
import { userData, adminSessions } from "./state.js";

function buildMainMenu() {
  return Markup.keyboard([["/setor"], ["/wd"], ["/cancel"], ["/myprofile"], ["/menu"]]).resize();
}

export function registerCommands(bot) {
  // /start - Info user saat pertama kali pakai bot
  bot.start(async (ctx) => {
    // Simpan user ke database secara background (tidak tunggu)
    ensureUserExists(ctx).catch((err) => console.error("DB error:", err));

    await ctx.reply(
      `
👋 Halo ${ctx.from.first_name}!

📱 Info Anda:
• ID: ${ctx.from.id}
• Username: ${ctx.from.username ? "@" + ctx.from.username : "Tidak ada"}
• Chat ID: ${ctx.chat.id}

Pilih command di bawah ini:
    `,
      buildMainMenu(),
    );
  });

  // /menu - Tampilkan menu utama dengan tombol
  bot.command("menu", async (ctx) => {
    await ctx.reply(
      `📋 *Menu Utama*\n\n` +
        `/setor — Setor email\n` +
        `/wd — Withdraw saldo\n` +
        `/cancel — Batalkan proses\n` +
        `/myprofile — Lihat profil dan saldo Anda\n` +
        `/menu — Tampilkan menu ini`,
      {
        parse_mode: "Markdown",
        ...buildMainMenu(),
      },
    );
  });

  // /myprofile - Tampilkan profil user dan saldo
  bot.command("myprofile", async (ctx) => {
    try {
      const profile = await getUserProfile(ctx.from.id);
      const accounts = await getUserGameAccounts(ctx.from.id);

      const balance = profile.balance ? Number(profile.balance).toLocaleString("id-ID") : "0";
      const totalEmails = accounts.length;

      await ctx.reply(
        `👤 *Profil Anda*\n\n` +
          `• Nama: \`${profile.name}\`\n` +
          `• Username: \`${profile.username ? "@" + profile.username : "Tidak ada"}\`\n` +
          `• Saldo: \`Rp ${balance}\`\n` +
          `• Terdaftar sejak: \`${new Date(profile.created_at).toLocaleDateString("id-ID")}\`\n` +
          `• Total Email: \`${totalEmails}\``,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("📧 Riwayat Email", "profile:emails")],
            [Markup.button.callback("💳 Riwayat WD", "profile:wd")],
          ]),
        },
      );
    } catch (err) {
      console.error("Error fetching profile:", err);
      await ctx.reply("❌ Gagal mengambil data profil. Coba lagi.");
    }
  });

  bot.action("profile:emails", async (ctx) => {
    try {
      const accounts = await getUserGameAccounts(ctx.from.id);

      if (accounts.length === 0) {
        return ctx.answerCbQuery("📭 Belum ada email yang disetor.");
      }

      let message = `📧 *Riwayat Email*\n\n`;
      accounts.forEach((acc, i) => {
        const statusEmoji =
          acc.status === "pending" ? "⏳" : acc.status === "approved" ? "✅" : "❌";
        message += `${i + 1}. \`${acc.email}\` — ${statusEmoji} *${acc.status}*\n`;
      });

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Kembali", "myprofile:back")],
        ]).reply_markup,
      });
    } catch (err) {
      console.error("Error fetching email history:", err);
      await ctx.answerCbQuery("❌ Gagal memuat riwayat email.");
    }
  });

  bot.action("profile:wd", async (ctx) => {
    try {
      const history = await getUserWithdrawalHistory(ctx.from.id);

      if (history.length === 0) {
        return ctx.answerCbQuery("📭 Belum ada riwayat withdraw.");
      }

      let message = `💳 *Riwayat Withdraw*\n\n`;
      history.forEach((wd, i) => {
        const statusEmoji =
          wd.status === "pending" ? "⏳" : wd.status === "approved" ? "✅" : "❌";
        const date = new Date(wd.created_at).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        message +=
          `*#${wd.id}* | ${statusEmoji} *${wd.status}*\n` +
          `Bank: \`${wd.bank_name}\` | A/n: \`${wd.account_name}\`\n` +
          `No: \`${wd.account_number}\` | Rp ${Number(wd.amount).toLocaleString("id-ID")}\n` +
          `Tanggal: \`${date}\`\n`;
        if (wd.status === "rejected" && wd.note) {
          message += `Alasan: \`${wd.note}\`\n`;
        }
        message += `\n`;
      });

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Kembali", "myprofile:back")],
        ]).reply_markup,
      });
    } catch (err) {
      console.error("Error fetching withdrawal history:", err);
      await ctx.answerCbQuery("❌ Gagal memuat riwayat withdraw.");
    }
  });

  bot.action("myprofile:back", async (ctx) => {
    try {
      const profile = await getUserProfile(ctx.from.id);
      const accounts = await getUserGameAccounts(ctx.from.id);
      const balance = profile.balance ? Number(profile.balance).toLocaleString("id-ID") : "0";
      const totalEmails = accounts.length;

      await ctx.editMessageText(
        `👤 *Profil Anda*\n\n` +
          `• Nama: \`${profile.name}\`\n` +
          `• Username: \`${profile.username ? "@" + profile.username : "Tidak ada"}\`\n` +
          `• Saldo: \`Rp ${balance}\`\n` +
          `• Terdaftar sejak: \`${new Date(profile.created_at).toLocaleDateString("id-ID")}\`\n` +
          `• Total Email: \`${totalEmails}\``,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("📧 Riwayat Email", "profile:emails")],
            [Markup.button.callback("💳 Riwayat WD", "profile:wd")],
          ]),
        },
      );
    } catch (err) {
      console.error("Error fetching profile:", err);
      await ctx.answerCbQuery("❌ Gagal memuat profil.");
    }
  });

  // /setor - Mulai proses setor akun game (2 step)
  // User harus lewat 2 tahap: (1) kirim akun, (2) kirim harga
  bot.command("setor", async (ctx) => {
    // Import setorSessions dari state.js karena ini dynamic import
    const { setorSessions } = await import("./state.js");

    // Buat session untuk user ini dengan step 'account'
    // Artinya: user sekarang masuk mode setor, belum kirim apa-apa
    setorSessions.set(ctx.from.id, {
      step: "account",
    });

    await ctx.reply(
      `📥 *Setor Email*\n\n` +
        `*Step 1/2:* Kirim email dan password:\n` +
        `Format: \`gmail;password\`\n\n` +
        `Contoh: \`example@gmail.com;mypassword\`\n\n` +
        `Ketik /cancel untuk batal.`,
      { parse_mode: "Markdown" },
    );
  });

  // /cancel - Batalkan mode setor
  // Kalau user ada di session, hapus session-nya
  bot.command("cancel", async (ctx) => {
    const { setorSessions, wdSessions } = await import("./state.js");

    if (setorSessions.has(ctx.from.id)) {
      setorSessions.delete(ctx.from.id);
      await ctx.reply("❌ Proses setor dibatalkan.");
    } else if (wdSessions.has(ctx.from.id)) {
      wdSessions.delete(ctx.from.id);
      await ctx.reply("❌ Proses withdraw dibatalkan.");
    } else if (adminSessions.has(ctx.from.id)) {
      adminSessions.delete(ctx.from.id);
      await ctx.reply("❌ Proses admin dibatalkan.");
    } else {
      await ctx.reply("Tidak ada proses yang sedang berjalan.");
    }
  });

  bot.command("wd", async (ctx) => {
    const { wdSessions } = await import("./state.js");

    if (wdSessions.has(ctx.from.id)) {
      return ctx.reply("⚠️ Anda sudah dalam proses withdraw. Ketik /cancel untuk membatalkan.");
    }

    const profile = await getUserProfile(ctx.from.id);
    const balance = Number(profile.balance) || 0;

    await ctx.reply(
      `💰 *Withdraw Saldo*\n\n` +
        `Saldo Anda: \`Rp ${balance.toLocaleString("id-ID")}\`\n\n` +
        `Pilih opsi di bawah:`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("💸 WD Now", "wd:now")],
          [Markup.button.callback("📋 Cek Riwayat WD", "wd:history")],
        ]),
      },
    );
  });

  bot.action("wd:now", async (ctx) => {
    const { wdSessions } = await import("./state.js");

    const profile = await getUserProfile(ctx.from.id);
    const balance = Number(profile.balance) || 0;

    if (balance < 10000) {
      return ctx.answerCbQuery("❌ Saldo tidak mencukupi! Minimal WD Rp 10.000");
    }

    await ctx.deleteMessage();

    wdSessions.set(ctx.from.id, {
      step: "bank_name",
    });

    await ctx.reply(
      `💰 *Withdraw Saldo*\n\n` +
        `Saldo Anda: \`Rp ${balance.toLocaleString("id-ID")}\`\n\n` +
        `*Step 1/4:* Masukkan *Nama Bank / E-Wallet* Anda:\n\n` +
        `Contoh: \`BCA\`, \`GoPay\`, \`DANA\`\n\n` +
        `Ketik /cancel untuk batal.`,
      { parse_mode: "Markdown" },
    );
  });

  bot.action("wd:history", async (ctx) => {
    const history = await getUserWithdrawalHistory(ctx.from.id);

    if (history.length === 0) {
      return ctx.answerCbQuery("📭 Belum ada riwayat withdraw.");
    }

    let message = `📋 *Riwayat Withdraw*\n\n`;

    history.forEach((wd, i) => {
      const statusEmoji = wd.status === "pending" ? "⏳" : wd.status === "approved" ? "✅" : "❌";
      const date = new Date(wd.created_at).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      message += `*#${wd.id}* | ${statusEmoji} *${wd.status}*\n`;
      message += `Nominal: \`Rp ${Number(wd.amount).toLocaleString("id-ID")}\`\n`;
      message += `Tanggal: \`${date}\`\n`;
      if (wd.status === "rejected" && wd.note) {
        message += `Alasan: \`${wd.note}\`\n`;
      }
      message += `\n`;
    });

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback("🔙 Kembali", "wd:back")]])
        .reply_markup,
    });
  });

  bot.action("wd:back", async (ctx) => {
    const { wdSessions } = await import("./state.js");

    if (wdSessions.has(ctx.from.id)) {
      return ctx.answerCbQuery("⚠️ Anda sedang dalam proses withdraw.");
    }

    const profile = await getUserProfile(ctx.from.id);
    const balance = Number(profile.balance) || 0;

    await ctx.editMessageText(
      `💰 *Withdraw Saldo*\n\n` +
        `Saldo Anda: \`Rp ${balance.toLocaleString("id-ID")}\`\n\n` +
        `Pilih opsi di bawah:`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("💸 WD Now", "wd:now")],
          [Markup.button.callback("📋 Cek Riwayat WD", "wd:history")],
        ]),
      },
    );
  });

  // /admin - Admin panel untuk manage semua akun
  bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      return ctx.reply("❌ Akses ditolak. Hanya untuk admin.");
    }

    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback("📋 Semua Email", "admin:filter:all")],
      [Markup.button.callback("⏳ Pending", "admin:filter:pending")],
      [Markup.button.callback("✅ Approved", "admin:filter:approved")],
      [Markup.button.callback("❌ Rejected", "admin:filter:rejected")],
      [Markup.button.callback("💳 Users Withdrawals", "admin:wd")],
    ]);

    await ctx.reply("📋 *Admin Panel*\n\nPilih kategori:", {
      parse_mode: "Markdown",
      ...buttons,
    });
  });

  // Handle filter callback
  bot.action(/^admin:filter:(all|pending|approved|rejected)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Akses ditolak.");
    const filter = ctx.match[1];
    const editable = filter === "all" || filter === "pending";

    try {
      const accounts = await getAllGameAccounts(filter);

      if (accounts.length === 0) {
        return ctx.answerCbQuery("📭 Tidak ada akun.");
      }

      const labels = {
        all: "Semua",
        pending: "Pending",
        approved: "Approved",
        rejected: "Rejected",
      };
      let message = `📋 *${labels[filter]} — ${accounts.length} Akun*\n\n`;

      accounts.forEach((acc) => {
        const statusEmoji =
          acc.status === "pending" ? "⏳" : acc.status === "approved" ? "✅" : "❌";
        message += `*#${acc.id}* | \`${acc.email}\` | ${statusEmoji} *${acc.status}*\n`;
        message += `Level: \`${acc.level}\` | Auth: \`${acc.authenticator || "-"}\`\n\n`;
      });

      let actionButtons = [];

      if (editable) {
        actionButtons = accounts
          .filter((acc) => acc.status === "pending")
          .map((acc) => {
            return [
              Markup.button.callback(`✅ Approve #${acc.id}`, `admin:approve:${acc.id}`),
              Markup.button.callback(`❌ Reject #${acc.id}`, `admin:reject:${acc.id}`),
            ];
          });
      }

      actionButtons.push([Markup.button.callback("🔙 Kembali", "admin:back")]);

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(actionButtons).reply_markup,
      });
    } catch (err) {
      console.error("Error in admin filter:", err);
      await ctx.answerCbQuery("❌ Gagal memuat data.");
    }
  });

  // Handle back to menu
  bot.action("admin:back", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Akses ditolak.");
    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback("📋 Semua Email", "admin:filter:all")],
      [Markup.button.callback("⏳ Pending", "admin:filter:pending")],
      [Markup.button.callback("✅ Approved", "admin:filter:approved")],
      [Markup.button.callback("❌ Rejected", "admin:filter:rejected")],
      [Markup.button.callback("💳 Users Withdrawals", "admin:wd")],
    ]);

    await ctx.editMessageText("📋 *Admin Panel*\n\nPilih kategori:", {
      parse_mode: "Markdown",
      ...buttons,
    });
  });

  // ===== ADMIN WITHDRAWALS =====

  bot.action("admin:wd", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Akses ditolak.");
    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback("📋 Semua WD", "admin:wd:filter:all")],
      [Markup.button.callback("⏳ Pending", "admin:wd:filter:pending")],
      [Markup.button.callback("✅ Approved", "admin:wd:filter:approved")],
      [Markup.button.callback("❌ Rejected", "admin:wd:filter:rejected")],
      [Markup.button.callback("🔙 Kembali", "admin:back")],
    ]);

    await ctx.editMessageText("💳 *Withdrawals*\n\nPilih status:", {
      parse_mode: "Markdown",
      ...buttons,
    });
  });

  bot.action(/^admin:wd:filter:(all|pending|approved|rejected)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Akses ditolak.");
    const filter = ctx.match[1];

    try {
      const withdrawals = await getAllWithdrawals(filter);

      if (withdrawals.length === 0) {
        return ctx.answerCbQuery("📭 Tidak ada withdrawal.");
      }

      const labels = {
        all: "Semua",
        pending: "Pending",
        approved: "Approved",
        rejected: "Rejected",
      };
      let message = `💳 *${labels[filter]} — ${withdrawals.length} Withdrawal*\n\n`;

      withdrawals.forEach((wd) => {
        const statusEmoji =
          wd.status === "pending" ? "⏳" : wd.status === "approved" ? "✅" : "❌";
        const date = new Date(wd.created_at).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        message +=
          `*#${wd.id}* | ${statusEmoji} *${wd.status}*\n` +
          `Bank: \`${wd.bank_name}\` | A/n: \`${wd.account_name}\`\n` +
          `No: \`${wd.account_number}\` | Rp ${Number(wd.amount).toLocaleString("id-ID")}\n` +
          `Tanggal: \`${date}\`\n`;
        if (wd.status === "rejected" && wd.note) {
          message += `Alasan: \`${wd.note}\`\n`;
        }
        message += `\n`;
      });

      let actionButtons = [];

      if (filter === "pending" || filter === "all") {
        actionButtons = withdrawals
          .filter((wd) => wd.status === "pending")
          .map((wd) => {
            return [
              Markup.button.callback(`✅ Approve #${wd.id}`, `admin:wd:approve:${wd.id}`),
              Markup.button.callback(`❌ Reject #${wd.id}`, `admin:wd:reject:${wd.id}`),
            ];
          });
      }

      actionButtons.push([Markup.button.callback("🔙 Kembali", "admin:wd")]);

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(actionButtons).reply_markup,
      });
    } catch (err) {
      console.error("Error in admin wd filter:", err);
      await ctx.answerCbQuery("❌ Gagal memuat data.");
    }
  });

  bot.action(/^admin:wd:approve:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Akses ditolak.");
    const withdrawalId = parseInt(ctx.match[1]);

    try {
      await updateWithdrawalStatus(withdrawalId, "approved");
      await ctx.answerCbQuery(`✅ WD #${withdrawalId} disetujui!`);

      const all = await getAllWithdrawals();
      let message = `💳 *Semua — ${all.length} Withdrawal*\n\n`;

      all.forEach((wd) => {
        const statusEmoji =
          wd.status === "pending" ? "⏳" : wd.status === "approved" ? "✅" : "❌";
        const date = new Date(wd.created_at).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        message +=
          `*#${wd.id}* | ${statusEmoji} *${wd.status}*\n` +
          `Bank: \`${wd.bank_name}\` | A/n: \`${wd.account_name}\`\n` +
          `No: \`${wd.account_number}\` | Rp ${Number(wd.amount).toLocaleString("id-ID")}\n` +
          `Tanggal: \`${date}\`\n`;
        if (wd.status === "rejected" && wd.note) {
          message += `Alasan: \`${wd.note}\`\n`;
        }
        message += `\n`;
      });

      const actionButtons = all
        .filter((wd) => wd.status === "pending")
        .map((wd) => {
          return [
            Markup.button.callback(`✅ Approve #${wd.id}`, `admin:wd:approve:${wd.id}`),
            Markup.button.callback(`❌ Reject #${wd.id}`, `admin:wd:reject:${wd.id}`),
          ];
        });

      actionButtons.push([Markup.button.callback("🔙 Kembali", "admin:wd")]);

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(actionButtons).reply_markup,
      });
    } catch (err) {
      console.error("Error approving withdrawal:", err);
      await ctx.answerCbQuery("❌ Gagal approve withdrawal.");
    }
  });

  bot.action(/^admin:wd:reject:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Akses ditolak.");
    const withdrawalId = parseInt(ctx.match[1]);

    adminSessions.set(ctx.from.id, {
      action: "reject_withdrawal",
      withdrawalId,
    });

    await ctx.deleteMessage();

    await ctx.reply(
      `✏️ *Masukkan Alasan Penolakan*\n\n` +
        `WD #${withdrawalId} akan ditolak. Ketik alasan penolakan:\n\n` +
        `Ketik /cancel untuk batal.`,
      { parse_mode: "Markdown" },
    );
  });

  bot.action(/^admin:wd:view:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Akses ditolak.");
    const withdrawalId = parseInt(ctx.match[1]);

    try {
      const allWithdrawals = await getAllWithdrawals();
      const wd = allWithdrawals.find((w) => w.id === withdrawalId);

      if (!wd) {
        return ctx.answerCbQuery("❌ Withdrawal tidak ditemukan.");
      }

      const statusEmoji =
        wd.status === "pending" ? "⏳" : wd.status === "approved" ? "✅" : "❌";
      const date = new Date(wd.created_at).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      let message =
        `💳 *Detail Withdrawal #${wd.id}*\n\n` +
        `• Status: ${statusEmoji} *${wd.status}*\n` +
        `• Bank: \`${wd.bank_name}\`\n` +
        `• A/N: \`${wd.account_name}\`\n` +
        `• No: \`${wd.account_number}\`\n` +
        `• Amount: \`Rp ${Number(wd.amount).toLocaleString("id-ID")}\`\n` +
        `• Tanggal: \`${date}\`\n`;

      if (wd.note) {
        message += `• Catatan: \`${wd.note}\`\n`;
      }

      let actionButtons = [];

      if (wd.status === "pending") {
        actionButtons.push([
          Markup.button.callback("✅ Approve", `admin:wd:approve:${wd.id}`),
          Markup.button.callback("❌ Reject", `admin:wd:reject:${wd.id}`),
        ]);
      }

      actionButtons.push([Markup.button.callback("🔙 Kembali", "admin:wd:filter:all")]);

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(actionButtons).reply_markup,
      });
    } catch (err) {
      console.error("Error viewing withdrawal:", err);
      await ctx.answerCbQuery("❌ Gagal memuat detail withdrawal.");
    }
  });

  // Handle callback dari tombol approve/reject
  bot.action(/^admin:(approve|reject):(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Akses ditolak.");
    const [, action, accountId] = ctx.match;
    const status = action === "approve" ? "approved" : "rejected";
    const userId = ctx.from.id;

    try {
      await updateAccountStatus(parseInt(accountId), status, userId);
      await ctx.answerCbQuery(`✅ Akun ${action === "approve" ? "disetujui" : "ditolak"}!`);

      // Go back to pending filter view
      const pending = await getAllGameAccounts("pending");

      if (pending.length === 0) {
        return ctx.editMessageText("📭 *Tidak ada akun pending*", {
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Kembali", "admin:back")],
          ]).reply_markup,
        });
      }

      let message = `📋 *Pending — ${pending.length} Akun*\n\n`;

      pending.forEach((acc) => {
        const statusEmoji =
          acc.status === "pending" ? "⏳" : acc.status === "approved" ? "✅" : "❌";
        message += `*#${acc.id}* | \`${acc.email}\` | ${statusEmoji} *${acc.status}*\n`;
        message += `Level: \`${acc.level}\` | Auth: \`${acc.authenticator || "-"}\`\n\n`;
      });

      const actionButtons = pending.map((acc) => {
        return [
          Markup.button.callback(`✅ Approve #${acc.id}`, `admin:approve:${acc.id}`),
          Markup.button.callback(`❌ Reject #${acc.id}`, `admin:reject:${acc.id}`),
        ];
      });

      actionButtons.push([Markup.button.callback("🔙 Kembali", "admin:back")]);

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(actionButtons).reply_markup,
      });
    } catch (err) {
      console.error("Error updating status:", err);
      await ctx.answerCbQuery("❌ Gagal update status.");
    }
  });
}
