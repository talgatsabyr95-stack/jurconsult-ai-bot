// app/src/bot/telegram.ts
import Fastify from "fastify";
import { cfg } from "../core/config";
import { supabase } from "../core/db";
import { generateReply } from "../llm/openai";

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
    let textOut: string;

    if (textIn === "/start") {
      textOut =
        "Здравствуйте! ЮрКонсалт AI на связи. Кратко опишите ваш вопрос и укажите юрисдикцию (например, KZ).";
    } else {
      // Генерируем ответ через OpenAI
      textOut = await generateReply(textIn || "пустой запрос");
    }

    // Сохраняем в Supabase
    await supabase.from("requests").insert({
      user_id: chatId,
      text: textIn,
      created_at: new Date().toISOString(),
    });

    // Отправляем ответ пользователю
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
    const port = Number(process.env.PORT) || 3000;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
