import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';

dotenv.config();

import { supabase } from './database.js';

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.catch((err, ctx) => {
  console.error(`Telegram Bot Error for ${ctx.updateType}:`, err);
});

async function ensureUserExists(ctx) {
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;
  const lastName = ctx.from.last_name || '';
  const username = ctx.from.username;
  const fullName = `${firstName} ${lastName}`.trim();

  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          user_id: userId,
          name: fullName,
          username: username || null,
        });

      if (insertError) {
        console.error('Error inserting user:', insertError);
      } else {
        console.log(`User baru ditambahkan ke database: ${fullName} (${userId})`);
      }
      return false;
    }

    if (error) {
      console.error('Error checking user:', error);
      return false;
    }

    console.log(`User sudah ada di database: ${fullName} (${userId})`);
    return true;
  } catch (err) {
    console.error('ensureUserExists failed:', err);
    return false;
  }
}

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;
  const lastName = ctx.from.last_name;
  const username = ctx.from.username;
  const languageCode = ctx.from.language_code;
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type;
  const messageDate = new Date(ctx.message.date * 1000);

  // DB check di background, tidak blocking reply
  ensureUserExists(ctx).catch(err => console.error('DB error in /start:', err));

  await ctx.reply(`
📱 Informasi User Anda:
• ID: ${userId}
• Nama: ${firstName} ${lastName || ''}
• Username: ${username ? '@' + username : 'Tidak ada'}
• Bahasa: ${languageCode || 'Tidak diketahui'}
• Chat ID: ${chatId}
• Tipe Chat: ${chatType}
• Waktu: ${messageDate.toLocaleString('id-ID')}
  `);
});

// Command /myinfo - tampilkan info detail
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

// Command /echo
bot.command('echo', (ctx) => {
  const text = ctx.message.text.split(' ').slice(1).join(' ');
  const userName = ctx.from.first_name;
  const userId = ctx.from.id;

  if (text) {
    ctx.reply(`${userName} (ID: ${userId}) berkata: ${text}`);
  } else {
    ctx.reply('Gunakan: /echo [pesan]');
  }
});

// Menyimpan data user dengan Map
const userData = new Map();

// Command /stats - lihat statistik user
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

// Command /debug - info detail untuk debugging
bot.command('debug', (ctx) => {
  const debugInfo = {
    user: {
      id: ctx.from.id,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
      username: ctx.from.username,
      language_code: ctx.from.language_code,
      is_bot: ctx.from.is_bot
    },
    chat: {
      id: ctx.chat.id,
      type: ctx.chat.type,
      title: ctx.chat.title || null,
      username: ctx.chat.username || null
    },
    message: {
      id: ctx.message.message_id,
      date: ctx.message.date,
      text: ctx.message.text
    },
    update_id: ctx.update.update_id
  };

  ctx.reply(`Debug Info:\n\`\`\`json\n${JSON.stringify(debugInfo, null, 2)}\n\`\`\``, {
    parse_mode: 'Markdown'
  });
});

// Command /avatar - dapatkan foto profil user
bot.command('avatar', async (ctx) => {
  console.log("command di jalankan");
  const userId = ctx.from.id;
  try {
    const photos = await ctx.telegram.getUserProfilePhotos(userId);

    if (photos.total_count > 0) {
      const fileId = photos.photos[0][0].file_id;
      await ctx.replyWithPhoto(fileId, { caption: '📸 Foto profil Anda!' });
    } else {
      ctx.reply('Anda belum memiliki foto profil.');
    }
  } catch (error) {
    console.error('Error getting avatar:', error);
    ctx.reply('Gagal mengambil foto profil.');
  }
});

// Handler untuk semua pesan teks dengan logging lengkap
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name;
  const text = ctx.message.text;

  // Cek/tambah user di database saat pertama interaksi (non-blocking)
  ensureUserExists(ctx).catch(err => console.error('DB error in text handler:', err));

  // Simpan informasi user
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

  // Update counter pesan
  const user = userData.get(userId);
  user.messages_count++;
  user.last_message = new Date();
  userData.set(userId, user);

  // Logging lengkap ke console
  console.log('\n=== PESAN BARU ===');
  console.log(`User: ${userName} ${ctx.from.last_name || ''} (${userId})`);
  console.log(`Username: @${ctx.from.username || 'tidak ada'}`);
  console.log(`Chat ID: ${ctx.chat.id} | Tipe: ${ctx.chat.type}`);
  console.log(`Pesan: ${text}`);
  console.log(`Waktu: ${new Date(ctx.message.date * 1000).toLocaleString('id-ID')}`);
  console.log('==================\n');

  // Jangan balas command
  if (!text.startsWith('/')) {
    // Di grup
    if (ctx.chat.type !== 'private') {
      const groupName = ctx.chat.title;
      ctx.reply(`${userName} di grup ${groupName}: ${text}`);
    } else {
      // Di private chat
      ctx.reply(`Pesan Anda: ${text}`);
    }
  }
});

export { bot };
