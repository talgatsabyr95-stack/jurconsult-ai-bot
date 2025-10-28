// app/src/bot/telegram.ts
import Fastify from "fastify";
import { cfg } from "../core/config";
import { supa } from "../core/db";
import { generateReply } from "../llm/openai";

type ChatMem = { turns: string[] }; // хранит последние реплики "U:/A:"

const fastify = Fastify({ logger: true });
const mem = new Map<number, ChatMem>(); // per-chat краткая память

function pushTurn(chatId: number, role: "U" | "A", text: string) {
  const entry = mem.get(chatId) || { turns: [] };
  entry.turns.push(`${role}: ${text}`.slice(0, 2000)); // safety clip
  // держим только последние 6 реплик
  if (entry.turns.length > 6) entry.turns = entry.turns.slice(-6);
  mem.set(chatId, entry);
}

fastify.get("/", async () => ({ ok: true }));

fastify.post("/webhook", async (request, reply) => {
  const secret = request.headers["x-telegram-bot-api-secret-token"];
  if (cfg.webhookSecret && secret !== cfg.webhookSecret) {
    reply.code(401);
    return { ok: false, error: "invalid secret" };
  }

  const update: any = request.body;
  fastify.log.info({ update }, "update_received");

  const chatId = update?.message?.chat?.id as number | undefined;
  const textIn = (update?.message?.text as string | undefined)?.trim();

  if (!chatId || !textIn) return { ok: true };

  // 1) логируем вход в Supabase (as-is)
  try {
    await supa
      .from("messages_log")
      .insert({ tg_user_id: chatId, role: "user", content: textIn });
  } catch (e) {
    fastify.log.warn({ e }, "supa_log_user_failed");
  }

  // 2) /start — быстрый human-friendly ответ
  if (textIn === "/start") {
    const hello =
      "Здравствуйте! ЮрКонсалт AI на связи. Кратко опишите задачу (например: «нужно снять арест в KZ»).";
    pushTurn(chatId, "A", hello);
    await fetch(`https://api.telegram.org/bot${cfg.tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: hello }),
    });
    return { ok: true };
  }

  // 3) готовим короткий контекст (последние 6 реплик) + текущий запрос
  pushTurn(chatId, "U", textIn);
  const ctx = mem.get(chatId)?.turns?.join("\n") ?? "";
  const composite = `Контекст последних сообщений:\n${ctx}\n\nТекущее сообщение пользователя:\n${textIn}`;

  // 4) получаем ответ от OpenAI с учётом контекста (модель сама извлечёт intent и недостающие детали)
  let out = "Принял. Уточните, пожалуйста, детали.";
  try {
    const frame = await generateReply(composite);
    out = frame?.reply || out;

    // мягкое автопродвижение: если есть CTA — добавим
    if (frame?.cta) out += `\n\n${frame.cta}`;

    // лог ассистента
    await supa
      .from("messages_log")
      .insert({
        tg_user_id: chatId,
        role: "assistant",
        content: JSON.stringify(frame || { reply: out }),
      })
      .catch(() => {});
  } catch (e) {
    fastify.log.error({ e }, "llm_failed");
    out =
      "Коротко опишите задачу ещё раз (банк/МФО, сумма/сроки). Я подготовлю варианты решения и предложу пакет.";
  }

  pushTurn(chatId, "A", out);

  // 5) ответ пользователю
  await fetch(`https://api.telegram.org/bot${cfg.tgToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: out }),
  });

  return { ok: true };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
// app/src/bot/telegram.ts
import Fastify from "fastify";
import { cfg } from "../core/config";
import { supa } from "../core/db";
import { generateReply } from "../llm/openai";

type ChatMem = { turns: string[] }; // хранит последние реплики "U:/A:"

const fastify = Fastify({ logger: true });
const mem = new Map<number, ChatMem>(); // per-chat краткая память

function pushTurn(chatId: number, role: "U" | "A", text: string) {
  const entry = mem.get(chatId) || { turns: [] };
  entry.turns.push(`${role}: ${text}`.slice(0, 2000)); // safety clip
  // держим только последние 6 реплик
  if (entry.turns.length > 6) entry.turns = entry.turns.slice(-6);
  mem.set(chatId, entry);
}

fastify.get("/", async () => ({ ok: true }));

fastify.post("/webhook", async (request, reply) => {
  const secret = request.headers["x-telegram-bot-api-secret-token"];
  if (cfg.webhookSecret && secret !== cfg.webhookSecret) {
    reply.code(401);
    return { ok: false, error: "invalid secret" };
  }

  const update: any = request.body;
  fastify.log.info({ update }, "update_received");

  const chatId = update?.message?.chat?.id as number | undefined;
  const textIn = (update?.message?.text as string | undefined)?.trim();

  if (!chatId || !textIn) return { ok: true };

  // 1) логируем вход в Supabase (as-is)
  try {
    await supa
      .from("messages_log")
      .insert({ tg_user_id: chatId, role: "user", content: textIn });
  } catch (e) {
    fastify.log.warn({ e }, "supa_log_user_failed");
  }

  // 2) /start — быстрый human-friendly ответ
  if (textIn === "/start") {
    const hello =
      "Здравствуйте! ЮрКонсалт AI на связи. Кратко опишите задачу (например: «нужно снять арест в KZ»).";
    pushTurn(chatId, "A", hello);
    await fetch(`https://api.telegram.org/bot${cfg.tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: hello }),
    });
    return { ok: true };
  }

  // 3) готовим короткий контекст (последние 6 реплик) + текущий запрос
  pushTurn(chatId, "U", textIn);
  const ctx = mem.get(chatId)?.turns?.join("\n") ?? "";
  const composite = `Контекст последних сообщений:\n${ctx}\n\nТекущее сообщение пользователя:\n${textIn}`;

  // 4) получаем ответ от OpenAI с учётом контекста (модель сама извлечёт intent и недостающие детали)
  let out = "Принял. Уточните, пожалуйста, детали.";
  try {
    const frame = await generateReply(composite);
    out = frame?.reply || out;

    // мягкое автопродвижение: если есть CTA — добавим
    if (frame?.cta) out += `\n\n${frame.cta}`;

    // лог ассистента
    await supa
      .from("messages_log")
      .insert({
        tg_user_id: chatId,
        role: "assistant",
        content: JSON.stringify(frame || { reply: out }),
      })
      .catch(() => {});
  } catch (e) {
    fastify.log.error({ e }, "llm_failed");
    out =
      "Коротко опишите задачу ещё раз (банк/МФО, сумма/сроки). Я подготовлю варианты решения и предложу пакет.";
  }

  pushTurn(chatId, "A", out);

  // 5) ответ пользователю
  await fetch(`https://api.telegram.org/bot${cfg.tgToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: out }),
  });

  return { ok: true };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
// app/src/bot/telegram.ts
import Fastify from "fastify";
import { cfg } from "../core/config";
import { supa } from "../core/db";
import { generateReply } from "../llm/openai";

type ChatMem = { turns: string[] }; // хранит последние реплики "U:/A:"

const fastify = Fastify({ logger: true });
const mem = new Map<number, ChatMem>(); // per-chat краткая память

function pushTurn(chatId: number, role: "U" | "A", text: string) {
  const entry = mem.get(chatId) || { turns: [] };
  entry.turns.push(`${role}: ${text}`.slice(0, 2000)); // safety clip
  // держим только последние 6 реплик
  if (entry.turns.length > 6) entry.turns = entry.turns.slice(-6);
  mem.set(chatId, entry);
}

fastify.get("/", async () => ({ ok: true }));

fastify.post("/webhook", async (request, reply) => {
  const secret = request.headers["x-telegram-bot-api-secret-token"];
  if (cfg.webhookSecret && secret !== cfg.webhookSecret) {
    reply.code(401);
    return { ok: false, error: "invalid secret" };
  }

  const update: any = request.body;
  fastify.log.info({ update }, "update_received");

  const chatId = update?.message?.chat?.id as number | undefined;
  const textIn = (update?.message?.text as string | undefined)?.trim();

  if (!chatId || !textIn) return { ok: true };

  // 1) логируем вход в Supabase (as-is)
  try {
    await supa
      .from("messages_log")
      .insert({ tg_user_id: chatId, role: "user", content: textIn });
  } catch (e) {
    fastify.log.warn({ e }, "supa_log_user_failed");
  }

  // 2) /start — быстрый human-friendly ответ
  if (textIn === "/start") {
    const hello =
      "Здравствуйте! ЮрКонсалт AI на связи. Кратко опишите задачу (например: «нужно снять арест в KZ»).";
    pushTurn(chatId, "A", hello);
    await fetch(`https://api.telegram.org/bot${cfg.tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: hello }),
    });
    return { ok: true };
  }

  // 3) готовим короткий контекст (последние 6 реплик) + текущий запрос
  pushTurn(chatId, "U", textIn);
  const ctx = mem.get(chatId)?.turns?.join("\n") ?? "";
  const composite = `Контекст последних сообщений:\n${ctx}\n\nТекущее сообщение пользователя:\n${textIn}`;

  // 4) получаем ответ от OpenAI с учётом контекста (модель сама извлечёт intent и недостающие детали)
  let out = "Принял. Уточните, пожалуйста, детали.";
  try {
    const frame = await generateReply(composite);
    out = frame?.reply || out;

    // мягкое автопродвижение: если есть CTA — добавим
    if (frame?.cta) out += `\n\n${frame.cta}`;

    // лог ассистента
    await supa
      .from("messages_log")
      .insert({
        tg_user_id: chatId,
        role: "assistant",
        content: JSON.stringify(frame || { reply: out }),
      })
      .catch(() => {});
  } catch (e) {
    fastify.log.error({ e }, "llm_failed");
    out =
      "Коротко опишите задачу ещё раз (банк/МФО, сумма/сроки). Я подготовлю варианты решения и предложу пакет.";
  }

  pushTurn(chatId, "A", out);

  // 5) ответ пользователю
  await fetch(`https://api.telegram.org/bot${cfg.tgToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: out }),
  });

  return { ok: true };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
// app/src/bot/telegram.ts
import Fastify from "fastify";
import { cfg } from "../core/config";
import { supa } from "../core/db";
import { generateReply } from "../llm/openai";

type ChatMem = { turns: string[] }; // хранит последние реплики "U:/A:"

const fastify = Fastify({ logger: true });
const mem = new Map<number, ChatMem>(); // per-chat краткая память

function pushTurn(chatId: number, role: "U" | "A", text: string) {
  const entry = mem.get(chatId) || { turns: [] };
  entry.turns.push(`${role}: ${text}`.slice(0, 2000)); // safety clip
  // держим только последние 6 реплик
  if (entry.turns.length > 6) entry.turns = entry.turns.slice(-6);
  mem.set(chatId, entry);
}

fastify.get("/", async () => ({ ok: true }));

fastify.post("/webhook", async (request, reply) => {
  const secret = request.headers["x-telegram-bot-api-secret-token"];
  if (cfg.webhookSecret && secret !== cfg.webhookSecret) {
    reply.code(401);
    return { ok: false, error: "invalid secret" };
  }

  const update: any = request.body;
  fastify.log.info({ update }, "update_received");

  const chatId = update?.message?.chat?.id as number | undefined;
  const textIn = (update?.message?.text as string | undefined)?.trim();

  if (!chatId || !textIn) return { ok: true };

  // 1) логируем вход в Supabase (as-is)
  try {
    await supa
      .from("messages_log")
      .insert({ tg_user_id: chatId, role: "user", content: textIn });
  } catch (e) {
    fastify.log.warn({ e }, "supa_log_user_failed");
  }

  // 2) /start — быстрый human-friendly ответ
  if (textIn === "/start") {
    const hello =
      "Здравствуйте! ЮрКонсалт AI на связи. Кратко опишите задачу (например: «нужно снять арест в KZ»).";
    pushTurn(chatId, "A", hello);
    await fetch(`https://api.telegram.org/bot${cfg.tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: hello }),
    });
    return { ok: true };
  }

  // 3) готовим короткий контекст (последние 6 реплик) + текущий запрос
  pushTurn(chatId, "U", textIn);
  const ctx = mem.get(chatId)?.turns?.join("\n") ?? "";
  const composite = `Контекст последних сообщений:\n${ctx}\n\nТекущее сообщение пользователя:\n${textIn}`;

  // 4) получаем ответ от OpenAI с учётом контекста (модель сама извлечёт intent и недостающие детали)
  let out = "Принял. Уточните, пожалуйста, детали.";
  try {
    const frame = await generateReply(composite);
    out = frame?.reply || out;

    // мягкое автопродвижение: если есть CTA — добавим
    if (frame?.cta) out += `\n\n${frame.cta}`;

    // лог ассистента
    await supa
      .from("messages_log")
      .insert({
        tg_user_id: chatId,
        role: "assistant",
        content: JSON.stringify(frame || { reply: out }),
      })
      .catch(() => {});
  } catch (e) {
    fastify.log.error({ e }, "llm_failed");
    out =
      "Коротко опишите задачу ещё раз (банк/МФО, сумма/сроки). Я подготовлю варианты решения и предложу пакет.";
  }

  pushTurn(chatId, "A", out);

  // 5) ответ пользователю
  await fetch(`https://api.telegram.org/bot${cfg.tgToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: out }),
  });

  return { ok: true };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
