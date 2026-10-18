import { registerCommand } from '../handler.js';
import { config } from '../config.js';
import { getGroup, updateGroup, getUser, updateUser, listNotes, setNote, deleteNote } from '../store.js';
import { getTargetJid, getGroupContext } from '../utils.js';

async function adminContext(ctx) {
  const g = await getGroupContext(ctx.sock, ctx.message, ctx.senderJid);
  if (!g.isSenderAdmin && !ctx.isOwner) throw new Error('Somente administradores podem usar este comando.');
  if (!g.isBotAdmin) throw new Error('Preciso ser administradora do grupo para fazer isso.');
  return g;
}

registerCommand({ name: 'infogrupo', aliases: ['groupinfo'], role: 'membro', async execute(ctx) {
  const g = await getGroupContext(ctx.sock, ctx.message, ctx.senderJid);
  await ctx.reply(`📋 *${g.metadata.subject}*\\n👥 Membros: ${g.members.length}\\n👑 Criador: ${g.metadata.owner?.split('@')[0] ?? 'indisponível'}`);
}});

registerCommand({ name: 'totag', aliases: ['tagall', 'marcar'], role: 'admin', async execute(ctx) {
  const g = await getGroupContext(ctx.sock, ctx.message, ctx.senderJid);
  if (!g.isSenderAdmin && !ctx.isOwner) throw new Error('Somente administradores.');
  const mentions = g.members.map((p) => p.id);
  const msg = ctx.args.join(' ') || 'Atenção, pessoal!';
  await ctx.sock.sendMessage(g.jid, { text: `📢 ${msg}\\n${mentions.map((j) => `• @${j.split('@')[0]}`).join('\\n')}`, mentions }, { quoted: ctx.message });
}});

for (const [name, aliases, action, done] of [
  ['remover', ['kick', 'ban'], 'remove', 'Participante removido.'],
  ['promover', ['promote'], 'promote', 'Participante promovido.'],
  ['rebaixar', ['demote'], 'demote', 'Participante rebaixado.'],
]) registerCommand({ name, aliases, role: 'admin', async execute(ctx) {
  const g = await adminContext(ctx);
  const target = getTargetJid(ctx.message, ctx.args);
  if (!target) return ctx.reply(`Marque alguém ou responda à mensagem. Ex.: ${config.prefix}${name} @pessoa`);
  if (target.split('@')[0] === g.metadata.owner?.split('@')[0] && action === 'remove') throw new Error('Não posso remover o criador do grupo.');
  await ctx.sock.groupParticipantsUpdate(g.jid, [target], action);
  await ctx.reply(`✅ ${done}`);
}});

registerCommand({ name: 'link', aliases: ['linkgrupo'], role: 'admin', async execute(ctx) {
  const g = await adminContext(ctx);
  await ctx.reply(`🔗 https://chat.whatsapp.com/${await ctx.sock.groupInviteCode(g.jid)}`);
}});

registerCommand({ name: 'revogar', aliases: ['revoke', 'revogarlink'], role: 'admin', async execute(ctx) {
  const g = await adminContext(ctx);
  await ctx.sock.groupRevokeInvite(g.jid);
  await ctx.reply(`🔐 Link revogado. Use ${config.prefix}link para gerar outro.`);
}});

registerCommand({ name: 'nomegrupo', aliases: ['subject'], role: 'admin', async execute(ctx) {
  const g = await adminContext(ctx);
  const value = ctx.args.join(' ').trim();
  if (!value) return ctx.reply(`Uso: ${config.prefix}nomegrupo <nome>`);
  await ctx.sock.groupUpdateSubject(g.jid, value);
  await ctx.reply('✅ Nome atualizado.');
}});

registerCommand({ name: 'descricao', aliases: ['desc', 'descricaogrupo'], role: 'admin', async execute(ctx) {
  const g = await adminContext(ctx);
  const value = ctx.args.join(' ').trim();
  if (!value) return ctx.reply(`Uso: ${config.prefix}descricao <descrição>`);
  await ctx.sock.groupUpdateDescription(g.jid, value);
  await ctx.reply('✅ Descrição atualizada.');
}});

