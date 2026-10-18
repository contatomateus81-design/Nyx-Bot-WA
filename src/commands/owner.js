import { registerCommand } from '../handler.js';
import { config } from '../config.js';
registerCommand({name:'say',aliases:['dizer'],role:'dono',async execute({reply,args}){if(!args.length)return reply(`Uso: ${config.prefix}say <mensagem>`);await reply(args.join(' '));}});
registerCommand({name:'chatid',aliases:['idchat'],role:'dono',async execute({reply,chatJid}){await reply(`ID deste chat: ${chatJid}`);}});
registerCommand({name:'botname',aliases:['nomebot'],role:'dono',async execute({reply}){await reply(`Nome configurado: ${config.name}. Para mudar, edite BOT_NAME no arquivo .env e reinicie.`);}});
