import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { registerCommand } from '../handler.js';

const execFileAsync = promisify(execFile);
const TEMP_DIR = resolve('temp_stickers');
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_STICKER_BYTES = 1024 * 1024;
const TIME_ZONE = 'America/Sao_Paulo';

function getQuotedMessage(message) {
  const context = message.message?.extendedTextMessage?.contextInfo
    ?? message.message?.imageMessage?.contextInfo
    ?? message.message?.videoMessage?.contextInfo;
  if (!context?.quotedMessage) return null;

  return {
    key: {
      remoteJid: message.key.remoteJid,
      id: context.stanzaId,
      ...(context.participant ? { participant: context.participant } : {}),
      ...(context.fromMe ? { fromMe: true } : {}),
    },
    message: context.quotedMessage,
  };
}

function getMediaMessage(message) {
  if (message.message?.imageMessage) return message;
  const quoted = getQuotedMessage(message);
  return quoted?.message?.imageMessage ? quoted : null;
}

function getRequesterName(message, senderJid) {
  const name = String(message.pushName ?? '').trim();
  return name ? name.slice(0, 80) : (senderJid.split('@')[0].split(':')[0] || 'Desconhecido');
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
}

function addStickerMetadata(webp, packName, publisher) {
  const metadata = Buffer.from(JSON.stringify({
    'sticker-pack-id': 'nyx-bot-yato',
    'sticker-pack-name': packName,
    'sticker-pack-publisher': publisher,
    emojis: ['💜'],
  }), 'utf8');

  const tiffHeader = Buffer.alloc(26);
  tiffHeader.write('II', 0, 'ascii');
  tiffHeader.writeUInt16LE(42, 2);
  tiffHeader.writeUInt32LE(8, 4);
  tiffHeader.writeUInt16LE(1, 8);
  tiffHeader.writeUInt16LE(0x010e, 10);
  tiffHeader.writeUInt16LE(2, 12);
  tiffHeader.writeUInt32LE(metadata.length + 1, 14);
  tiffHeader.writeUInt32LE(26, 18);
  tiffHeader.writeUInt32LE(0, 22);

  const exifPayload = Buffer.concat([
    Buffer.from('Exif\0\0', 'binary'),
    tiffHeader,
    metadata,
    Buffer.from([0]),
  ]);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.write('EXIF', 0, 'ascii');
  chunkHeader.writeUInt32LE(exifPayload.length, 4);
  const padding = exifPayload.length % 2 ? Buffer.from([0]) : Buffer.alloc(0);
  const exifChunk = Buffer.concat([chunkHeader, exifPayload, padding]);

  if (webp.toString('ascii', 0, 4) !== 'RIFF' || webp.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('O FFmpeg não gerou um WebP válido.');
  }
  // VP8X declares optional WebP chunks such as EXIF in its feature flags.
  if (webp.toString('ascii', 12, 16) === 'VP8X' && webp.length > 20) {
    webp[20] |= 0x08;
  }
  const chunks = Buffer.concat([webp.subarray(12), exifChunk]);
  const riffHeader = Buffer.from(webp.subarray(0, 12));
  riffHeader.writeUInt32LE(chunks.length + 4, 4);
  return Buffer.concat([riffHeader, chunks]);
}

registerCommand({
  name: 'stiker',
  aliases: ['sticker', 'figurinha', 'fig', 's'],
  role: 'membro',
  async execute({ sock, message, senderJid, chatJid, reply }) {
    const mediaMessage = getMediaMessage(message);
    if (!mediaMessage) {
      return reply('🖼️ Envie uma imagem com a legenda }fig ou responda a uma imagem com }fig. Por enquanto, aceito imagens estáticas.');
    }

    const id = randomUUID();
    const inputPath = join(TEMP_DIR, id + '-input');
    const outputPath = join(TEMP_DIR, id + '.webp');

    try {
      const source = await downloadMediaMessage(
        mediaMessage,
        'buffer',
        {},
        { logger: { info() {}, warn() {}, error() {}, debug() {}, trace() {} }, reuploadRequest: sock.updateMediaMessage },
      );
      if (!Buffer.isBuffer(source) || source.length === 0) {
        throw new Error('A imagem baixada está vazia.');
      }
      if (source.length > MAX_INPUT_BYTES) {
        return reply('📦 Essa imagem é muito grande. Envie uma imagem de até 15 MB.');
      }

      await mkdir(TEMP_DIR, { recursive: true });
      await writeFile(inputPath, source);
      const ffmpegArgs = [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', inputPath,
        '-frames:v', '1',
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba',
        '-c:v', 'libwebp', '-quality', '78', '-compression_level', '6',
        outputPath,
      ];
      await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });

      let sticker = await readFile(outputPath);
      if (sticker.length > MAX_STICKER_BYTES) {
        const lowerQualityArgs = [...ffmpegArgs];
        lowerQualityArgs.splice(lowerQualityArgs.indexOf('78'), 1, '50');
        await execFileAsync('ffmpeg', lowerQualityArgs, { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
        sticker = await readFile(outputPath);
      }

      const requester = getRequesterName(message, senderJid);
      const publisher = 'Dono | Yato\nPedido por | ' + requester + '\nData | ' + formatDate();
      sticker = addStickerMetadata(sticker, 'Bot | Nyx', publisher);
      if (sticker.length > MAX_STICKER_BYTES) {
        throw new Error('A figurinha final ultrapassou 1 MB.');
      }

      await sock.sendMessage(chatJid, { sticker, mimetype: 'image/webp' }, { quoted: message });
    } catch (error) {
      console.error('[command:stiker]', error?.stderr ?? error?.message ?? error);
      const detail = String(error?.message ?? '');
      if (/ENOENT|not found/i.test(detail)) {
        await reply('⚠️ Não encontrei o FFmpeg. Instale-o na máquina em que a Nyx Bot está rodando.');
      } else {
        await reply('😿 Não consegui criar a figurinha. Tente outra imagem ou envie a imagem novamente.');
      }
    } finally {
      await Promise.all([
        rm(inputPath, { force: true }).catch(() => {}),
        rm(outputPath, { force: true }).catch(() => {}),
      ]);
    }
  },
});
