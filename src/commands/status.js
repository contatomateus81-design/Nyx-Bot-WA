import { registerCommand } from '../handler.js';
import { getDelegatedOwners } from '../store.js';
import { config } from '../config.js';

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

registerCommand({
  name: 'status',
  aliases: ['estado', 'botstatus'],
  role: 'membro',
  async execute({ sock, reply }) {
    const memory = process.memoryUsage();
    const delegatedOwners = await getDelegatedOwners();

    await reply(
      `╭───「 💜 ${config.name.toUpperCase()} • STATUS 」───╮
│ WhatsApp: ${getConnectionStatus(sock)}
│ Processo ativo: ${formatDuration(process.uptime())}
│ RAM do processo: ${formatMiB(memory.rss)} MB
│ Heap JS: ${formatMiB(memory.heapUsed)} / ${formatMiB(memory.heapTotal)} MB
│ Donos adicionais: ${delegatedOwners.length}/6
│ Comandos registrados: ${getRegisteredCommandCount()}
╰──────────────────────────────╯

ℹ️ RAM e tempo são do processo do bot, não do celular inteiro.
Atualize com ${config.prefix}status.`
    );
  },
});
