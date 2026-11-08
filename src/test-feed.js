const TEST_GROUP_JID = '120363433149371195@g.us';
const MIN_INTERVAL_MS = 45 * 60 * 1000;
const MAX_INTERVAL_MS = 90 * 60 * 1000;

let timer;
let active = false;
let generation = 0;

const messages = [
  '🤖 *NYX • TESTE AUTOMÁTICO*\n\nEste é um envio automático de verificação. A conexão e o envio de mensagens estão funcionando.',
  '🤖 *NYX • TESTE AUTOMÁTICO*\n\nMensagem periódica de teste. Nenhuma ação é necessária.',
  '🤖 *NYX • TESTE AUTOMÁTICO*\n\nVerificação de rotina do bot concluída: envio de texto para o grupo de testes.'
];

function randomDelay() {
  return Math.floor(Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS + 1)) + MIN_INTERVAL_MS;
}

function scheduleNext(sock, runId) {
  if (!active || runId !== generation) return;

  timer = setTimeout(async () => {
    if (!active || runId !== generation) return;

    const text = messages[Math.floor(Math.random() * messages.length)];
    const timestamp = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date());

    try {
      await sock.sendMessage(TEST_GROUP_JID, {
        text: `${text}\n\n🕒 ${timestamp}`
      });
      console.log('[test-feed] Mensagem automática de teste enviada.');
    } catch (error) {
      console.error('[test-feed] Falha ao enviar mensagem de teste:', error?.message ?? error);
    } finally {
      scheduleNext(sock, runId);
    }
  }, randomDelay());

  timer.unref?.();
}

export function startRandomTestFeed(sock) {
  stopRandomTestFeed();
  active = true;
  generation += 1;
  const runId = generation;
  console.log('[test-feed] Feed automático de testes iniciado.');
  scheduleNext(sock, runId);
}

export function stopRandomTestFeed() {
  active = false;
  generation += 1;
  if (timer) clearTimeout(timer);
  timer = undefined;
}
