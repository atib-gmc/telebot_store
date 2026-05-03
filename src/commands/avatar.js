export function registerAvatar(bot) {
  bot.command('avatar', async (ctx) => {
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
}
