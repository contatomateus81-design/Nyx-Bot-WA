import { registerCommand } from '../handler.js';
import { config } from '../config.js';
import { getAccessRegistry, setAccessStatus } from '../store.js';

function targetNumber(args) {
  return String(args[0] ?? '').replace(/\D/g, '');
}
function validNumber(number) {
  return number.length >= 10 && number.length <= 15;
}
function usage(command, ctx) {
  return ctx.reply(`Uso: ${config.prefix}${command} número com DDI. Ex.: ${config.prefix}${command} 5511999999999`);
}

registerCommand({
  name: 'aprovar',
  role: 'dono',
  async execute(ctx) {
    if (!ctx.isOfficialOwner) return ctx.reply('🔒 Somente o proprietário oficial pode gerenciar cadastros.');
    const number = targetNumber(ctx.args);
    if (!validNumber(number)) return usage('aprovar', ctx);
    await setAccessStatus(number, 'authorized');
    return ctx.reply(`✅ O número +${number} foi autorizado.`);
  },
});

registerCommand({
  name: 'recusar',
  role: 'dono',
  async execute(ctx) {
    if (!ctx.isOfficialOwner) return ctx.reply('🔒 Somente o proprietário oficial pode gerenciar cadastros.');
    const number = targetNumber(ctx.args);
    if (!validNumber(number)) return usage('recusar', ctx);
    await setAccessStatus(number, 'denied');
    return ctx.reply(`Solicitação de +${number} recusada. Um novo pedido ficará pendente para sua aprovação.`);
  },
});

registerCommand({
  name: 'acesso-remover',
  aliases: ['removeracesso'],
  role: 'dono',
  async execute(ctx) {
    if (!ctx.isOfficialOwner) return ctx.reply('🔒 Somente o proprietário oficial pode gerenciar cadastros.');
    const number = targetNumber(ctx.args);
    if (!validNumber(number)) return usage('acesso-remover', ctx);
    await setAccessStatus(number, 'pending');
    return ctx.reply(`🔐 O acesso de +${number} foi removido. Um novo cadastro exigirá sua aprovação.`);
  },
});

registerCommand({
  name: 'bloquear',
  role: 'dono',
  async execute(ctx) {
    if (!ctx.isOfficialOwner) return ctx.reply('🔒 Somente o proprietário oficial pode gerenciar cadastros.');
    const number = targetNumber(ctx.args);
    if (!validNumber(number)) return usage('bloquear', ctx);
    await setAccessStatus(number, 'blocked');
    return ctx.reply(`⛔ O número +${number} foi bloqueado.`);
  },
});

registerCommand({
  name: 'desbloquear',
  role: 'dono',
  async execute(ctx) {
    if (!ctx.isOfficialOwner) return ctx.reply('🔒 Somente o proprietário oficial pode gerenciar cadastros.');
    const number = targetNumber(ctx.args);
    if (!validNumber(number)) return usage('desbloquear', ctx);
    await setAccessStatus(number, 'pending');
    return ctx.reply(`🔓 O bloqueio de +${number} foi retirado. O acesso continua pendente de aprovação.`);
  },
});

registerCommand({
  name: 'usuarios',
  aliases: ['listausuarios'],
  role: 'dono',
  async execute(ctx) {
    if (!ctx.isOfficialOwner) return ctx.reply('🔒 Somente o proprietário oficial pode gerenciar cadastros.');
    const registry = await getAccessRegistry();
    const section = (title, values) => [`* ${title} (${values.length})`, ...(values.length ? values.map(number => `• +${number}`) : ['• Nenhum'])].join('\n');
    return ctx.reply(['💜 *CONTROLE DE ACESSO*', '', section('Autorizados', registry.authorized), '', section('Pendentes', registry.pending), '', section('Bloqueados', registry.blocked), '', section('Recusados', registry.denied)].join('\n'));
  },
});

registerCommand({
  name: 'cadastrar',
  aliases: ['logar'],
  role: 'membro',
  async execute() {
    // Registration is handled centrally in handler.js before normal command execution.
  },
});
