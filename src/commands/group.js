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
registerCommand({ name:'groupinfo', aliases:['infogrupo'], role:'membro', async execute(ctx) {
 const g = await getGroupContext(ctx.sock, ctx.message, ctx.senderJid);
 await ctx.reply(`📋 *${g.metadata.subject}*\n👥 Membros: ${g.members.length}\n👑 Criador: ${g.metadata.owner?.split('@')[0] ?? 'indisponível'}`);
}});
registerCommand({ name:'tagall', aliases:['marcar'], role:'admin', async execute(ctx) {
 const g = await getGroupContext(ctx.sock, ctx.message, ctx.senderJid);
 if (!g.isSenderAdmin && !ctx.isOwner) throw new Error('Somente administradores.');
 const mentions = g.members.map(p => p.id); const msg = ctx.args.join(' ') || 'Atenção, pessoal!';
 await ctx.sock.sendMessage(g.jid, { text:`📢 ${msg}\n${mentions.map(j => `• @${j.split('@')[0]}`).join('\n')}`, mentions }, { quoted:ctx.message });
}});
for (const [name, alias, action, done] of [
 ['kick','ban','remove','Participante removido.'],['promote','promover','promote','Participante promovido.'],['demote','rebaixar','demote','Participante rebaixado.']
]) registerCommand({ name, aliases:[alias], role:'admin', async execute(ctx) {
 const g = await adminContext(ctx); const target = getTargetJid(ctx.message, ctx.args);
 if (!target) return ctx.reply(`Marque alguém ou responda à mensagem. Ex.: ${config.prefix}${name} @pessoa`);
 if (target.split('@')[0] === g.metadata.owner?.split('@')[0] && action === 'remove') throw new Error('Não posso remover o criador do grupo.');
 await ctx.sock.groupParticipantsUpdate(g.jid, [target], action); await ctx.reply(`✅ ${done}`);
}});
registerCommand({ name:'link', aliases:['linkgrupo'], role:'admin', async execute(ctx) { const g=await adminContext(ctx); await ctx.reply(`🔗 https://chat.whatsapp.com/${await ctx.sock.groupInviteCode(g.jid)}`); }});
registerCommand({ name:'revoke', aliases:['revogarlink'], role:'admin', async execute(ctx) { const g=await adminContext(ctx); await ctx.sock.groupRevokeInvite(g.jid); await ctx.reply('🔐 Link revogado. Use !link para gerar outro.'); }});
registerCommand({ name:'subject', aliases:['nomegrupo'], role:'admin', async execute(ctx) { const g=await adminContext(ctx); const value=ctx.args.join(' ').trim(); if(!value) return ctx.reply(`Uso: ${config.prefix}subject <nome>`); await ctx.sock.groupUpdateSubject(g.jid,value); await ctx.reply('✅ Nome atualizado.'); }});
registerCommand({ name:'desc', aliases:['descricaogrupo'], role:'admin', async execute(ctx) { const g=await adminContext(ctx); const value=ctx.args.join(' ').trim(); if(!value) return ctx.reply(`Uso: ${config.prefix}desc <descrição>`); await ctx.sock.groupUpdateDescription(g.jid,value); await ctx.reply('✅ Descrição atualizada.'); }});
for (const [name, setting, value, success] of [['closegroup','announcement',true,'🔒 Só administradores podem enviar mensagens.'],['opengroup','not_announcement',false,'🔓 Todos podem enviar mensagens.']]) registerCommand({ name, role:'admin', async execute(ctx) { const g=await adminContext(ctx); await ctx.sock.groupSettingUpdate(g.jid,setting); await ctx.reply(success); }});
registerCommand({ name:'welcome', aliases:['boasvindas'], role:'admin', async execute(ctx) { const g=await getGroupContext(ctx.sock,ctx.message,ctx.senderJid); if(!g.isSenderAdmin&&!ctx.isOwner) throw new Error('Somente administradores.'); const current=await getGroup(g.jid); const on=ctx.args[0]==='on'?true:ctx.args[0]==='off'?false:!current.welcome; await updateGroup(g.jid,{welcome:on}); await ctx.reply(`Boas-vindas ${on?'ativadas 💜':'desativadas'}.`); }});
registerCommand({ name:'antilink', aliases:['anti-link'], role:'admin', async execute(ctx) { const g=await getGroupContext(ctx.sock,ctx.message,ctx.senderJid); if(!g.isSenderAdmin&&!ctx.isOwner) throw new Error('Somente administradores.'); const current=await getGroup(g.jid); const on=ctx.args[0]==='on'?true:ctx.args[0]==='off'?false:!current.antiLink; await updateGroup(g.jid,{antiLink:on}); await ctx.reply(`Anti-link ${on?'ativado 🛡️':'desativado'}.`); }});
registerCommand({ name:'note', aliases:['nota'], role:'admin', async execute(ctx) { const g=await getGroupContext(ctx.sock,ctx.message,ctx.senderJid); if(!g.isSenderAdmin&&!ctx.isOwner) throw new Error('Somente administradores.'); const [action,key,...rest]=ctx.args; if(action==='add'&&key&&rest.length){await setNote(g.jid,key,rest.join(' '));return ctx.reply('📝 Nota salva.');} const notes=await listNotes(g.jid); if(action==='get'&&key)return ctx.reply(notes[key]??'Nota não encontrada.'); if(action==='del'&&key)return ctx.reply(await deleteNote(g.jid,key)?'🗑️ Nota removida.':'Nota não encontrada.'); if(action==='list')return ctx.reply(Object.keys(notes).join('\n')||'Nenhuma nota salva.'); return ctx.reply(`Uso: ${config.prefix}note add <nome> <texto> | get <nome> | list | del <nome>`); }});
registerCommand({ name:'warn', aliases:['aviso'], role:'admin', async execute(ctx) { const g=await getGroupContext(ctx.sock,ctx.message,ctx.senderJid); if(!g.isSenderAdmin&&!ctx.isOwner) throw new Error('Somente administradores.'); const target=getTargetJid(ctx.message,ctx.args); if(!target)return ctx.reply('Marque alguém ou responda à mensagem.'); const key=`${g.jid}:${target}`; const user=await getUser(key); const warnings=(user.warnings??0)+1; await updateUser(key,{warnings}); await ctx.reply(`⚠️ Aviso ${warnings}/3 para @${target.split('@')[0]}.`); }});
