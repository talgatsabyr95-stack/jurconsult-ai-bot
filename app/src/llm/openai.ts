// app/src/llm/openai.ts
import OpenAI from "openai";
import { cfg } from "../core/config";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || cfg.openaiApiKey,
});

// Простая функция, чтобы генерировать ответ
export async function generateReply(prompt: string) {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты — вежливый юридический ассистент, отвечай кратко и по существу.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.4,
    });

    return res.choices[0].message.content?.trim() || "Извини, не понял вопрос.";
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    return "Произошла ошибка при генерации ответа.";
  }
}
