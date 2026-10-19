import { config } from './config.js';

const commands = new Map();

export function registerCommand(command) {
  if (!command?.name || typeof command.execute !== 'function') {
    throw new TypeError('Comando inválido: informe name e execute().');
  }
  commands.set(command.name.toLowerCase(), command);
  for (const alias of command.aliases ?? []) commands.set(alias.toLowerCase(), command);
}

export async function handleMessage(sock, message) {
  const text = message.message?.conversation
    ?? message.message?.extendedTextMessage?.text
    ?? message.message?.imageMessage?.caption
    ?? message.message?.videoMessage?.caption;
  if (!text?.startsWith(config.prefix)) return;

  const senderJid = message.key.fromMe
    ? `${config.ownerNumber}@s.whatsapp.net`
    : (message.key.participant ?? message.key.remoteJid ?? '');
  const senderNumber = senderJid.split('@')[0].split(':')[0].replace(/\D/g, '');
  const isOwner = Boolean(config.ownerNumber) && senderNumber === config.ownerNumber;
  const isGroup = (message.key.remoteJid ?? '').endsWith('@g.us');
  const args = text.slice(config.prefix.length).trim().split(/\s+/);
  const name = (args.shift() ?? '').toLowerCase();
  if (!name) return;

  const command = commands.get(name);
  if (!command) return;

  const context = {
    sock, message, args, senderJid, senderNumber, isOwner, isGroup,
    chatJid: message.key.remoteJid,
    reply: (content, mentions = []) => sock.sendMessage(message.key.remoteJid, { text: String(content), ...(mentions.length ? { mentions } : {}) }, { quoted: message }),
  };

  // React to every recognized command before running it. A failed reaction must not block the command.
  try {
    await sock.sendMessage(message.key.remoteJid, { react: { text: '💜', key: message.key } });
  } catch (error) {
    console.warn('[command:reaction] Não foi possível reagir à mensagem:', error?.message ?? error);
  }

  if (command.role === 'dono' && !isOwner) {
    return context.reply('🔒 Esse comando é exclusivo do dono.');
  }
  try {
    await command.execute(context);
  } catch (error) {
    console.error(`[command:${command.name}]`, error);
    const reason = String(error?.message ?? '');
    if (/^Somente administradores(?: podem usar este comando)?\.?$/.test(reason) || reason === 'Somente administradores.') {
      await context.reply('🔒 Permissão negada! Este comando é exclusivo dos administradores do grupo (ou do dono do bot).');
      return;
    }
    if (reason === 'Preciso ser administradora do grupo para fazer isso.') {
      await context.reply('🤖 Preciso ser administradora deste grupo para executar essa ação.');
      return;
    }
    if (reason === 'Este comando só funciona em grupos.') {
      await context.reply('ℹ️ Este comando só pode ser usado em grupos.');
      return;
    }
    await context.reply('⚠️ Ocorreu um erro ao executar esse comando.');
  }
}
