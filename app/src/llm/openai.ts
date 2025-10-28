// app/src/llm/openai.ts
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn("[openai] OPENAI_API_KEY is not set in environment");
}

export const openai = new OpenAI({ apiKey: apiKey || "" });

export async function generateReply(prompt: string) {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты — вежливый юридический ассистент-пресейл. Отвечай кратко, по делу, без финальных юрзаключений. Веди к офферу/броне.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.4,
    });

    return res.choices[0].message.content?.trim() || "Извините, не понял запрос.";
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    return "Произошла ошибка при генерации ответа.";
  }
}
