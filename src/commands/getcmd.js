import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerCommand, getRegisteredCommand } from '../handler.js';
import { config } from '../config.js';

const commandsDir = dirname(fileURLToPath(import.meta.url));
const customCommandsDir = join(commandsDir, 'custom');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findCommandSource(commandName) {
  const escapedName = escapeRegExp(commandName);
  const declaration = new RegExp(
    `registerCommand\\s*\\(\\s*\\{\\s*name\\s*:\\s*(['"])${escapedName}\\1`
  );

  for (const directory of [commandsDir, customCommandsDir]) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    for (const file of files) {
      if (file.name === 'getcmd.js') continue;
      const filePath = join(directory, file.name);
      const source = await readFile(filePath, 'utf8');
      if (declaration.test(source)) {
        return {
          source,
          filePath,
          displayPath: relative(commandsDir, filePath).replaceAll('\\\\', '/'),
        };
      }
    }
  }

  return null;
}

registerCommand({
  name: 'getcmd',
  aliases: ['codigocomando'],
  role: 'dono',
  async execute(ctx) {
    const requestedName = String(ctx.args[0] ?? '').trim();
    if (!requestedName) {
      return ctx.reply(`💜 Informe o nome do comando.\\nExemplo: ${config.prefix}getcmd play`);
    }

    const command = getRegisteredCommand(requestedName);
    if (!command) {
      return ctx.reply(`❌ Não encontrei o comando "${requestedName}". Confira o nome e tente novamente.`);
    }

    const result = await findCommandSource(command.name);
    if (!result) {
      return ctx.reply(`⚠️ Encontrei o comando ${config.prefix}${command.name}, mas não consegui localizar o arquivo-fonte dele.`);
    }

    const caption = `💜 Código-fonte do comando ${config.prefix}${command.name}\\n📁 Arquivo: src/commands/${result.displayPath}`;

    if (result.source.length <= 12000) {
      return ctx.reply(`${caption}\\n\\n\`\`\`js\\n${result.source}\\n\`\`\``);
    }

    return ctx.sock.sendMessage(ctx.chatJid, {
      document: Buffer.from(result.source, 'utf8'),
      mimetype: 'text/javascript',
      fileName: `${command.name}.js`,
      caption,
    }, { quoted: ctx.message });
  },
});
