import { registerCommand, runCommandForTest } from '../handler.js';
import { triggerWelcomeTest } from '../events.js';
import { config } from '../config.js';
import { addDelegatedOwner, removeDelegatedOwner } from '../store.js';
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

registerCommand({
  name: 'deldono',
  aliases: ['delowner', 'removerdono'],
  role: 'dono',
  async execute(ctx) {
    if (!ctx.isOfficialOwner) {
      return ctx.reply('🔒 Só o dono oficial do bot pode remover poderes de dono.');
    }
    const target = getTargetJid(ctx.message, ctx.args);
    if (!target || !/@(?:s\.whatsapp\.net|lid)$/.test(target)) {
      return ctx.reply(`Uso: ${config.prefix}deldono @pessoa, respondendo à mensagem dela, ou informando o número com DDI. Ex.: ${config.prefix}deldono 5511999999999`);
    }
    const targetNumber = target.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (targetNumber && targetNumber === config.ownerNumber) {
      return ctx.reply('⛔ O dono oficial não pode remover o próprio cargo por este comando.');
    }
    const result = await removeDelegatedOwner(target);
    if (!result.removed) {
      return ctx.reply('ℹ️ Essa pessoa não está na lista de donos adicionais.');
    }
    await ctx.reply(`✅ Os poderes de dono de @${target.split('@')[0]} foram removidos. Ela continua podendo usar comandos de membro e comandos administrativos se for administradora do grupo.`, [target]);
  },
});


registerCommand({
  name: 'test',
  aliases: ['triger', 'trigger'],
  role: 'dono',
  async execute(ctx) {
    const [rawTarget, ...rest] = ctx.args;
    const target = (rawTarget ?? '').toLowerCase();
    if (!target) {
      return ctx.reply(
        `🧪 Uso: ${config.prefix}test <evento ou comando> [argumentos]\\n\\n` +
        `Eventos: welcome, bemvindo, boasvindas, group-join\\n` +
        `Exemplos: ${config.prefix}test welcome\\n${config.prefix}test ping\\n\\n` +
        'Atenção: ao testar um comando normal, ele executa a ação real desse comando.'
      );
    }

    if (['welcome', 'bemvindo', 'bem-vindo', 'boasvindas', 'group-join', 'participant-add', 'add'].includes(target)) {
      if (!ctx.isGroup) return ctx.reply('ℹ️ O teste de boas-vindas só funciona dentro de um grupo.');
      await triggerWelcomeTest(ctx.sock, ctx.chatJid, ctx.senderJid);
      return;
    }

    const result = await runCommandForTest(ctx, target, rest);
    if (!result.found) {
      return ctx.reply(`❌ Não encontrei o evento ou comando "${target}". Use ${config.prefix}test para ver exemplos.`);
    }
    if (!result.blocked) {
      await ctx.reply(`✅ Teste de "${target}" executado.`);
    }
  },
});
