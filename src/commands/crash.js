import { registerCommand } from '../handler.js';

registerCommand({
  name: 'crash',
  aliases: ['testeerro'],
  role: 'dono',
  async execute({ reply, args }) {
    const mode = String(args?.[0] ?? 'teste').toLowerCase();

    if (mode === 'erro') {
      // Simula uma falha controlada para testar o tratamento de erros do handler.
      throw new Error('Falha simulada pelo comando crash.');
    }

    await reply(
      '🧪 Teste seguro da Nyx concluído!\n\n' +
      '✅ O comando crash.js foi carregado e executado.\n' +
      '🛡️ Nenhuma mensagem pesada foi enviada e o bot não foi travado.\n\n' +
      'Para testar o tratamento de erros, use }crash erro. A falha será capturada pelo handler.'
    );
  },
});
