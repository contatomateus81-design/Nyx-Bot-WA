# Nyx-Bot-WA 💜

Bot MD de WhatsApp em Node.js com Baileys, pareamento por código, comandos modulares, moderação de grupos e configurações persistentes.

## Instalar no Termux
```bash
pkg update && pkg upgrade
pkg install nodejs git
git clone https://github.com/contatomateus81-design/Nyx-Bot-WA.git
cd Nyx-Bot-WA
npm install
cp .env.example .env
nano .env
npm run check
npm start
```
Configure `OWNER_NUMBER` no `.env` com DDI + DDD + número, somente dígitos. Use o código exibido em WhatsApp > Aparelhos conectados > Conectar com número de telefone. Não compartilhe o código nem a pasta `sessions/`.

## Comandos disponíveis
- `!menu`, `!ping`, `!runtime`, `!about`, `!owner`
- `!choose opção A | opção B`, `!8ball pergunta`
- `!groupinfo`, `!tagall` (admin)
- `!kick`, `!promote`, `!demote` (admin)
- `!link`, `!revoke`, `!subject`, `!desc` (admin)
- `!closegroup`, `!opengroup`, `!welcome on/off`, `!antilink on/off` (admin)
- `!warn`, `!note add/get/list/del` (admin)
- `!say`, `!chatid`, `!botname` (dono)

Prefixo padrão: `!`. Edite `BOT_PREFIX` e `BOT_NAME` no `.env` para personalizar.

## Sessão e armazenamento
A sessão é gravada em `sessions/`; configurações, avisos e notas ficam em `data/`. Esses dados locais e o `.env` não devem ser enviados ao GitHub. Os comandos administrativos dependem das permissões reais no grupo.

## Verificação
Execute `npm run check` para validar a sintaxe JavaScript. O GitHub Actions também executa a checagem em pushes e pull requests. Isso não substitui um teste de conexão real com o WhatsApp.
