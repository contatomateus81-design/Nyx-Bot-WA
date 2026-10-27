import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { config, validateConfig } from './config.js';
import { handleMessage } from './handler.js';
import { handleGroupMessage, handleParticipantsUpdate, rememberContact } from './events.js';
import './commands/basic.js';
import './commands/group.js';
import './commands/fun.js';
import './commands/play.js';
import './commands/sticker.js';
import './commands/owner.js';
import './commands/profile.js';
import './commands/tts.js';
import './commands/tomp3.js';
import './commands/status.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });
let reconnectTimer;
let starting = false;
let pairingNumber;

const groupNameCache = new Map();

function getMessageText(message) {
 const content = message.message ?? {};
 return content.conversation
  ?? content.extendedTextMessage?.text
  ?? content.imageMessage?.caption
  ?? content.videoMessage?.caption
  ?? content.documentMessage?.caption
  ?? content.documentWithCaptionMessage?.message?.documentMessage?.caption
  ?? content.buttonsResponseMessage?.selectedDisplayText
  ?? content.listResponseMessage?.title
  ?? content.templateButtonReplyMessage?.selectedDisplayText
  ?? '';
}

async function logIncomingMessage(sock, message) {
 const remoteJid = message.key.remoteJid ?? '';
 const isGroup = remoteJid.endsWith('@g.us');
 const senderJid = isGroup ? (message.key.participant ?? '') : remoteJid;
 const number = senderJid.split('@')[0].split(':')[0].replace(/\D/g, '') || 'Desconhecido';
 let chatName = message.pushName || 'Contato privado';

 if (isGroup) {
  chatName = groupNameCache.get(remoteJid) ?? remoteJid;
  if (!groupNameCache.has(remoteJid)) {
   try {
    const metadata = await sock.groupMetadata(remoteJid);
    chatName = metadata.subject || chatName;
    groupNameCache.set(remoteJid, chatName);
   } catch {
    // Keep the group JID as a fallback if metadata is unavailable.
   }
  }
 }

 const content = message.message ?? {};
 const mediaType = content.imageMessage ? 'Imagem'
  : content.videoMessage ? 'Vídeo'
  : content.audioMessage ? 'Áudio'
  : content.documentMessage || content.documentWithCaptionMessage ? 'Documento'
  : content.stickerMessage ? 'Figurinha'
  : null;
 const text = getMessageText(message).trim();
 const timestamp = Number(message.messageTimestamp) || Math.floor(Date.now() / 1000);
 const date = new Date(timestamp * 1000);
 const datePart = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric'
 }).format(date);
 const timePart = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
 }).format(date);

 console.log('\n' + (mediaType ? '📎 *Mídia anexada: ' + mediaType + '*\n' : '') +
  '> Nome/Grupo: ' + chatName + '\n> Número: +' + number + '\n> Data: ' + datePart + '\n> Hora: ' + timePart + '\n> Mensagem: ' + (text || '(sem texto)') + '\n');
}