for (const [name, aliases, setting, success] of [
  ['fechargrupo', ['closegroup'], 'announcement', '🔒 Só administradores podem enviar mensagens.'],
  ['abrirgrupo', ['opengroup'], 'not_announcement', '🔓 Todos podem enviar mensagens.'],
]) registerCommand({ name, aliases, role: 'admin', async execute(ctx) {
  const g = await adminContext(ctx);
  await ctx.sock.groupSettingUpdate(g.jid, setting);
  await ctx.reply(success);
}});

registerCommand({ name: 'boasvindas', aliases: ['welcome'], role: 'admin', async execute(ctx) {
  const g = await getGroupContext(ctx.sock, ctx.message, ctx.senderJid);
  if (!g.isSenderAdmin && !ctx.isOwner) throw new Error('Somente administradores.');
  const current = await getGroup(g.jid);
  const arg = (ctx.args[0] ?? '').toLowerCase();
  const on = ['on', 'ligar', 'ativar', 'ativa'].includes(arg) ? true
    : ['off', 'desligar', 'desativar', 'desativa'].includes(arg) ? false
    : !current.welcome;
  await updateGroup(g.jid, { welcome: on });
  await ctx.reply(`Boas-vindas ${on ? 'ativadas 💜' : 'desativadas'}.`);
}});

registerCommand({ name: 'antilink', aliases: ['anti-link'], role: 'admin', async execute(ctx) {
  const g = await getGroupContext(ctx.sock, ctx.message, ctx.senderJid);
  if (!g.isSenderAdmin && !ctx.isOwner) throw new Error('Somente administradores.');
  const current = await getGroup(g.jid);
  const arg = (ctx.args[0] ?? '').toLowerCase();
  const on = ['on', 'ligar', 'ativar', 'ativa'].includes(arg) ? true
    : ['off', 'desligar', 'desativar', 'desativa'].includes(arg) ? false
    : !current.antiLink;
  await updateGroup(g.jid, { antiLink: on });
  await ctx.reply(`Anti-link ${on ? 'ativado 🛡️' : 'desativado'}.`);
}});

registerCommand({ name: 'nota', aliases: ['note'], role: 'admin', async execute(ctx) {
  const g = await getGroupContext(ctx.sock, ctx.message, ctx.senderJid);
  if (!g.isSenderAdmin && !ctx.isOwner) throw new Error('Somente administradores.');
  const [rawAction, key, ...rest] = ctx.args;
  const actionMap = { adicionar: 'add', add: 'add', ver: 'get', get: 'get', listar: 'list', list: 'list', apagar: 'del', excluir: 'del', del: 'del' };
  const action = actionMap[(rawAction ?? '').toLowerCase()];
  if (action === 'add' && key && rest.length) {
    await setNote(g.jid, key, rest.join(' '));
    return ctx.reply('📝 Nota salva.');
  }
  const notes = await listNotes(g.jid);
  if (action === 'get' && key) return ctx.reply(notes[key] ?? 'Nota não encontrada.');
  if (action === 'del' && key) return ctx.reply(await deleteNote(g.jid, key) ? '🗑️ Nota removida.' : 'Nota não encontrada.');
  if (action === 'list') return ctx.reply(Object.keys(notes).join('\\n') || 'Nenhuma nota salva.');
  return ctx.reply(`Uso: ${config.prefix}nota adicionar <nome> <texto> | ver <nome> | listar | apagar <nome>`);
}});

registerCommand({ name: 'aviso', aliases: ['warn'], role: 'admin', async execute(ctx) {
  const g = await getGroupContext(ctx.sock, ctx.message, ctx.senderJid);
  if (!g.isSenderAdmin && !ctx.isOwner) throw new Error('Somente administradores.');
  const target = getTargetJid(ctx.message, ctx.args);
  if (!target) return ctx.reply('Marque alguém ou responda à mensagem.');
  const key = `${g.jid}:${target}`;
  const user = await getUser(key);
  const warnings = (user.warnings ?? 0) + 1;
  await updateUser(key, { warnings });
  await ctx.reply(`⚠️ Aviso ${warnings}/3 para @${target.split('@')[0]}.`);
}});
