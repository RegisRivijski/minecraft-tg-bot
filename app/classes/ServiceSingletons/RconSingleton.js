import { Rcon } from 'rcon-client';

import config from '../../../config/default.js';

let client = null;
let connectPromise = null;
let shuttingDown = false;
let sendQueue = Promise.resolve();

function forgetClient(rcon) {
  if (client === rcon) {
    client = null;
  }
}

function listenForDisconnect(rcon) {
  rcon.on('end', () => forgetClient(rcon));
  rcon.on('error', (err) => {
    console.error('[rcon]', err.message);
    forgetClient(rcon);
  });
}

async function connect() {
  const rcon = await Rcon.connect({
    host: config.rcon.host,
    port: config.rcon.port,
    password: config.rcon.password,
    timeout: config.rcon.timeoutMs,
  });
  listenForDisconnect(rcon);
  client = rcon;
  console.info(`[rcon] connected ${config.rcon.host}:${config.rcon.port}`);
  return rcon;
}

async function getConnectedClient() {
  if (shuttingDown) {
    throw new Error('not connected');
  }
  if (client) {
    return client;
  }
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = connect().finally(() => {
    connectPromise = null;
  });
  return connectPromise;
}

async function dropConnection() {
  const rcon = client;
  client = null;
  if (!rcon) {
    return;
  }
  await rcon.end().catch(() => {});
}

async function sendCommand(command) {
  const rcon = await getConnectedClient();
  return String(await rcon.send(command) || '').trim();
}

export async function rconSend(command) {
  if (shuttingDown) {
    throw new Error('not connected');
  }

  const queued = sendQueue.then(() => sendWithRetry(command));
  sendQueue = queued.catch(() => {});
  return queued;
}

async function sendWithRetry(command) {
  try {
    return await sendCommand(command);
  } catch (err) {
    // Timeout / drop often leaves a half-dead socket; reconnect once and retry.
    console.warn('[rcon] command failed, reconnecting:', err.message);
    await dropConnection();
    return sendCommand(command);
  }
}

export async function closeRcon() {
  shuttingDown = true;
  if (connectPromise) {
    await connectPromise.catch(() => {});
  }
  await dropConnection();
}
