import 'dotenv/config';

const ownerNumber = (process.env.OWNER_NUMBER ?? '').replace(/\D/g, '');

export const config = {
  name: process.env.BOT_NAME?.trim() || 'Nyx Bot',
  prefix: process.env.BOT_PREFIX?.trim() || '!',
  ownerNumber,
  sessionDir: 'sessions',
  pairingCode: process.env.PAIRING_CODE !== 'false',
};

export function validateConfig() {
  if (!config.ownerNumber) {
    throw new Error('Configure OWNER_NUMBER no arquivo .env usando DDI + DDD + número, somente dígitos.');
  }
  if (config.ownerNumber.length < 10 || config.ownerNumber.length > 15) {
    throw new Error('OWNER_NUMBER parece inválido. Use o número completo com código do país.');
  }
}
