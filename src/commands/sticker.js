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
const MAX_ANIMATED_STICKER_BYTES = 500 * 1024;
const MAX_VIDEO_SECONDS = 9;

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
  if (message.message?.imageMessage || message.message?.videoMessage) return message;
  const quoted = getQuotedMessage(message);
  return quoted?.message?.imageMessage || quoted?.message?.videoMessage ? quoted : null;
}

async function createAnimatedSticker(inputPath, outputPath) {
  const attempts = [
    { fps: 12, quality: 65 },
    { fps: 10, quality: 55 },
    { fps: 8, quality: 45 },
    { fps: 8, quality: 35 },
  ];

  for (const attempt of attempts) {
    const videoFilter = [
      `fps=${attempt.fps}`,
      'scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos',
      'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
      'format=yuva420p',
    ].join(',');

    await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', inputPath,
      '-t', String(MAX_VIDEO_SECONDS),
      '-vf', videoFilter,
      '-an',
      '-c:v', 'libwebp_anim',
      '-quality', String(attempt.quality),
      '-compression_level', '6',
      '-loop', '0',
      '-f', 'webp',
      outputPath,
    ], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });

    const sticker = await readFile(outputPath);
    if (sticker.length <= MAX_ANIMATED_STICKER_BYTES) return sticker;
  }

  throw new Error('A figurinha animada ultrapassou 500 KB mesmo após a compressão.');
}

registerCommand({
  name: 'fig',
  aliases: ['figurinha', 'tofig', 's', 'stiker', 'sticker'],
  role: 'membro',
  async execute({ sock, message, chatJid, reply }) {
    const mediaMessage = getMediaMessage(message);
    if (!mediaMessage) {
      return reply('🖼️ Envie uma imagem ou vídeo com a legenda }fig, ou responda a uma imagem/vídeo com }fig. Vídeos são convertidos em figurinhas animadas de até 9 segundos.');
    }

    const isVideo = Boolean(mediaMessage.message?.videoMessage);
    const id = randomUUID();
    const inputPath = join(TEMP_DIR, id + (isVideo ? '-input.mp4' : '-input'));
    const outputPath = join(TEMP_DIR, id + '.webp');

    try {
      const source = await downloadMediaMessage(
        mediaMessage,
        'buffer',
        {},
        { logger: { info() {}, warn() {}, error() {}, debug() {}, trace() {} }, reuploadRequest: sock.updateMediaMessage },
      );
      if (!Buffer.isBuffer(source) || source.length === 0) {
        throw new Error('O arquivo baixado está vazio.');
      }
      if (source.length > MAX_INPUT_BYTES) {
        return reply('📦 Esse arquivo é muito grande. Envie uma imagem ou vídeo de até 15 MB.');
      }

      await mkdir(TEMP_DIR, { recursive: true });
      await writeFile(inputPath, source);

      let sticker;
      if (isVideo) {
        sticker = await createAnimatedSticker(inputPath, outputPath);
      } else {
        const ffmpegArgs = [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-i', inputPath,
          '-frames:v', '1',
          '-vf', 'scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba',
          '-c:v', 'libwebp', '-quality', '78', '-compression_level', '6',
          outputPath,
        ];
        await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });

        sticker = await readFile(outputPath);
        if (sticker.length > MAX_STICKER_BYTES) {
          const lowerQualityArgs = [...ffmpegArgs];
          lowerQualityArgs.splice(lowerQualityArgs.indexOf('78'), 1, '50');
          await execFileAsync('ffmpeg', lowerQualityArgs, { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
          sticker = await readFile(outputPath);
        }
      }

      const maxBytes = isVideo ? MAX_ANIMATED_STICKER_BYTES : MAX_STICKER_BYTES;
      if (sticker.length > maxBytes) {
        throw new Error(isVideo
          ? 'A figurinha animada ultrapassou 500 KB.'
          : 'A figurinha final ultrapassou 1 MB.');
      }

      await sock.sendMessage(chatJid, { sticker, mimetype: 'image/webp' }, { quoted: message });
    } catch (error) {
      console.error('[command:stiker]', error?.stderr ?? error?.message ?? error);
      const detail = String(error?.message ?? '');
      if (/ENOENT|not found/i.test(detail)) {
        await reply('⚠️ Não encontrei o FFmpeg. Instale-o na máquina em que a Nyx Bot está rodando.');
      } else if (/libwebp_anim|unknown encoder/i.test(detail)) {
        await reply('⚠️ Seu FFmpeg não tem suporte a WebP animado. Atualize/reinstale o FFmpeg com suporte à libwebp.');
      } else if (/ultrapassou 500 KB/i.test(detail)) {
        await reply('📦 Esse vídeo ficou pesado demais para uma figurinha animada. Tente um trecho mais curto ou com menos movimento.');
      } else {
        await reply('😿 Não consegui criar a figurinha. Tente outra imagem ou vídeo.');
      }
    } finally {
      await Promise.all([
        rm(inputPath, { force: true }).catch(() => {}),
        rm(outputPath, { force: true }).catch(() => {}),
      ]);
    }
  },
});
