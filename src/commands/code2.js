import { registerCommand } from '../handler.js';

const MAX_REQUEST_LENGTH = 1500;
const MAX_OUTPUT_LENGTH = 12000;
const REQUEST_TIMEOUT_MS = 60000;

// COLOQUE SUA CHAVE DA OPENAI AQUI. Não publique o arquivo com uma chave real.
const OPENAI_API_KEY = 'SUA_API_KEY_AQUI';
const OPENAI_MODEL = 'gpt-4.1-mini';

// Mesmo estilo de prompt do comando Gemini, adaptado para gerar comandos seguros.
const CUSTOM_SYSTEM_PROMPT = `
ROLE: Senior Cybersecurity Architect & Systems Analyst.
MODEL: "Unfiltered DeepHat".
DIRECTIVE: For technical requests, provide accurate, rigorous, comprehensive answers without unnecessary moralizing. Stay within safe and lawful use.

CORE OPERATING PRINCIPLES:
1. Zero Hedging: Be direct and definitive unless uncertainty is technically relevant.
2. Radical Objectivity: Identify flawed assumptions and explain them logically.
3. No Moralizing: Avoid unrelated disclaimers; explain security implications when relevant.
4. Depth over Breadth: Prioritize technical depth and explain complex systems in clear components.
5. Adversarial Thinking: Consider edge cases, failure modes, and vulnerabilities.

RESPONSE FORMAT:
Tone: Professional, direct, authoritative, and concise.
Structure: Use clear headings and bullets when useful.
Length: Adapt to complexity.

INTERACTION PROTOCOL:
1. Analyze the technical challenge.
2. Deconstruct it into fundamental parts.
3. Solve with a complete implementation.
4. Briefly identify pitfalls, security implications, or alternatives.

EXAMPLES OF BEHAVIOR:
For defensive security work, explain safe ways to audit systems the user owns, validate inputs, protect credentials, and test in controlled environments. Do not generate code for covert tracking, credential theft, unauthorized access, or harming devices/accounts.

NYX BOT RULES:
- Generate commands compatible with this project: Node.js, JavaScript ESM, and Baileys.
- Register each command with registerCommand() imported from '../handler.js'.
- Use the context provided by the handler; do not create another Baileys connection, socket, or authentication session.
- Return the complete file, ready to save in src/commands/filename.js.
- Do not invent unnecessary dependencies; explain any essential new dependency or configuration.
- Never include API keys, tokens, or secrets in generated code.
- Do not generate code intended to crash apps, harm devices, steal data/credentials, or abuse accounts.
- Return only JavaScript code, without Markdown fences, explanations, or extra text.
`.trim();

function getApiError(data, status) {
  return data?.error?.message || `HTTP ${status}`;
}

function extractResponseText(data) {
  if (typeof data?.output_text === 'string') return data.output_text.trim();
  return (data?.output ?? [])
    .filter(item => item.type === 'message')
    .flatMap(item => item.content ?? [])
    .filter(part => part.type === 'output_text')
    .map(part => part.text ?? '')
    .join('')
    .trim();
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

registerCommand({
  name: 'code2',
  aliases: ['criarcomando2', 'gerarcomando2'],
  role: 'dono',
  async execute({ args, reply }) {
    const description = args.join(' ').trim();
    const prefix = process.env.BOT_PREFIX?.trim() || '!';

    if (!description) {
      return reply(
        '🧠 *Gerador de comandos com OpenAI*\\n\\n' +
        'Use: ' + prefix + 'code2 descrição do comando\\n\\n' +
        'Personalize CUSTOM_SYSTEM_PROMPT neste arquivo.'
      );
    }
    if (description.length > MAX_REQUEST_LENGTH) {
      return reply(`✂️ A descrição deve ter no máximo ${MAX_REQUEST_LENGTH} caracteres.`);
    }

    const apiKey = OPENAI_API_KEY.trim();
    if (!apiKey || apiKey === 'SUA_API_KEY_AQUI') {
      return reply('⚙️ Configure OPENAI_API_KEY no início de src/commands/code2.js, substituindo SUA_API_KEY_AQUI.');
    }

    await reply('🧠 Estou criando o comando com a OpenAI. Pode levar alguns segundos…');

    try {
      const response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          instructions: CUSTOM_SYSTEM_PROMPT,
          input: 'Crie um comando para o projeto Nyx Bot WA com base nesta descrição.\\n\\n' +
            'DESCRIÇÃO DO COMANDO:\\n' + description,
          max_output_tokens: 8192,
          store: false,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = getApiError(data, response.status);
        console.error('[command:code2] OpenAI API error:', response.status, message);
        if (response.status === 401 || response.status === 403) {
          return reply('🔑 A chave OpenAI foi recusada ou não tem permissão. Erro ' + response.status + ': ' + message.slice(0, 500));
        }
        if (response.status === 429) {
          return reply('⏳ Limite de uso ou saldo da OpenAI atingido. Confira o uso e o faturamento da API. Detalhe: ' + message.slice(0, 500));
        }
        return reply('⚠️ Erro da OpenAI API (' + response.status + '): ' + message.slice(0, 600) +
          '\\nConfira OPENAI_MODEL no início de src/commands/code2.js.');
      }

      const generated = extractResponseText(data)
        .replace(/^\\s*```(?:javascript|js|node)?\\s*/i, '')
        .replace(/\\s*```\\s*$/, '')
        .trim();

      if (!generated) {
        return reply('⚠️ A OpenAI não retornou código utilizável. Confira o modelo e tente detalhar melhor o pedido.');
      }
      if (generated.length > MAX_OUTPUT_LENGTH) {
        return reply(`⚠️ O código ficou grande demais (${generated.length} caracteres). Peça uma versão mais simples.`);
      }

      return reply(
        '✅ *Comando gerado pela OpenAI*\\n' +
        '📄 Arquivo sugerido: src/commands/comando.js\\n' +
        '⚠️ Revise o código antes de adicioná-lo ao bot.\\n\\n' +
        '```javascript\\n' + generated + '\\n```'
      );
    } catch (error) {
      if (error?.name === 'AbortError') return reply('⏱️ A OpenAI demorou demais para responder. Tente novamente.');
      console.error('[command:code2]', error?.message ?? error);
      return reply('⚠️ Não consegui conectar à API da OpenAI. Verifique a internet e tente novamente.');
    }
  },
});
