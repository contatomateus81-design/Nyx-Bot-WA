import { registerCommand } from '../handler.js';
import { config } from '../config.js';
import { getAIEnabled, setAIEnabled } from '../store.js';

registerCommand({
  name: 'ia',
  role: 'dono',
  async execute(ctx) {
    const option = String(ctx.args[0] ?? '').trim();
    if (option === '1') {
      await setAIEnabled(true);
      return ctx.reply('💜 Respostas automáticas da NyxAI ativadas.\n\nPrivados: resposta automática.\nGrupos: somente quando a Nyx for mencionada.');
    }
    if (option === '0') {
      await setAIEnabled(false);
      return ctx.reply('💜 Respostas automáticas da NyxAI desativadas.');
    }
    const enabled = await getAIEnabled();
    return ctx.reply(`💜 NyxAI: ${enabled ? 'ATIVADA' : 'DESATIVADA'}\nUse ${config.prefix}ia 1 para ativar ou ${config.prefix}ia 0 para desativar.`);
  },
});
