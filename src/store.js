import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
const filePath = 'data/store.json';
let cache;
let writeQueue = Promise.resolve();
const defaults = { groups: {}, users: {}, notes: {} };
async function load() {
  if (cache) return cache;
  await mkdir(dirname(filePath), { recursive: true });
  try { cache = { ...defaults, ...JSON.parse(await readFile(filePath, 'utf8')) }; }
  catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; cache = structuredClone(defaults); }
  return cache;
}
async function persist() {
  const data = await load(); const temp = `${filePath}.tmp`;
  writeQueue = writeQueue.then(async () => { await writeFile(temp, JSON.stringify(data, null, 2), 'utf8'); await rename(temp, filePath); });
  return writeQueue;
}
export async function getGroup(jid) { const data = await load(); return data.groups[jid] ??= { welcome: false, antiLink: false, antiSpam: false, muted: [] }; }
export async function updateGroup(jid, patch) { const group = await getGroup(jid); Object.assign(group, patch); await persist(); return group; }
export async function getUser(jid) { const data = await load(); return data.users[jid] ??= { warnings: 0 }; }
export async function updateUser(jid, patch) { const user = await getUser(jid); Object.assign(user, patch); await persist(); return user; }
export async function listNotes(jid) { const data = await load(); return data.notes[jid] ?? {}; }
export async function setNote(jid, key, value) { const data = await load(); data.notes[jid] ??= {}; data.notes[jid][key] = value; await persist(); }
export async function deleteNote(jid, key) { const data = await load(); if (!data.notes[jid] || !(key in data.notes[jid])) return false; delete data.notes[jid][key]; await persist(); return true; }
