import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { registerCommand } from '../handler.js';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);
const TEMP_DIR = resolve('temp_tomp3');
const MAX_DURATION_SECONDS = 10 * 60;
const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const activeSenders = new Set();

function getQuotedMessage(message) {
  const contexts = [
    message.message?.extendedTextMessage?.contextInfo,
    message.message?.videoMessage?.contextInfo,
    message.message?.imageMessage?.contextInfo,
    message.message?.documentMessage?.contextInfo,
  ];
  const context = contexts.find((item) => item?.quotedMessage);
  if (!context) return null;
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

function getVideoMessage(message) {
  if (message.message?.videoMessage) return message;
  const quoted = getQuotedMessage(message);
  return quoted?.message?.videoMessage ? quoted : null;
}

registerCommand({
  name: 'tomp3',
  aliases: ['mp3', 'videomp3', 'audiomp3'],
  role: 'membro',
  async execute({ sock, message, senderJid, chatJid, reply }) {
    const mediaMessage = getVideoMessage(message);
    if (!mediaMessage) {
      return reply(`🎵 Para converter um vídeo em MP3, envie o vídeo e responda a ele com ${config.prefix}tomp3. Também pode enviar o vídeo com o comando na legenda. Limite: 10 minutos.`);
    }

    const senderKey = String(senderJid ?? '').split(':')[0];
    if (activeSenders.has(senderKey)) {
      return reply('⏳ Já estou convertendo um arquivo seu. Aguarde terminar antes de enviar outro.');
    }
    activeSenders.add(senderKey);

    const id = randomUUID();
    const inputPath = join(TEMP_DIR, `${id}-input`);
    const outputPath = join(TEMP_DIR, `${id}.mp3`);

    try {
      await mkdir(TEMP_DIR, { recursive: true });
      const source = await downloadMediaMessage(
        mediaMessage,
        'buffer',
        {},
        { logger: { info() {}, warn() {}, error() {}, debug() {}, trace() {} }, reuploadRequest: sock.updateMediaMessage },
      );
      if (!Buffer.isBuffer(source) || source.length === 0) {
        return reply('😿 Não consegui baixar o vídeo. Tente enviar o arquivo novamente.');
      }
      if (source.length > MAX_INPUT_BYTES) {
        return reply('📦 Esse vídeo ultrapassa o limite de 64 MB. Envie um arquivo menor.');
      }
      await writeFile(inputPath, source);

      const { stdout: durationText } = await execFileAsync('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath,
      ], { timeout: 20_000, maxBuffer: 1024 * 1024 });
      const duration = Number.parseFloat(durationText.trim());
      if (!Number.isFinite(duration) || duration <= 0) {
        return reply('😿 Não consegui identificar a duração desse vídeo. Confira se o arquivo está válido.');
      }
      if (duration > MAX_DURATION_SECONDS) {
        return reply('⏱️ Esse vídeo passa de 10 minutos. Por enquanto, o limite do comando é de 10 minutos.');
      }

      await execFileAsync('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', inputPath,
        '-map', '0:a:0', '-vn',
        '-c:a', 'libmp3lame', '-b:a', '128k',
        '-t', String(MAX_DURATION_SECONDS),
        '-metadata', 'title=Áudio convertido pela Nyx Bot',
        outputPath,
      ], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });

      const outputInfo = await stat(outputPath);
      if (outputInfo.size === 0) {
        return reply('😿 Esse vídeo não parece ter uma faixa de áudio para converter.');
      }
      if (outputInfo.size > MAX_OUTPUT_BYTES) {
        return reply('📦 O MP3 ficou grande demais para enviar pelo WhatsApp.');
      }

      const audio = await readFile(outputPath);
      await sock.sendMessage(chatJid, {
        audio,
        mimetype: 'audio/mpeg',
        fileName: 'nyx-audio.mp3',
        ptt: false,
      }, { quoted: message });
    } catch (error) {
      console.error('[command:tomp3]', error?.stderr ?? error?.message ?? error);
      const detail = String(error?.message ?? '');
      if (/ENOENT|not found/i.test(detail)) {
        await reply('⚠️ Não encontrei o FFmpeg ou o FFprobe. Instale o FFmpeg na máquina em que a Nyx Bot está rodando.');
      } else if (/timed out|timeout/i.test(detail)) {
        await reply('⏳ A conversão demorou demais e foi cancelada. Tente novamente com outro vídeo.');
      } else {
        await reply('😿 Não consegui converter esse vídeo. Confira se ele tem áudio e tente novamente.');
      }
    } finally {
      await Promise.all([
        rm(inputPath, { force: true }).catch(() => {}),
        rm(outputPath, { force: true }).catch(() => {}),
      ]);
      activeSenders.delete(senderKey);
    }
  },
});
