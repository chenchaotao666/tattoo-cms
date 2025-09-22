import { request } from '@umijs/max';

// 语言代码映射
const LANGUAGE_MAPPING: Record<string, string> = {
  en: 'English',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
};

/**
 * 翻译文本
 * @param text 要翻译的文本
 * @param fromLang 源语言代码
 * @param toLang 目标语言代码
 * @returns 翻译后的文本
 */
export async function translateText(
  text: string,
  fromLang: string = 'en',
  toLang: string
): Promise<string> {
  if (!text || !text.trim()) {
    return '';
  }

  if (fromLang === toLang) {
    return text;
  }

  try {
    const fromLanguage = LANGUAGE_MAPPING[fromLang] || 'English';
    const toLanguage = LANGUAGE_MAPPING[toLang] || 'Chinese';

    const response = await request('/api/translate', {
      method: 'POST',
      data: {
        text,
        fromLanguage,
        toLanguage,
        context: 'category', // 提供上下文以获得更准确的翻译
      },
    });

    return response.data?.translatedText || text;
  } catch (error) {
    console.error('Translation failed:', error);
    throw new Error('翻译服务暂时不可用');
  }
}

/**
 * 批量翻译
 * @param texts 要翻译的文本数组
 * @param fromLang 源语言代码
 * @param toLang 目标语言代码
 * @returns 翻译后的文本数组
 */
export async function translateBatch(
  texts: string[],
  fromLang: string = 'en',
  toLang: string
): Promise<string[]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  if (fromLang === toLang) {
    return texts;
  }

  try {
    const fromLanguage = LANGUAGE_MAPPING[fromLang] || 'English';
    const toLanguage = LANGUAGE_MAPPING[toLang] || 'Chinese';

    const response = await request('/api/translate/batch', {
      method: 'POST',
      data: {
        texts,
        fromLanguage,
        toLanguage,
        context: 'category',
      },
    });

    return response.data?.translatedTexts || texts;
  } catch (error) {
    console.error('Batch translation failed:', error);
    throw new Error('批量翻译服务暂时不可用');
  }
}

/**
 * 翻译富文本内容，保留HTML结构
 * @param htmlText 富文本HTML内容
 * @param fromLang 源语言代码
 * @param toLang 目标语言代码
 * @returns 翻译后的富文本HTML内容
 */
export async function translateRichText(
  htmlText: string,
  fromLang: string = 'en',
  toLang: string
): Promise<string> {
  if (!htmlText || !htmlText.trim()) {
    return '';
  }

  if (fromLang === toLang) {
    return htmlText;
  }

  try {
    // 提取HTML中的纯文本内容，保留结构信息
    const textNodes: string[] = [];
    const htmlStructure = htmlText.replace(/>(.*?)</g, (match, textContent) => {
      if (textContent.trim()) {
        const index = textNodes.length;
        textNodes.push(textContent.trim());
        return `>__TEXT_${index}__<`;
      }
      return match;
    });

    // 如果没有找到文本内容，直接翻译整个内容
    if (textNodes.length === 0) {
      // 移除HTML标签进行翻译
      const plainText = htmlText.replace(/<[^>]*>/g, '');
      if (!plainText.trim()) {
        return htmlText; // 如果没有文本内容，直接返回原HTML
      }
      const translatedPlainText = await translateText(plainText, fromLang, toLang);
      return htmlText.replace(plainText, translatedPlainText);
    }

    // 批量翻译所有文本节点
    const translatedNodes = await translateBatch(textNodes, fromLang, toLang);

    // 将翻译后的文本重新插入HTML结构
    let result = htmlStructure;
    translatedNodes.forEach((translatedText, index) => {
      result = result.replace(`__TEXT_${index}__`, translatedText);
    });

    return result;
  } catch (error) {
    console.error('Rich text translation failed:', error);
    // 如果富文本翻译失败，降级到纯文本翻译
    try {
      const plainText = htmlText.replace(/<[^>]*>/g, '');
      const translatedPlainText = await translateText(plainText, fromLang, toLang);
      return htmlText.replace(plainText, translatedPlainText);
    } catch (fallbackError) {
      console.error('Fallback translation also failed:', fallbackError);
      return htmlText; // 最终降级：返回原文
    }
  }
}
