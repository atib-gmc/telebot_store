export function registerEcho(bot) {
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
}
