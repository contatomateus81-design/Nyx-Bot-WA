# Nyx-Bot-WA 💜

Bot de WhatsApp em Node.js com Baileys, pareamento por código, comandos modulares, moderação de grupos e configurações persistentes.

## Instalação no Termux

1. Atualize os pacotes e instale Node.js e Git:

```bash
pkg update && pkg upgrade
pkg install nodejs git
```

2. Clone o repositório e instale as dependências:

```bash
git clone https://github.com/contatomateus81-design/Nyx-Bot-WA.git
cd Nyx-Bot-WA
npm install
```

## Configuração do arquivo .env

O arquivo `.env` guarda configurações privadas da sua instalação. Ele não é enviado ao GitHub. O repositório fornece um modelo chamado `.env.example`.

1. Crie seu arquivo local copiando o modelo:

```bash
cp .env.example .env
```

2. Abra o arquivo para edição:

```bash
nano .env
```

3. Preencha as configurações:

| Variável | O que colocar |
| --- | --- |
| `OWNER_NUMBER` | Seu número de WhatsApp com código do país e DDD, somente dígitos. No Brasil: `55 + DDD + número`. |
| `BOT_PREFIX` | Prefixo dos comandos. O padrão é `!`. |
| `BOT_NAME` | Nome exibido para o bot. O padrão é `Nyx Bot`. |
| `GEMINI_API_KEY` | Chave da API Gemini, caso utilize a integração correspondente. Deixe vazia se não usar. |
| `GEMINI_MODEL` | Modelo Gemini configurado para a integração, se utilizada. |

Exemplo de número fictício: `5554991234567`. Substitua pelo seu número real; não inclua `+`, espaços ou traços.

4. Salve no nano com `Ctrl + O`, confirme com Enter e saia com `Ctrl + X`.

5. Valide a sintaxe e inicie o bot:

```bash
npm run check
npm start
```

Siga as instruções exibidas no terminal para conectar o WhatsApp em **Aparelhos conectados**. Nunca compartilhe seu código de pareamento.

## Atualizar o bot

Dentro da pasta do projeto:

```bash
git pull origin main
npm install
npm run check
npm start
```

Se houver alterações locais que impeçam o `git pull`, faça backup do que deseja preservar antes de descartar ou substituir arquivos.

## Comandos disponíveis

- `!menu`, `!ping`, `!runtime`, `!about`, `!owner`
- `!choose opção A | opção B`, `!8ball pergunta`
- `!groupinfo`, `!tagall` (admin)
- `!kick`, `!promote`, `!demote` (admin)
- `!link`, `!revoke`, `!subject`, `!desc` (admin)
- `!closegroup`, `!opengroup`, `!welcome on/off`, `!antilink on/off` (admin)
- `!warn`, `!note add/get/list/del` (admin)
- `!say`, `!chatid`, `!botname` (dono)

O prefixo padrão é `!`. Para personalizá-lo, altere `BOT_PREFIX` no arquivo `.env`.

## Sessão, dados e segurança

- A sessão do WhatsApp é armazenada localmente em `sessions/`.
- Configurações, avisos e notas ficam em `data/`.
- **Não envie o arquivo `.env`, a pasta `sessions/` ou credenciais para o GitHub.**
- Não compartilhe códigos de pareamento, chaves de API ou arquivos de sessão.
- Se apagar a pasta do projeto, faça uma cópia segura do `.env` e da sessão antes. O GitHub não guarda esses arquivos privados.

## Verificação

Execute `npm run check` para validar a sintaxe JavaScript. O GitHub Actions também executa a checagem em pushes e pull requests. Isso não substitui um teste real de conexão com o WhatsApp.
