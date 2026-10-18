# Nyx-Bot-WA 💜

Bot de WhatsApp modular em Node.js com Baileys, autenticação por código de pareamento e comandos separados por nível de acesso.

## Requisitos

- Node.js 20 ou superior
- Um número de WhatsApp para conectar o bot
- Termux no Android ou outro terminal com Node.js

## Instalação no Termux

```bash
pkg update && pkg upgrade
pkg install nodejs git
git clone https://github.com/contatomateus81-design/Nyx-Bot-WA.git
cd Nyx-Bot-WA
npm install
cp .env.example .env
nano .env
npm start
```

Edite `.env` e substitua `OWNER_NUMBER` pelo número que vai conectar ao bot, com DDI + DDD + número, somente dígitos. Exemplo ilustrativo: `5511999999999`.

Quando o código aparecer no terminal, abra o WhatsApp no celular que será conectado: **Aparelhos conectados → Conectar com número de telefone**. Digite o código exibido. Não compartilhe esse código nem a pasta `sessions/`.

## Comandos iniciais

O prefixo padrão é `!` (pode ser alterado em `.env`).

| Comando | Acesso | Descrição |
|---|---|---|
| `!menu` | Membro | Mostra os comandos |
| `!ping` | Membro | Testa se o bot responde |
| `!owner` | Membro | Mostra o número configurado do dono |
| `!say <mensagem>` | Dono | Faz o bot repetir uma mensagem |

## Configuração

- `OWNER_NUMBER`: número do dono, em formato internacional e só dígitos.
- `BOT_PREFIX`: prefixo dos comandos.
- `BOT_NAME`: nome exibido pelo bot.

## Sessão e segurança

- A sessão é gravada em `sessions/` para continuar após reinicializações.
- `.env`, `sessions/` e `node_modules/` estão no `.gitignore`; nunca envie credenciais ao GitHub.
- Se o WhatsApp desconectar a sessão por logout, será necessário parear novamente.
- Use uma versão atualizada do Node.js e mantenha as dependências atualizadas.

## Desenvolvimento

```bash
npm run check
```

A estrutura já separa configuração, conexão, tratamento de mensagens e comandos. Próximas etapas naturais: comandos de grupo com verificação real de administrador, armazenamento de preferências por chat e testes automatizados.
