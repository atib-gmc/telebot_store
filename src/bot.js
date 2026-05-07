import dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";

// Buat instance bot Telegraf
// BOT_TOKEN dibaca dari file .env
const bot = new Telegraf(process?.env.BOT_TOKEN);

// Global error handler
// Kalau ada command/handler yang error, ditangkap di sini
bot.catch((err, ctx) => {
  console.error(`Bot error:`, err);
});
export default bot;
