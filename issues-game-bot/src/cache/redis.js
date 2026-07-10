import { createClient } from "redis";

function isEnabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function encodePart(value) {
  return encodeURIComponent(String(value || ""));
}

export function isRedisConfigured(env = process.env) {
  return Boolean(env.REDIS_URL || env.REDIS_HOST);
}

export function buildRedisUrl(env = process.env) {
  if (env.REDIS_URL) {
    return env.REDIS_URL;
  }

  if (!env.REDIS_HOST) {
    return "";
  }

  const scheme = isEnabled(env.REDIS_TLS) ? "rediss" : "redis";
  const host = env.REDIS_HOST.trim();
  const port = String(env.REDIS_PORT || "6379").trim();
  const username = env.REDIS_USERNAME ? encodePart(env.REDIS_USERNAME.trim()) : "";
  const password = env.REDIS_PASSWORD ? encodePart(env.REDIS_PASSWORD.trim()) : "";
  let auth = "";

  if (username && password) {
    auth = `${username}:${password}@`;
  } else if (password) {
    auth = `:${password}@`;
  } else if (username) {
    auth = `${username}@`;
  }

  return `${scheme}://${auth}${host}:${port}`;
}

async function connectClient() {
  const url = buildRedisUrl();
  if (!url) {
    return null;
  }

  const client = createClient({ url });
  client.on("error", (error) => {
    console.error("Redis client error", error);
  });
  await client.connect();
  return client;
}

async function getClient() {
  if (!isRedisConfigured()) {
    return null;
  }

  if (!getClient._clientPromise) {
    getClient._clientPromise = connectClient().catch((error) => {
      getClient._clientPromise = null;
      throw error;
    });
  }

  return getClient._clientPromise;
}

export async function disconnectRedis() {
  if (!getClient._clientPromise) {
    return;
  }

  try {
    const client = await getClient._clientPromise;
    if (client) {
      await client.quit();
    }
  } finally {
    getClient._clientPromise = null;
  }
}

export async function getRedisJson(key) {
  const client = await getClient();
  if (!client) {
    return null;
  }

  const raw = await client.get(key);
  if (!raw) {
    return null;
  }

  return JSON.parse(raw);
}

export async function setRedisJson(key, value, ttlSeconds = 0) {
  const client = await getClient();
  if (!client) {
    return false;
  }

  const payload = JSON.stringify(value);
  if (ttlSeconds > 0) {
    await client.set(key, payload, { EX: ttlSeconds });
  } else {
    await client.set(key, payload);
  }
  return true;
}

export async function pingRedis() {
  const client = await getClient();
  if (!client) {
    return null;
  }
  return client.ping();
}
