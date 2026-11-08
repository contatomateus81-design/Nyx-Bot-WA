import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getRegisteredCommand, registerCommand } from '../handler.js';

const customCommandsDir = fileURLToPath(new URL('./custom/', import.meta.url));

function validateCustomCommand(command, fileName) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    throw new TypeError('o export default precisa ser um objeto.');
  }
  if (typeof command.name !== 'string' || !command.name.trim()) {
    throw new TypeError('informe um name válido.');
  }
  if (typeof command.execute !== 'function') {
    throw new TypeError('informe execute() como função.');
  }
  if (command.aliases !== undefined &&
      (!Array.isArray(command.aliases) ||
       command.aliases.some((alias) => typeof alias !== 'string' || !alias.trim()))) {
    throw new TypeError('aliases precisa ser uma lista de textos não vazios.');
  }

  const names = [command.name, ...(command.aliases ?? [])]
    .map((name) => name.trim().toLowerCase());

  if (new Set(names).size !== names.length) {
    throw new Error('o comando contém nomes ou aliases repetidos.');
  }

  for (const name of names) {
    if (getRegisteredCommand(name)) {
      throw new Error(`"${name}" já está sendo usado por outro comando.`);
    }
  }

  if (!/^[a-z0-9_-]+$/i.test(command.name.trim()) ||
      (command.aliases ?? []).some((alias) => !/^[a-z0-9_-]+$/i.test(alias.trim()))) {
    throw new Error('use apenas letras, números, hífen ou underline no name e nos aliases.');
  }

  return fileName;
}

export async function loadCustomCommands() {
  const entries = await readdir(customCommandsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  let loaded = 0;

  for (const file of files) {
    try {
      const moduleUrl = pathToFileURL(path.join(customCommandsDir, file.name));
      const module = await import(moduleUrl.href);
      const command = module.default;

      validateCustomCommand(command, file.name);
      registerCommand(command);
      loaded += 1;
      console.log(`[custom-commands] Comando "${command.name}" carregado (${file.name}).`);
    } catch (error) {
      console.error(`[custom-commands] Falha ao carregar ${file.name}:`, error?.message ?? error);
    }
  }

  console.log(`[custom-commands] ${loaded} comando(s) personalizado(s) carregado(s).`);
  return loaded;
}
