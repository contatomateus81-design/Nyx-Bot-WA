import { registerCommand } from '../handler.js';
import { config } from '../config.js';
import { formatDuration } from '../utils.js';
const startedAt=Date.now();
registerCommand({name:'runtime',aliases:['uptime'],role:'membro',async execute({reply}){await reply(`⏱️ Tempo ligado: ${formatDuration(Date.now()-startedAt)}`);}});
registerCommand({name:'about',aliases:['sobre'],role:'membro',async execute({reply}){await reply(`💜 *${config.name}*\nBot modular em Node.js + Baileys.\nPrefixo: ${config.prefix}`);}});
registerCommand({name:'choose',aliases:['escolher'],role:'membro',async execute({reply,args}){const options=args.join(' ').split('|').map(s=>s.trim()).filter(Boolean);if(options.length<2)return reply(`Uso: ${config.prefix}choose opção 1 | opção 2`);await reply(`🎲 Minha escolha: *${options[Math.floor(Math.random()*options.length)]}*`);}});
registerCommand({name:'8ball',aliases:['bola8'],role:'membro',async execute({reply,args}){if(!args.length)return reply(`Faça uma pergunta. Ex.: ${config.prefix}8ball vou ter sorte hoje?`);const answers=['Com certeza! ✨','Parece promissor.','Melhor não contar com isso.','Pergunte novamente mais tarde.','As chances são boas!','Não parece provável.','Confie na sua intuição.'];await reply(`🎱 ${answers[Math.floor(Math.random()*answers.length)]}`);}});
