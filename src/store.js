import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
const filePath = 'data/store.json';
let cache;
let writeQueue = Promise.resolve();
const defaults = { aiEnabled: false, aiConversations: {}, groups: {}, users: {}, notes: {}, delegatedOwners: [], agendaEvents: [], processedMessageIds: [], weatherLocations: {}, accessControl: { authorized: [], pending: [], blocked: [], denied: [] } };
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
export async function getGroup(jid) { const data = await load(); return data.groups[jid] ??= { welcome: false, antiLink: false, antiSpam: false, x9: false, muted: [] }; }
export async function updateGroup(jid, patch) { const group = await getGroup(jid); Object.assign(group, patch); await persist(); return group; }
export async function getUser(jid) { const data = await load(); return data.users[jid] ??= { warnings: 0 }; }
export async function updateUser(jid, patch) { const user = await getUser(jid); Object.assign(user, patch); await persist(); return user; }
export async function listNotes(jid) { const data = await load(); return data.notes[jid] ?? {}; }
export async function setNote(jid, key, value) { const data = await load(); data.notes[jid] ??= {}; data.notes[jid][key] = value; await persist(); }
export async function deleteNote(jid, key) { const data = await load(); if (!data.notes[jid] || !(key in data.notes[jid])) return false; delete data.notes[jid][key]; await persist(); return true; }

export async function getDelegatedOwners() {
  const data = await load();
  if (!Array.isArray(data.delegatedOwners)) data.delegatedOwners = [];
  return [...data.delegatedOwners];
}
export async function addDelegatedOwner(jid) {
  const data = await load();
  if (!Array.isArray(data.delegatedOwners)) data.delegatedOwners = [];
  if (data.delegatedOwners.includes(jid)) return { added: false, reason: 'exists', owners: [...data.delegatedOwners] };
  if (data.delegatedOwners.length >= 6) return { added: false, reason: 'limit', owners: [...data.delegatedOwners] };
  data.delegatedOwners.push(jid);
  await persist();
  return { added: true, owners: [...data.delegatedOwners] };
}

export async function removeDelegatedOwner(jid) {
  const data = await load();
  if (!Array.isArray(data.delegatedOwners)) data.delegatedOwners = [];
  const normalizeJid = (value = '') => String(value).split(':')[0].trim().toLowerCase();
  const digits = (value = '') => normalizeJid(value).split('@')[0].replace(/\D/g, '');
  const target = normalizeJid(jid);
  const targetNumber = digits(jid);
  const index = data.delegatedOwners.findIndex((stored) => {
    const normalized = normalizeJid(stored);
    return normalized === target || (targetNumber.length >= 10 && digits(stored) === targetNumber);
  });
  if (index === -1) return { removed: false, owners: [...data.delegatedOwners] };
  const [removed] = data.delegatedOwners.splice(index, 1);
  await persist();
  return { removed: true, removedJid: removed, owners: [...data.delegatedOwners] };
}

export async function listAgendaEvents() {
  const data = await load();
  if (!Array.isArray(data.agendaEvents)) data.agendaEvents = [];
  return [...data.agendaEvents].sort((a, b) => a.timestamp - b.timestamp);
}

export async function addAgendaEvent(event) {
  const data = await load();
  if (!Array.isArray(data.agendaEvents)) data.agendaEvents = [];
  data.agendaEvents.push(event);
  await persist();
  return event;
}

export async function updateAgendaEvent(id, patch) {
  const data = await load();
  if (!Array.isArray(data.agendaEvents)) data.agendaEvents = [];
  const event = data.agendaEvents.find((item) => item.id === id);
  if (!event) return false;
  Object.assign(event, patch);
  await persist();
  return true;
}

export async function clearAgendaEvents() {
  const data = await load();
  const count = Array.isArray(data.agendaEvents) ? data.agendaEvents.length : 0;
  data.agendaEvents = [];
  await persist();
  return count;
}


// Persist a bounded window of message IDs to prevent replayed WhatsApp events.
const MAX_PROCESSED_MESSAGE_IDS = 500;
const PRUNE_PROCESSED_MESSAGE_IDS = 100;
let messageClaimQueue = Promise.resolve();

export function claimProcessedMessage(remoteJid, messageId) {
  const operation = messageClaimQueue.then(async () => {
    const chat = String(remoteJid ?? '').trim();
    const id = String(messageId ?? '').trim();
    if (!chat || !id) return true;

    const data = await load();
    if (!Array.isArray(data.processedMessageIds)) data.processedMessageIds = [];

    const key = chat + ':' + id;
    if (data.processedMessageIds.includes(key)) return false;

    data.processedMessageIds.push(key);
    if (data.processedMessageIds.length > MAX_PROCESSED_MESSAGE_IDS) {
      data.processedMessageIds.splice(0, PRUNE_PROCESSED_MESSAGE_IDS);
    }

    await persist();
    return true;
  });

  // Keep the queue usable after an individual persistence error.
  messageClaimQueue = operation.catch(() => {});
  return operation;
}


// Access registry: first-time registrations are automatic; removed users require approval.
function normalizeAccessNumber(value = '') {
  return String(value).replace(/\D/g, '');
}

