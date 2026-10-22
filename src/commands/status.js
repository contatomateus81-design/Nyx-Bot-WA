import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { registerCommand, getRegisteredCommandCount } from '../handler.js';
import { getDelegatedOwners } from '../store.js';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);
const CHECK_TIMEOUT_MS = 2500;

function formatDuration(seconds) {
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [
    days ? `${days}d` : null,
    hours ? `${hours}h` : null,
    minutes ? `${minutes}min` : null,
    `${secs}s`,
  ].filter(Boolean).join(' ');
}

function getConnectionStatus(sock) {
  const readyState = sock?.ws?.readyState;
  if (sock?.user && (readyState === undefined || readyState === 1)) return '🟢 Conectado';
  if (readyState === 0) return '🟡 Conectando';
  if (readyState === 2 || readyState === 3) return '🔴 Desconectado';
  return '⚪ Indeterminado';
}

function formatMiB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

async function checkBinary(binary, args) {
  try {
    await execFileAsync(binary, args, {
      timeout: CHECK_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function checkPiper() {
  const model = process.env.PIPER_MODEL?.trim();
  if (!model) return '⚪ Não configurado';

  const binary = process.env.PIPER_BIN?.trim() || 'piper';
  const [binaryAvailable, modelAvailable] = await Promise.all([
    checkBinary(binary, ['--help']),
    access(resolve(model)).then(() => true, () => false),
  ]);

  if (!binaryAvailable) return '🔴 Piper indisponível';
  if (!modelAvailable) return '🟡 Modelo não encontrado';
  return '🟢 Disponível';
}

registerCommand({
  name: 'status',
  aliases: ['estado', 'botstatus'],
  role: 'membro',
  async execute({ sock, reply }) {
    const memory = process.memoryUsage();
    const [delegatedOwners, ffmpegAvailable, ytDlpAvailable, piperStatus] = await Promise.all([
      getDelegatedOwners(),
      checkBinary(process.env.FFMPEG_BIN?.trim() || 'ffmpeg', ['-version']),
      checkBinary('yt-dlp', ['--version']),
      checkPiper(),
    ]);

    const connectionStatus = getConnectionStatus(sock);
    const toolsStatus = [
      `FFmpeg: ${ffmpegAvailable ? '🟢 Disponível' : '🔴 Indisponível'}`,
      `yt-dlp: ${ytDlpAvailable ? '🟢 Disponível' : '🔴 Indisponível'}`,
      `Piper/TTS: ${piperStatus}`,
    ].join('\n│ ');

    await reply(
      `╭───「 💜 ${config.name.toUpperCase()} • STATUS 」───╮
│ WhatsApp: ${connectionStatus}
│ Processo ativo: ${formatDuration(process.uptime())}
│ Node.js: ${process.version}
│ RAM do processo: ${formatMiB(memory.rss)} MB
│ Heap JS: ${formatMiB(memory.heapUsed)} / ${formatMiB(memory.heapTotal)} MB
│ Memória externa: ${formatMiB(memory.external)} MB
│ Donos adicionais: ${delegatedOwners.length}/6
│ Comandos registrados: ${getRegisteredCommandCount()}
│
│ 🧰 RECURSOS
│ ${toolsStatus}
╰──────────────────────────────╯

ℹ️ RAM e tempo são do processo do bot, não do celular inteiro.
As verificações de recursos são rápidas e não executam downloads nem geram áudio.
Atualize com ${config.prefix}status.`
    );
  },
});
