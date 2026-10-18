import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdir } from 'node:fs/promises';
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
async function startBot() {
 if (starting) return;
 starting = true;
 try {
  validateConfig(); await mkdir(config.sessionDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch (error) { logger.warn({ err:error }, 'Could not fetch latest WhatsApp version'); }
  const sock = makeWASocket({ auth:state, logger, browser:Browsers.ubuntu(config.name), ...(version?{version}:{}), markOnlineOnConnect:false, syncFullHistory:false, generateHighQualityLinkPreview:false });
  let pairingRequested = false;
  const requestPairingCode = async () => {
   if (state.creds.registered || !config.pairingCode || pairingRequested) return;
   pairingRequested = true;
   try {
    const code = await sock.requestPairingCode(config.ownerNumber);
    console.log(`\n╭───「 NYX BOT • PAREAMENTO 」───╮\n  Código: ${code.match(/.{1,4}/g)?.join('-') ?? code}\n  WhatsApp > Aparelhos conectados > Conectar com número\n╰──────────────────────────────╯\n`);
   } catch (error) {
    pairingRequested = false;
    console.error('Não foi possível gerar o código de pareamento:', error?.message ?? error);
    if (error?.stack) console.error(error.stack);
   }
  };
  console.log('Estado da autenticação:', state.creds.registered ? 'credenciais registradas' : 'aguardando novo pareamento');
  sock.ev.on('creds.update', saveCreds);
  // Fallback: solicitar o código após criar o socket, sem depender do evento "connecting".
  if (!state.creds.registered && config.pairingCode) setTimeout(() => { void requestPairingCode(); }, 1000);
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
   if (connection === 'connecting') await requestPairingCode();
   if (connection === 'open') console.log(`✅ ${config.name} conectado ao WhatsApp.`);
   if (connection === 'close') {
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    console.error('Conexão encerrada:', statusCode ?? 'código desconhecido');
    const disconnectError = lastDisconnect?.error;
    if (disconnectError?.message) console.error('Detalhe da desconexão:', disconnectError.message);
    if (statusCode === DisconnectReason.loggedOut) { console.error('Sessão desconectada pelo WhatsApp; será necessário parear novamente.'); return; }
    clearTimeout(reconnectTimer); reconnectTimer = setTimeout(() => { starting = false; startBot().catch(err => console.error('Falha ao reconectar:', err?.stack ?? err)); }, 3000);
   }
  });
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
   if (type !== 'notify') return;
   for (const message of messages) {
    if (!message.message || message.key.fromMe) continue;
    await handleGroupMessage(sock, message);
    await handleMessage(sock, message);
   }
  });
  sock.ev.on('group-participants.update', async (update) => { await handleParticipantsUpdate(sock, update); });
 } catch (error) { starting = false; throw error; }
}
process.on('unhandledRejection', error => console.error('[unhandledRejection]', error));
startBot().catch(error => { console.error('Não foi possível iniciar o Nyx Bot:', error.message); process.exitCode = 1; });
