import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
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
// One active request per sender; repeated commands do not start extra downloads.
const activeRequests = new Set();

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


function makeProgressBar(percent) {
  const filled = Math.max(0, Math.min(10, Math.floor(percent / 10)));
  return '█'.repeat(filled) + '▒'.repeat(10 - filled);
}

function makePlayerCaption(info, senderJid) {
  const title = String(info.title ?? 'Áudio').replace(/[\r\n]+/g, ' ').slice(0, 180);
  const duration = formatDuration(info.duration);
  const elapsed = Number.isFinite(info.duration) ? Math.floor(info.duration * 0.72) : 0;
  const volume = 4 + Math.floor(Math.random() * 6);
  const volumeBar = '▮'.repeat(volume) + '▯'.repeat(9 - volume);
  const author = senderJid.split('@')[0].split(':')[0];
  return `🎵 *${title}*\n🔊 ━━━━━━━━●━━━━ ${formatDuration(elapsed)} / ${duration}\nᴠᴏʟᴜᴍᴇ : ${volumeBar}\n↻　◁　Ⅱ　▷　↺\n\n👤 Pedido por: @${author}`;
}

function downloadWithProgress(args, onProgress) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let buffer = '';
    let settled = false;
    const timeout = setTimeout(() => child.kill('SIGTERM'), COMMAND_TIMEOUT_MS);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const match = line.match(/NYX_PROGRESS:(\d+(?:\.\d+)?)/);
        if (match) onProgress(Number(match[1]));
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timeout);
      if (!settled) { settled = true; rejectPromise(error); }
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (code === 0) resolvePromise();
      else {
        const error = new Error(`yt-dlp exited with code ${code}`);
        error.stderr = stderr;
        rejectPromise(error);
      }
    });
  });
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

    const requestKey = String(senderJid ?? '').split(':')[0];
    if (activeRequests.has(requestKey)) {
      return reply('⏳ Seu pedido anterior ainda está sendo processado. Aguarde o áudio ou a mensagem de erro antes de pedir outra música.');
    }
    activeRequests.add(requestKey);

    const id = randomUUID();
    const outputTemplate = join(TEMP_DIR, `${id}.%(ext)s`);
    let downloadedPath;

    try {
      await mkdir(TEMP_DIR, { recursive: true });
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

      const progressMessage = await sock.sendMessage(chatJid, {
        text: `💜 Progresso: ${makeProgressBar(0)} 0%`
      }, { quoted: message });

      let lastProgress = 0;
      const updateProgress = async (percent) => {
        if (percent <= lastProgress) return;
        lastProgress = percent;
        try {
          // Edita a mensagem original; não cria uma nova mensagem de progresso.
          await sock.sendMessage(chatJid, {
            text: `💜 Progresso: ${makeProgressBar(percent)} ${percent}%`,
            edit: progressMessage.key
          });
        } catch (error) {
          console.warn('[command:play] Falha ao editar progresso:', error?.message ?? error);
        }
      };

      const downloadPromise = downloadWithProgress([
        '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '5',
        '--write-thumbnail', '--convert-thumbnails', 'jpg',
        '--newline', '--no-playlist', '--no-warnings', '--socket-timeout', '15',
        '--max-filesize', '15M', '--output', outputTemplate, downloadTarget
      ], () => {}).then(
        () => ({ ok: true }),
        (error) => ({ ok: false, error })
      );

      // Progresso ilustrativo e gradual, independente da porcentagem real do yt-dlp.
      for (const percent of [10, 30, 50, 80, 99]) {
        const result = await Promise.race([
          downloadPromise,
          new Promise((resolvePromise) => setTimeout(() => resolvePromise(null), 2200))
        ]);
        if (result) {
          if (!result.ok) throw result.error;
          break;
        }
        await updateProgress(percent);
      }

      const downloadResult = await downloadPromise;
      if (!downloadResult.ok) throw downloadResult.error;

      try {
        await sock.sendMessage(chatJid, {
          text: `💜 Progresso: ${makeProgressBar(100)} 100%`,
          edit: progressMessage.key
        });
      } catch (error) {
        console.warn('[command:play] Falha ao finalizar progresso:', error?.message ?? error);
      }

      const files = await readdir(TEMP_DIR);
      downloadedPath = files
        .filter((file) => file.startsWith(`${id}.`) && file.toLowerCase().endsWith('.mp3'))
        .map((file) => join(TEMP_DIR, file))[0];

      if (!downloadedPath) throw new Error('O yt-dlp terminou sem gerar um arquivo MP3.');
      const fileInfo = await stat(downloadedPath);
      if (fileInfo.size > MAX_FILE_BYTES) {
        throw new Error('max-filesize: arquivo maior que o limite de envio');
      }

      const audio = await readFile(downloadedPath);
      const title = String(info.title ?? 'Áudio').replace(/[\r\n]+/g, ' ').slice(0, 180);
      const filename = `${title.replace(/[\\\\/:*?"<>|]/g, '_').trim() || 'audio'}.mp3`;
      const thumbnailPath = files
        .filter((file) => file.startsWith(`${id}.`) && /\.(jpg|jpeg|png|webp)$/i.test(file))
        .map((file) => join(TEMP_DIR, file))[0];
      const caption = makePlayerCaption(info, senderJid);

      if (thumbnailPath) {
        await sock.sendMessage(chatJid, {
          image: await readFile(thumbnailPath),
          caption,
          mentions: [senderJid]
        }, { quoted: message });
      } else {
        await sock.sendMessage(chatJid, {
          text: caption,
          mentions: [senderJid]
        }, { quoted: message });
      }

      // Envia o áudio somente depois da capa e das informações.
      await sock.sendMessage(chatJid, {
        audio,
        mimetype: 'audio/mpeg',
        fileName: filename,
        ptt: false
      }, { quoted: message });
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
      activeRequests.delete(requestKey);
    }
  }
});
