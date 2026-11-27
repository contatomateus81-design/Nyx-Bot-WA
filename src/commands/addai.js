import { registerCommand } from '../handler.js';
import { getGroupContext } from '../utils.js';

const META_AI = '867051314767696@bot';

registerCommand({
  name: 'addai',
  aliases: ['addmetaai', 'metaai'],
  role: 'admin',
  async execute(ctx) {
    if (!ctx.isGroup) {
      return ctx.reply('❌ Este comando só funciona em grupos.');
    }

    try {
      const group = await getGroupContext(ctx.sock, ctx.message, ctx.senderJid);

      if (!group.isSenderAdmin && !ctx.isOwner) {
        throw new Error('Somente administradores.');
      }
      if (!group.isBotAdmin) {
        throw new Error('Preciso ser administradora do grupo para fazer isso.');
      }

      await ctx.sock.groupParticipantsUpdate(group.jid, [META_AI], 'add');
      return ctx.reply('💜 Meta AI adicionada. Concorrência pra mim? Ok... 😾');
    } catch (error) {
      console.error('[addai]', error?.message ?? error);

      if (error?.message === 'Somente administradores.' ||
          error?.message === 'Preciso ser administradora do grupo para fazer isso.') {
        throw error;
      }

      return ctx.reply('Não consegui adicionar ela, ó... Nem tô feliz com isso 😹');
    }
  },
});
