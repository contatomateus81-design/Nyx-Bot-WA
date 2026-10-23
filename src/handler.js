import { config } from './config.js';
import { getDelegatedOwners } from './store.js';

const commands = new Map();

export function getRegisteredCommandCount() {
  return new Set(commands.values()).size;
}

export function registerCommand(command) {
  if (!command?.name || typeof command.execute !== 'function') {
    throw new TypeError('Comando inválido: informe name e execute().');
  }
  commands.set(command.name.toLowerCase(), command);
  for (const alias of command.aliases ?? []) commands.set(alias.toLowerCase(), command);
}

export async function runCommandForTest(context, name, args = []) {
  const command = commands.get(String(name ?? '').toLowerCase());
  if (!command) return { found: false };
  if (['test', 'triger', 'trigger'].includes(command.name.toLowerCase())) {
    throw new Error('O comando de teste não pode testar a si mesmo.');
  }
  if (command.role === 'dono' && !context.isOwner) {
    await context.reply('🔒 Esse comando é exclusivo do dono.');
    return { found: true, blocked: true };
  }
  await command.execute({ ...context, args });
  return { found: true };
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
  const isOfficialOwner = Boolean(config.ownerNumber) && senderNumber === config.ownerNumber;
  const delegatedOwners = await getDelegatedOwners();
  const normalizeJid = (jid = '') => String(jid).split(':')[0].trim().toLowerCase();
  const isDelegatedOwner = delegatedOwners.some((jid) => {
    const normalized = normalizeJid(jid);
    const storedNumber = normalized.split('@')[0].replace(/\D/g, '');
    return normalized === normalizeJid(senderJid) || (storedNumber.length >= 10 && storedNumber === senderNumber);
  });
  const isOwner = isOfficialOwner || isDelegatedOwner;
  const isGroup = (message.key.remoteJid ?? '').endsWith('@g.us');
  const args = text.slice(config.prefix.length).trim().split(/\s+/);
  const name = (args.shift() ?? '').toLowerCase();
  if (!name) return;

  const command = commands.get(name);
  if (!command) {
    return sock.sendMessage(message.key.remoteJid, {
      text: `❌ Este comando não existe.\n📋 Por favor, utilize ${config.prefix}menu para ver a lista de comandos disponíveis.`,
    }, { quoted: message });
  }

  const context = {
    sock, message, args, senderJid, senderNumber, isOwner, isOfficialOwner, isGroup,
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
