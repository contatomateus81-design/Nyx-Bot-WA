import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdir } from 'node:fs/promises';
import { config, validateConfig } from './config.js';
import { handleMessage } from './handler.js';
import './commands/basic.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });
let reconnectTimer;

async function startBot() {
  validateConfig();
  await mkdir(config.sessionDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
    logger.info({ version }, 'Baileys version loaded');
  } catch (error) {
    logger.warn({ err: error }, 'Could not fetch latest WhatsApp version; using library default');
  }

  const sock = makeWASocket({
    auth: state,
    logger,
    browser: Browsers.ubuntu(config.name),
    ...(version ? { version } : {}),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && !state.creds.registered && !config.pairingCode) {
      logger.info('QR login is disabled by configuration.');
    }
    if (connection === 'connecting' && !state.creds.registered && config.pairingCode) {
      try {
        const code = await sock.requestPairingCode(config.ownerNumber);
        console.log('\n╭───「 NYX BOT • PAREAMENTO 」───╮');
        console.log(`  Código: ${code.match(/.{1,4}/g)?.join('-') ?? code}`);
        console.log('  WhatsApp > Aparelhos conectados > Conectar com número');
        console.log('╰──────────────────────────────╯\n');
      } catch (error) {
        logger.error({ err: error }, 'Failed to request pairing code');
      }
    }
    if (connection === 'open') {
      console.log(`✅ ${config.name} conectado ao WhatsApp.`);
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.error('Conexão encerrada:', statusCode ?? 'código desconhecido');
      if (loggedOut) {
        console.error('Sessão desconectada pelo WhatsApp. Apague a pasta sessions somente se quiser parear novamente.');
        return;
      }
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => startBot().catch((err) => {
        logger.error({ err }, 'Reconnect failed');
      }), 3000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (!message.message || message.key.fromMe) continue;
      await handleMessage(sock, message);
    }
  });
}

process.on('unhandledRejection', (error) => console.error('[unhandledRejection]', error));
process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
  process.exitCode = 1;
});

startBot().catch((error) => {
  console.error('Não foi possível iniciar o Nyx Bot:', error.message);
  process.exitCode = 1;
});
