import bot from './bot.js';
import { registerAllCommands } from './commands/index.js';
import { registerTextHandler } from './handlers/text.js';

const userData = new Map();
const setorSessions = new Map();

registerAllCommands(bot, userData, setorSessions);
registerTextHandler(bot, userData, setorSessions);

export { bot };
