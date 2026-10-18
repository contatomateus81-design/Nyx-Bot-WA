import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { config, validateConfig } from './config.js';
import { handleMessage } from './handler.js';
import { handleGroupMessage, handleParticipantsUpdate } from './events.js';
import './commands/basic.js';
import './commands/group.js';
import './commands/fun.js';
import './commands/owner.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });
let reconnectTimer;
let starting = false;
let pairingNumber;

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
   if (type !== 'notify') return;
   for (const message of messages) {
    if (!message.message) continue;
    // Allow commands sent by the linked owner account, but ignore its ordinary outgoing messages.
    const text = message.message.conversation
     ?? message.message.extendedTextMessage?.text
     ?? message.message.imageMessage?.caption
     ?? message.message.videoMessage?.caption;
    if (message.key.fromMe && !text?.startsWith(config.prefix)) continue;
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
