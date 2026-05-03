export function registerDebug(bot) {
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
}
