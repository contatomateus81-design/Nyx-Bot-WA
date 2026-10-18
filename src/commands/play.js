import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { registerCommand } from '../handler.js';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);
const TEMP_DIR = resolve('temp_audio');
const MAX_DURATION_SECONDS = 15 * 60;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 180_000;

function isPrivateIPv4(host) {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || parts[0] === 0
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

function validateUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Esse link não parece ser válido. Envie um link completo começando com https://.');
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('Por segurança, só aceito links HTTP ou HTTPS.');
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost'
    || host.endsWith('.localhost')
    || host.endsWith('.local')
    || host === '::1'
    || host.startsWith('fc')
    || host.startsWith('fd')
    || host.startsWith('fe80:')
    || (isIP(host) === 4 && isPrivateIPv4(host))
  ) {
    throw new Error('Esse endereço não pode ser baixado por segurança.');
  }
  return parsed.toString();
}

function getPlatform(info) {
  const key = String(info.extractor_key ?? info.extractor ?? '').toLowerCase();
  if (key.includes('youtube')) return 'YouTube';
  if (key.includes('instagram')) return 'Instagram';
  if (key.includes('tiktok')) return 'TikTok';
  if (key.includes('soundcloud')) return 'SoundCloud';
  if (key.includes('facebook') || key.includes('fb')) return 'Facebook';
  if (key.includes('twitter') || key === 'x') return 'X/Twitter';
  if (key.includes('vimeo')) return 'Vimeo';
  if (key.includes('dailymotion')) return 'Dailymotion';
  if (key.includes('reddit')) return 'Reddit';
  if (key.includes('bandcamp')) return 'Bandcamp';
  return info.extractor ?? info.extractor_key ?? 'plataforma externa';
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'não informada';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function cleanError(error) {
  const detail = String(error?.stderr ?? error?.message ?? '');
  if (/ENOENT|not found|não foi possível encontrar/i.test(detail)) {
    return 'Não encontrei o yt-dlp no terminal. Instale o yt-dlp e o FFmpeg na mesma máquina em que a Nyx Bot está rodando.';
  }
  if (/timed out|timeout/i.test(detail)) return 'O download demorou demais e foi cancelado. Tente novamente mais tarde.';
  if (/max-filesize|file is larger than/i.test(detail)) return 'Esse áudio é grande demais para enviar pelo bot.';
  if (/unsupported url|no suitable extractor/i.test(detail)) return 'Esse link não é compatível com o yt-dlp ou não permite baixar o áudio.';
  return 'Não consegui baixar esse áudio. Confira o link ou tente um nome mais específico.';
}

registerCommand({
  name: 'play',
  aliases: ['musica', 'música'],
  role: 'membro',
  async execute({ sock, message, args, senderJid, chatJid, reply }) {
    const query = args.join(' ').trim();
    if (!query) {
      return reply(`🎵 Uso: ${config.prefix}play nome da música\nOu envie um link público de uma plataforma compatível.`);
    }

    await mkdir(TEMP_DIR, { recursive: true });
    const id = randomUUID();
    const outputTemplate = join(TEMP_DIR, `${id}.%(ext)s`);
    let downloadedPath;

    try {
      const isUrl = /^https?:\/\//i.test(query);
      const target = isUrl ? validateUrl(query) : `ytsearch1:${query}`;
      const { stdout: metadataOutput } = await execFileAsync(
        'yt-dlp',
        ['--dump-single-json', '--skip-download', '--no-warnings', '--no-playlist', '--socket-timeout', '15', target],
        { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 }
      );

      const metadata = JSON.parse(metadataOutput);
      const info = Array.isArray(metadata.entries) ? metadata.entries.find(Boolean) : metadata;
      if (!info) return reply('😿 Não encontrei resultados para essa música.');

      if (Number.isFinite(info.duration) && info.duration > MAX_DURATION_SECONDS) {
        return reply('⏱️ Por enquanto, só consigo enviar áudios de até 15 minutos.');
      }

      const downloadTarget = isUrl ? target : (info.webpage_url ?? info.original_url);
      if (!downloadTarget) return reply('😿 Não consegui identificar o link do resultado. Tente enviar o link diretamente.');

      await execFileAsync(
        'yt-dlp',
        [
          '--extract-audio',
          '--audio-format', 'mp3',
          '--audio-quality', '5',
          '--no-playlist',
          '--no-warnings',
          '--no-progress',
          '--socket-timeout', '15',
          '--max-filesize', '15M',
          '--output', outputTemplate,
          downloadTarget
        ],
        { timeout: COMMAND_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }
      );

      const files = await readdir(TEMP_DIR);
      downloadedPath = files
        .filter((file) => file.startsWith(`${id}.`) && file.toLowerCase().endsWith('.mp3'))
        .map((file) => join(TEMP_DIR, file))[0];

      if (!downloadedPath) throw new Error('O yt-dlp terminou sem gerar um arquivo MP3.');
      const fileInfo = await stat(downloadedPath);
      if (fileInfo.size > MAX_FILE_BYTES) {
        throw new Error('max-filesize: arquivo maior que o limite de envio');
      }

      const audio = await import('node:fs/promises').then(({ readFile }) => readFile(downloadedPath));
      const title = String(info.title ?? 'Áudio').replace(/[\r\n]+/g, ' ').slice(0, 180);
      const duration = formatDuration(info.duration);
      const platform = getPlatform(info);
      const filename = `${title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'audio'}.mp3`;

      await sock.sendMessage(chatJid, {
        audio,
        mimetype: 'audio/mpeg',
        fileName: filename,
        ptt: false
      }, { quoted: message });

      await sock.sendMessage(chatJid, {
        text: `🎵 *${title}*\n⏱️ Duração: ${duration}\n🌐 Plataforma: ${platform}\n🙋 Pedido por: @${senderJid.split('@')[0].split(':')[0]}`,
        mentions: [senderJid]
      });
    } catch (error) {
      console.error('[command:play]', error?.stderr ?? error?.message ?? error);
      await reply(`😿 ${cleanError(error)}`);
    } finally {
      // Remove only files created by this request, preserving simultaneous downloads.
      try {
        const files = await readdir(TEMP_DIR);
        await Promise.all(files
          .filter((file) => file.startsWith(`${id}.`))
          .map((file) => rm(join(TEMP_DIR, file), { force: true })));
      } catch {
        // The temporary directory may not exist if setup failed.
      }
    }
  }
});
