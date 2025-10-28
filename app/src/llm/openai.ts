// app/src/llm/openai.ts
import OpenAI from "openai";
import {
  SYSTEM_PROMPT,
  PACKAGES,
  QUALIFY_QUESTIONS,
  CTA_DEFAULT,
  SLOT_SAMPLES,
} from "../bot/prompts";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn("[openai] OPENAI_API_KEY is not set in environment");
}

export const openai = new OpenAI({ apiKey: apiKey || "" });

// Типы фрейма
export type BotFrame = {
  reply: string;
  intent: "arrest_unfreeze" | "mfo_schedule" | "bank_schedule" | "unknown";
  state: "idle" | "qa" | "offer" | "booking" | "handoff";
  need_handoff: boolean;
  questions: string[];
  offer?: {
    package: "BASIC" | "PRO" | "URGENT";
    bullets: string[];
    price: "individual";
  };
  slots?: string[];
  cta?: string;
};

// Безопасный парс JSON
function safeParse(jsonText: string): BotFrame {
  try {
    const obj = JSON.parse(jsonText);
    // Мягкая валидация ключевых полей
    if (
      typeof obj?.reply === "string" &&
      typeof obj?.intent === "string" &&
      typeof obj?.state === "string"
    ) {
      return obj as BotFrame;
    }
  } catch (_) {}
  // Фоллбек: минимальный ответ, чтобы не ронять поток
  return {
    reply:
      "Спасибо! Уточните, пожалуйста, юрисдикцию (например, KZ) и кратко опишите ситуацию — я предложу варианты.",
    intent: "unknown",
    state: "qa",
    need_handoff: false,
    questions: ["Укажите юрисдикцию (например, KZ).", "Опишите суть вопроса в 1–2 предложениях."],
    cta: CTA_DEFAULT,
    slots: SLOT_SAMPLES.slice(0, 2),
  };
}

// Основная функция: получить строгий JSON-фрейм
export async function generateFrame(userText: string): Promise<BotFrame> {
  const system = [
    SYSTEM_PROMPT.trim(),
    "",
    "Контекст (пакеты):",
    JSON.stringify(PACKAGES),
    "Контекст (вопросы для квалификации по услугам):",
    JSON.stringify(QUALIFY_QUESTIONS),
    "Стандартные слоты (если нет иных):",
    JSON.stringify(SLOT_SAMPLES),
    "CTA по умолчанию:",
    CTA_DEFAULT,
    "",
    "⚠️ Отвечай ТОЛЬКО валидным JSON строго по схеме.",
  ].join("\n");

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userText },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });

    const text = res.choices[0]?.message?.content?.trim() || "";
    return safeParse(text);
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    return safeParse("");
  }
}

// Удобный шорткат: только текст для ответа пользователю
export async function generateReply(userText: string): Promise<string> {
  const frame = await generateFrame(userText);
  return frame.reply || "Принял. Давайте проясним детали и подберём решение.";
}
