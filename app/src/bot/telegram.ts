// app/src/bot/telegram.ts
import Fastify from "fastify";
import { cfg } from "../core/config";

const fastify = Fastify({ logger: true });

fastify.post("/webhook", async (request, reply) => {
  const secret = request.headers["x-telegram-bot-api-secret-token"];
  if (cfg.webhookSecret && secret !== cfg.webhookSecret) {
    reply.code(401);
    return { ok: false, error: "invalid secret" };
  }

  const update: any = request.body;
  fastify.log.info({ update }, "update_received");

  const chatId = update?.message?.chat?.id;
  const textIn = update?.message?.text as string | undefined;

  if (chatId) {
    const textOut =
      textIn === "/start"
        ? "Здравствуйте! ЮрКонсалт AI на связи. Кратко опишите ваш вопрос и укажите юрисдикцию (например, KZ)."
        : `Принял: ${textIn ?? "сообщение"}\n(это тестовый ответ, сейчас настроим полноценный диалог)`;

    await fetch(`https://api.telegram.org/bot${cfg.tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: textOut }),
    });
  }

  return { ok: true };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT || 3000);
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 Server running on http://0.0.0.0:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
