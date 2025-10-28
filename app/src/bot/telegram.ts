// app/src/bot/telegram.ts
import Fastify from "fastify";
import { cfg } from "../core/config";
import { generateFrame } from "../llm/openai";

type ChatMem = { turns: string[] }; // последние реплики "U:/A:"
const fastify = Fastify({ logger: true });
const mem = new Map<number, ChatMem>();

function pushTurn(chatId: number, role: "U" | "A", text: string) {
  const entry = mem.get(chatId) || { turns: [] };
  entry.turns.push(`${role}: ${text}`.slice(0, 2000));
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

  // Краткий контекст + текущая реплика
  pushTurn(chatId, "U", textIn);
  const ctx = mem.get(chatId)?.turns?.join("\n") ?? "";
  const composite = `Контекст последних сообщений:\n${ctx}\n\nТекущее сообщение пользователя:\n${textIn}`;

  // LLM → строгий JSON-фрейм
  let out = "Принял. Уточните, пожалуйста, детали.";
  try {
    const frame = await generateFrame(composite);
    out = frame?.reply || out;
    if (frame?.cta) out += `\n\n${frame.cta}`;
  } catch (e) {
    fastify.log.error({ e }, "llm_failed");
    out =
      "Коротко опишите задачу ещё раз (банк/МФО, сумма/сроки). Я предложу варианты решения и пакет.";
  }

  pushTurn(chatId, "A", out);

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
