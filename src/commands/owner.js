import { registerCommand } from '../handler.js';
import { config } from '../config.js';
import { addDelegatedOwner, getDelegatedOwners } from '../store.js';
import { getTargetJid } from '../utils.js';
registerCommand({name:'say',aliases:['dizer'],role:'dono',async execute({reply,args}){if(!args.length)return reply(`Uso: ${config.prefix}say <mensagem>`);await reply(args.join(' '));}});
registerCommand({name:'chatid',aliases:['idchat'],role:'dono',async execute({reply,chatJid}){await reply(`ID deste chat: ${chatJid}`);}});
registerCommand({name:'botname',aliases:['nomebot'],role:'dono',async execute({reply}){await reply(`Nome configurado: ${config.name}. Para mudar, edite BOT_NAME no arquivo .env e reinicie.`);}});

registerCommand({
  name: 'adddono',
  aliases: ['addowner'],
  role: 'dono',
  async execute(ctx) {
    if (!ctx.isOfficialOwner) {
      return ctx.reply('🔒 Só o dono oficial do bot pode conceder poderes de dono.');
    }
    const target = getTargetJid(ctx.message, ctx.args);
    if (!target || !/@(?:s\.whatsapp\.net|lid)$/.test(target)) {
      return ctx.reply(`Uso: ${config.prefix}adddono @pessoa, respondendo à mensagem dela, ou informando o número com DDI. Ex.: ${config.prefix}adddono 5511999999999`);
    }
    const targetNumber = target.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (targetNumber && targetNumber === config.ownerNumber) {
      return ctx.reply('👑 Esse número já é o dono oficial do bot.');
    }
    const result = await addDelegatedOwner(target);
    if (result.reason === 'exists') {
      return ctx.reply('ℹ️ Essa pessoa já tem poderes de dono.');
    }
    if (result.reason === 'limit') {
      return ctx.reply('⚠️ Limite atingido: você já tem 6 donos adicionais. Não adicionei mais ninguém.');
    }
    await ctx.reply(`👑 @${target.split('@')[0]} agora tem poderes de dono!\n\nPode usar comandos de dono, administrador e membro. Vagas utilizadas: ${result.owners.length}/6.`, [target]);
  },
});
