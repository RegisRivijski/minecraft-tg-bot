import { Rcon } from 'rcon-client';

import config from '../../../config/default.js';

let client = null;
let connecting = null;

function attach(rcon) {
  rcon.on('end', () => {
    if (client === rcon) {
      client = null;
    }
  });
  rcon.on('error', (err) => {
    console.error('[rcon]', err.message);
    if (client === rcon) {
      client = null;
    }
  });
}

async function getClient() {
  if (client) {
    return client;
  }
  if (connecting) {
    return connecting;
  }

  connecting = (async () => {
    const rcon = await Rcon.connect({
      host: config.rcon.host,
      port: config.rcon.port,
      password: config.rcon.password,
      timeout: config.rcon.timeoutMs,
    });
    attach(rcon);
    client = rcon;
    console.info(`[rcon] connected ${config.rcon.host}:${config.rcon.port}`);
    return rcon;
  })().finally(() => {
    connecting = null;
  });

  return connecting;
}

export async function rconSend(command) {
  const rcon = await getClient();
  const result = await rcon.send(command);
  return String(result || '').trim();
}

export async function closeRcon() {
  const rcon = client;
  client = null;
  if (!rcon) {
    return;
  }
  await rcon.end().catch(() => {});
}
