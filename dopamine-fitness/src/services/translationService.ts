/**
 * TranslationService — перевод текста через MyMemory API (бесплатно, без ключа).
 * Лимит: ~10 000 слов/день на IP.
 * Каждый перевод кешируется в KV на 30 дней — повторные вызовы бесплатны.
 */

import type { KVNamespace } from "@cloudflare/workers-types";

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 дней

export class TranslationService {
  constructor(private kv: KVNamespace) {}

  /**
   * Переводит строку с английского на русский.
   * Возвращает null если перевод не получен или совпадает с исходником.
   */
  async translate(text: string): Promise<string | null> {
    if (!text?.trim()) return null;

    const cacheKey = `translate:en-ru:${text.slice(0, 200)}`;
    const cached = await this.kv.get(cacheKey);
    if (cached !== null) return cached || null;

    try {
      const url = new URL(MYMEMORY_URL);
      url.searchParams.set("q", text.slice(0, 500)); // MyMemory ограничивает длину
      url.searchParams.set("langpair", "en|ru");

      const resp = await fetch(url.toString(), {
        headers: { "User-Agent": "DopamineFitness/1.0" },
      });
      if (!resp.ok) {
        await this.kv.put(cacheKey, "", { expirationTtl: 3600 }); // кешируем неудачу на час
        return null;
      }

      const data = await resp.json<{
        responseStatus: number;
        responseData: { translatedText: string; match: number };
      }>();

      if (data.responseStatus !== 200) {
        await this.kv.put(cacheKey, "", { expirationTtl: 3600 });
        return null;
      }

      const translated = data.responseData.translatedText?.trim();
      // Если перевод == исходник или содержит MYMEMORY-ошибки — отбрасываем
      if (
        !translated ||
        translated.toLowerCase() === text.toLowerCase() ||
        translated.toUpperCase().startsWith("MYMEMORY")
      ) {
        await this.kv.put(cacheKey, "", { expirationTtl: CACHE_TTL_SECONDS });
        return null;
      }

      await this.kv.put(cacheKey, translated, { expirationTtl: CACHE_TTL_SECONDS });
      return translated;
    } catch {
      return null;
    }
  }

  /**
   * Переводит пачку строк, возвращает массив результатов.
   * Паузы между запросами для соблюдения rate-limit MyMemory.
   */
  async translateBatch(
    items: Array<{ id: number; name_en: string; instructions_en: string | null }>
  ): Promise<Array<{ id: number; name_ru: string | null; instructions_ru: string | null }>> {
    const results: Array<{ id: number; name_ru: string | null; instructions_ru: string | null }> = [];

    for (const item of items) {
      const name_ru = await this.translate(item.name_en);
      // Инструкции переводим только если есть текст
      const instructions_ru = item.instructions_en
        ? await this.translate(item.instructions_en)
        : null;

      results.push({ id: item.id, name_ru, instructions_ru });

      // ~200ms между запросами чтобы не превысить лимит
      await new Promise((r) => setTimeout(r, 200));
    }

    return results;
  }
}
