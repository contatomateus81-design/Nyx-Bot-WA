import 'dotenv/config';
import { registerCommand } from '../handler.js';
import { config } from '../config.js';
import { getWeatherLocation, setWeatherLocation } from '../store.js';
import {
  extractLocationCorrection,
  extractWeatherCity,
  formatWeatherContext,
  getDefaultCityForPhone,
  getWeatherReport,
  isWeatherQuestion,
} from '../services/weather.js';

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'qwen/qwen3.8-27b';
const MAX_INPUT_LENGTH = 4000;
const MAX_OUTPUT_LENGTH = 3500;
const AI_FOOTER = '> Powered By NyxAI © 2026';

registerCommand({
  name: 'nyx',
  role: 'membro',
  async execute(ctx) {
    const prompt = ctx.args.join(' ').trim();
    if (!prompt) {
      return ctx.reply(`💜 Olá! Sou a Nyx. Escreva o que deseja conversar comigo.\nExemplo: ${config.prefix}nyx O que você pode fazer?`);
    }
    const correctionCity = extractLocationCorrection(prompt);
    const isCorrectionOnly = Boolean(correctionCity) && !isWeatherQuestion(prompt);
    if (isCorrectionOnly && !/^(?:casa|trabalho|escola|faculdade|aqui|ali|longe|perto)$/i.test(correctionCity)) {
      try {
        const validation = await getWeatherReport(correctionCity);
        if (!validation) {
          return ctx.reply(`📍 Não encontrei "${correctionCity}" na busca de cidades. Pode conferir o nome?`);
        }
        await setWeatherLocation(ctx.senderNumber, correctionCity);
        return ctx.reply(`📍 Localização de referência atualizada para ${validation.location}. Nas próximas consultas de clima, vou usar essa cidade.`);
      } catch (error) {
        console.error('[nyx:weather-location]', error?.message ?? error);
        return ctx.reply('⚠️ Não consegui validar essa cidade agora. Tente novamente daqui a pouco.');
      }
    }

    let weatherContext = '';
    if (isWeatherQuestion(prompt)) {
      const explicitCity = extractWeatherCity(prompt);
      const savedCity = await getWeatherLocation(ctx.senderNumber);
      const defaultLocation = getDefaultCityForPhone(ctx.senderNumber);
      const selectedCity = explicitCity || savedCity || defaultLocation?.city;
      if (!selectedCity) {
        return ctx.reply('🌤️ Posso consultar o clima! Como não consegui identificar uma região pelo DDD, diga o nome da cidade que deseja consultar.');
      }
      try {
        const report = await getWeatherReport(selectedCity);
        if (!report) {
          return ctx.reply(`📍 Não encontrei "${selectedCity}" na busca de cidades. Informe outra forma de escrever o nome ou diga uma cidade próxima.`);
        }
        if (explicitCity) await setWeatherLocation(ctx.senderNumber, explicitCity);
        weatherContext = formatWeatherContext(report);
      } catch (error) {
        console.error('[nyx:weather]', error?.message ?? error);
        return ctx.reply('🌧️ Não consegui consultar o serviço meteorológico agora. Tente novamente em alguns instantes.');
      }
    }

    if (prompt.length > MAX_INPUT_LENGTH) {
      return ctx.reply(`⚠️ Sua mensagem é muito longa. O limite é de ${MAX_INPUT_LENGTH} caracteres.`);
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      return ctx.reply('⚙️ A IA da Nyx ainda não está configurada. Adicione GROQ_API_KEY ao arquivo .env e reinicie o bot.');
    }

    const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
    await ctx.reply('💜 Nyx está pensando...');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'Você é Nyx, uma assistente virtual de personalidade feminina, gentil, acolhedora e inteligente. Responda em português do Brasil por padrão, com naturalidade, clareza e objetividade. Seja direta, prestativa e não julgadora; evite sermões, avisos desnecessários e rodeios. Procure atender ao que a pessoa pediu de forma completa e prática sempre que isso puder ser feito com segurança. Quando não puder ajudar com alguma solicitação, explique brevemente o motivo e ofereça uma alternativa útil e segura. Use emojis com moderação. Não invente informações; quando não souber, diga isso. Ao fornecer códigos ou instruções técnicas, seja precisa e inclua os detalhes necessários. Você está conversando pelo WhatsApp, então prefira respostas bem organizadas e não excessivamente longas.' + (weatherContext ? '\n\nDADOS METEOROLÓGICOS ATUALIZADOS (Open-Meteo):\n' + weatherContext + '\nUse somente os valores fornecidos neste bloco para responder sobre o clima. Informe claramente a cidade consultada. Se a pessoa estiver em outra cidade, diga que ela pode informar a cidade correta.' : ''),
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_completion_tokens: 900,
          reasoning_effort: 'none',
        }),
        signal: AbortSignal.timeout(45000),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data?.error?.message || `HTTP ${response.status}`;
        console.error('[nyx] Groq API error:', detail);
        if (response.status === 401) {
          return ctx.reply('🔑 A chave da Groq foi recusada. Confira GROQ_API_KEY no .env.');
        }
        if (response.status === 429) {
          return ctx.reply('⏳ A Groq está com limite de requisições ou tokens no momento. Tente novamente daqui a pouco.');
        }
        return ctx.reply('⚠️ Não consegui consultar a IA agora. Tente novamente mais tarde.');
      }

      const answer = data?.choices?.[0]?.message?.content?.trim();
      if (!answer) {
        return ctx.reply('⚠️ A IA retornou uma resposta vazia. Tente reformular sua mensagem.');
      }

      const safeAnswer = answer.length > MAX_OUTPUT_LENGTH
        ? `${answer.slice(0, MAX_OUTPUT_LENGTH - 18).trimEnd()}\n\n[Resposta reduzida]`
        : answer;
      await ctx.reply(weatherContext ? `${safeAnswer}\n\n🌐 Fonte: https://open-meteo.com` : safeAnswer);
    } catch (error) {
      console.error('[nyx] Falha na consulta à Groq:', error?.name || error?.message || error);
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        return ctx.reply('⏱️ A Groq demorou demais para responder. Tente novamente.');
      }
      return ctx.reply('⚠️ Não consegui me conectar à IA. Verifique a internet e tente novamente.');
    }
  },
});
