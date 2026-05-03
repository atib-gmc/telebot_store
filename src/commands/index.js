import { registerStart } from './start.js';
import { registerMyinfo } from './myinfo.js';
import { registerEcho } from './echo.js';
import { registerStats } from './stats.js';
import { registerDebug } from './debug.js';
import { registerAvatar } from './avatar.js';
import { registerSetor } from './setor.js';

export function registerAllCommands(bot, userData, setorSessions) {
  registerStart(bot);
  registerMyinfo(bot);
  registerEcho(bot);
  registerStats(bot, userData);
  registerDebug(bot);
  registerAvatar(bot);
  registerSetor(bot, setorSessions);
}