async function startBot() {
 if (starting) return;
 starting = true;
 try {
  validateConfig();
  await mkdir(config.sessionDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  if (!state.creds.registered && config.pairingCode && !pairingNumber) {
   const rl = createInterface({ input: stdin, output: stdout });
   try {
    const answer = await rl.question('Digite seu número para conectar (+5555999999999): ');
    pairingNumber = answer.replace(/\D/g, '') || config.ownerNumber;
    if (pairingNumber.length < 10 || pairingNumber.length > 15) {
     pairingNumber = undefined;
     throw new Error('Número inválido. Informe DDI + DDD + número, somente dígitos além do sinal +.');
    }
   } finally { rl.close(); }
  }
  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch (error) { logger.warn({ err:error }, 'Could not fetch latest WhatsApp version'); }
  const sock = makeWASocket({
   auth: state,
   logger,
   // Use a canonical browser identity; the bot's display name is not a browser name.
   browser: Browsers.ubuntu('Chrome'),
   ...(version ? { version } : {}),
   markOnlineOnConnect: false,
   syncFullHistory: false,
   generateHighQualityLinkPreview: false
  });
  let pairingRequested = false;
  let pairingScheduled = false;
  let connectionClosed = false;
  const requestPairingCode = async () => {
   if (state.creds.registered || !config.pairingCode || pairingRequested || connectionClosed) return;
   pairingRequested = true;
   try {
    const code = await sock.requestPairingCode(pairingNumber || config.ownerNumber);
    console.log(`\n╭───「 NYX BOT • PAREAMENTO 」───╮\n  Código: ${code.match(/.{1,4}/g)?.join('-') ?? code}\n  WhatsApp > Aparelhos conectados > Conectar com número\n╰──────────────────────────────╯\n`);
   } catch (error) {
    console.error('Não foi possível gerar o código de pareamento:', error?.message ?? error);
    if (error?.stack) console.error(error.stack);
   }
  };
  console.log('Estado da autenticação:', state.creds.registered ? 'credenciais registradas' : 'aguardando novo pareamento');
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('contacts.upsert', (contacts) => { for (const contact of contacts ?? []) rememberContact(contact.id, contact.notify || contact.name || contact.verifiedName); });
  sock.ev.on('contacts.update', (contacts) => { for (const contact of contacts ?? []) rememberContact(contact.id, contact.notify || contact.name || contact.verifiedName); });
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
   if (connection === 'connecting' && !state.creds.registered && config.pairingCode && !pairingRequested && !pairingScheduled) {
    pairingScheduled = true;
    // Give the WebSocket a moment to establish before requesting a pairing code.
    setTimeout(() => { void requestPairingCode(); }, 2500);
   }
   if (connection === 'open') console.log(`✅ ${config.name} conectado ao WhatsApp.`);
   if (connection === 'close') {
    connectionClosed = true;
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    console.error('Conexão encerrada:', statusCode ?? 'código desconhecido');
    const disconnectError = lastDisconnect?.error;
    if (disconnectError?.message) console.error('Detalhe da desconexão:', disconnectError.message);
    if (statusCode === DisconnectReason.loggedOut) {
     console.error('Sessão desconectada pelo WhatsApp; será necessário parear novamente.');
     return;
    }
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
     starting = false;
     startBot().catch(err => console.error('Falha ao reconectar:', err?.stack ?? err));
    }, 3000);
   }
  });
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
   for (const message of messages) {
    // Diagnostic: log event metadata even when Baileys has no decrypted message body.
    console.log('[messages.upsert]', {
     type,
     fromMe: Boolean(message.key?.fromMe),
     hasMessage: Boolean(message.message),
     remoteJidType: message.key?.remoteJid?.endsWith('@g.us') ? 'group' : 'private-or-other',
    });
    if (message.key?.participant && message.pushName) rememberContact(message.key.participant, message.pushName);
    else if (message.key?.remoteJid && !message.key.remoteJid.endsWith('@g.us') && message.pushName) rememberContact(message.key.remoteJid, message.pushName);
    if (!message.message) {
     console.warn('[messages.upsert] Mensagem sem conteúdo descriptografado; ignorando por enquanto.');
     continue;
    }
    const text = message.message.conversation
     ?? message.message.extendedTextMessage?.text
     ?? message.message.imageMessage?.caption
     ?? message.message.videoMessage?.caption;
    const ownerCommand = Boolean(message.key.fromMe && text?.startsWith(config.prefix));
    // WhatsApp may report messages sent by the linked account as "append".
    if (type !== 'notify' && !(type === 'append' && ownerCommand)) continue;
    // Ignore the linked account's ordinary outgoing messages to prevent loops.
    if (message.key.fromMe && !ownerCommand) continue;
    await logIncomingMessage(sock, message);
    await handleGroupMessage(sock, message);
    await handleMessage(sock, message);
   }
  });
  sock.ev.on('group-participants.update', async (update) => { await handleParticipantsUpdate(sock, update); });
 } catch (error) {
  starting = false;
  throw error;
 }
}
process.on('unhandledRejection', error => console.error('[unhandledRejection]', error));
startBot().catch(error => {
 console.error('Não foi possível iniciar o Nyx Bot:', error.message);
 process.exitCode = 1;
});