export async function getAccessRegistry() {
  const data = await load();
  if (!data.accessControl || typeof data.accessControl !== 'object') {
    data.accessControl = { authorized: [], pending: [], blocked: [], denied: [] };
  }
  for (const key of ['authorized', 'pending', 'blocked', 'denied']) {
    if (!Array.isArray(data.accessControl[key])) data.accessControl[key] = [];
  }
  return structuredClone(data.accessControl);
}

export async function registerAccessRequest(number) {
  const normalized = normalizeAccessNumber(number);
  if (!normalized) return { status: 'invalid' };
  const data = await load();
  data.accessControl ??= { authorized: [], pending: [], blocked: [], denied: [] };
  const registry = data.accessControl;
  for (const key of ['authorized', 'pending', 'blocked', 'denied']) {
    if (!Array.isArray(registry[key])) registry[key] = [];
  }
  if (registry.authorized.includes(normalized)) return { status: 'authorized' };
  if (registry.blocked.includes(normalized)) return { status: 'blocked' };
  if (registry.pending.includes(normalized)) return { status: 'pending' };
  if (registry.denied.includes(normalized)) {
    registry.denied = registry.denied.filter(item => item !== normalized);
    registry.pending.push(normalized);
    await persist();
    return { status: 'pending' };
  }
  registry.authorized.push(normalized);
  await persist();
  return { status: 'authorized_new' };
}

export async function setAccessStatus(number, status) {
  const normalized = normalizeAccessNumber(number);
  const allowed = ['authorized', 'pending', 'blocked', 'denied'];
  if (!normalized || !allowed.includes(status)) return false;
  const data = await load();
  data.accessControl ??= { authorized: [], pending: [], blocked: [], denied: [] };
  const registry = data.accessControl;
  for (const key of allowed) {
    if (!Array.isArray(registry[key])) registry[key] = [];
    registry[key] = registry[key].filter(item => item !== normalized);
  }
  registry[status].push(normalized);
  await persist();
  return true;
}

export async function getAccessStatus(number) {
  const normalized = normalizeAccessNumber(number);
  const registry = await getAccessRegistry();
  for (const status of ['authorized', 'pending', 'blocked', 'denied']) {
    if (registry[status].includes(normalized)) return status;
  }
  return 'new';
}


// Preferred weather city, stored independently for each WhatsApp number.
export async function getWeatherLocation(number) {
  const normalized = normalizeAccessNumber(number);
  if (!normalized) return null;
  const data = await load();
  if (!data.weatherLocations || typeof data.weatherLocations !== 'object') data.weatherLocations = {};
  return data.weatherLocations[normalized] ?? null;
}

export async function setWeatherLocation(number, location) {
  const normalized = normalizeAccessNumber(number);
  const city = String(location ?? '').trim();
  if (!normalized || !city) return false;
  const data = await load();
  if (!data.weatherLocations || typeof data.weatherLocations !== 'object') data.weatherLocations = {};
  data.weatherLocations[normalized] = city;
  await persist();
  return true;
}


// Persistent automatic-AI settings and a bounded conversation window.
const MAX_AI_MESSAGES_PER_CHAT = 20;
const MAX_AI_CHATS = 100;

export async function getAIEnabled() {
  const data = await load();
  return data.aiEnabled === true;
}

export async function setAIEnabled(enabled) {
  const data = await load();
  data.aiEnabled = Boolean(enabled);
  await persist();
  return data.aiEnabled;
}

export async function getAIConversation(chatJid) {
  const data = await load();
  if (!data.aiConversations || typeof data.aiConversations !== 'object') data.aiConversations = {};
  const conversation = data.aiConversations[chatJid];
  return Array.isArray(conversation) ? conversation.slice(-MAX_AI_MESSAGES_PER_CHAT) : [];
}

export async function appendAIMessage(chatJid, message) {
  const data = await load();
  if (!data.aiConversations || typeof data.aiConversations !== 'object') data.aiConversations = {};
  const chat = String(chatJid ?? '').trim();
  if (!chat) return;
  const entry = {
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: String(message.content ?? '').slice(0, 4000),
    ...(message.sender ? { sender: String(message.sender) } : {}),
    timestamp: Number(message.timestamp) || Math.floor(Date.now() / 1000),
  };
  const history = Array.isArray(data.aiConversations[chat]) ? data.aiConversations[chat] : [];
  history.push(entry);
  data.aiConversations[chat] = history.slice(-MAX_AI_MESSAGES_PER_CHAT);

  const chatKeys = Object.keys(data.aiConversations);
  if (chatKeys.length > MAX_AI_CHATS) {
    chatKeys.sort((a, b) => {
      const aTime = data.aiConversations[a]?.at(-1)?.timestamp ?? 0;
      const bTime = data.aiConversations[b]?.at(-1)?.timestamp ?? 0;
      return aTime - bTime;
    });
    for (const oldChat of chatKeys.slice(0, chatKeys.length - MAX_AI_CHATS)) {
      delete data.aiConversations[oldChat];
    }
  }
  await persist();
}
