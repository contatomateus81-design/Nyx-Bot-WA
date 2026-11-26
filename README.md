# Nyx-Bot-WA 💜

Bot de WhatsApp em Node.js com Baileys, pareamento por código, comandos modulares, moderação de grupos e configurações persistentes.

## Instalação no Termux

Atualize os pacotes e instale Node.js e Git:

```bash
pkg update && pkg upgrade
pkg install nodejs git
```

Depois, execute esta sequência para baixar o projeto, instalar as dependências, criar e editar o arquivo `.env`, verificar o código e iniciar o bot:

```bash
cd ~
git clone https://github.com/contatomateus81-design/Nyx-Bot-WA.git
cd Nyx-Bot-WA
npm install
cp .env.example .env
nano .env
npm run check
npm start
```

Na primeira execução, preencha e salve o arquivo `.env` antes de continuar. Se `npm run check` apontar erros, corrija-os antes de iniciar o bot.

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
| `GROQ_API_KEY` | Chave da API Groq. **Recomendado para usar a IA automática da Nyx.** |
| `GROQ_MODEL` | Modelo usado pela IA da Groq. Recomendado: `qwen/qwen3.8-27b`. |

### API recomendada: Groq

A opção recomendada é utilizar a API da **Groq**. Você pode criar sua chave gratuitamente ou consultar as opções disponíveis diretamente no painel oficial:

**[https://console.groq.com/keys](https://console.groq.com/keys)**

Depois de criar a chave, coloque-a em `GROQ_API_KEY` no seu arquivo `.env`. Não compartilhe essa chave e não a publique no GitHub.

Para o modelo, recomendamos:

```env
GROQ_MODEL=qwen/qwen3.8-27b
```

Esse é o modelo utilizado pelo próprio dono e criador do Nyx-Bot-WA, Yato, e foi testado com sucesso na configuração dele. Por isso, é a recomendação principal do projeto. Você também pode trocar o modelo por outro compatível com a API da Groq.

Exemplo de configuração:

```env
GROQ_API_KEY=sua_chave_da_groq
GROQ_MODEL=qwen/qwen3.8-27b
```

4. Exemplo de número fictício: `5554991234567`. Substitua pelo seu número real; não inclua `+`, espaços ou traços.

5. Salve no nano com `Ctrl + O`, confirme com Enter e saia com `Ctrl + X`.

6. Valide a sintaxe e inicie o bot:

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

## Download de áudio com yt-dlp

O comando `play` utiliza o **yt-dlp** para pesquisar e baixar o áudio solicitado. O **FFmpeg** é necessário para extrair e converter o áudio para MP3.

No Termux, instale as dependências no mesmo ambiente em que a Nyx Bot será executada:

```bash
pkg update && pkg upgrade
pkg install python-yt-dlp ffmpeg
```

Confira se as ferramentas foram instaladas:

```bash
yt-dlp --version
ffmpeg -version
```

Depois, reinicie a Nyx Bot. O comando usa o prefixo definido em `BOT_PREFIX` no arquivo `.env` (por padrão, `!play`; se seu prefixo for `}`, use `}play`).

**Importante:** yt-dlp e FFmpeg são programas externos ao Node.js; `npm install` não os instala. Se a Nyx Bot estiver rodando em outro servidor ou dispositivo, instale essas ferramentas nesse ambiente também. Baixe apenas conteúdos que você tenha autorização para obter.

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
- Caso enfrente problemas com a reativação do bot, é recomendado que desvincule o bot do whatsapp, abra a pasta do projeto, e remova a pasta `sessions` utilizando `rm -rf sessions`. Feito isso, basta iniciar o bot novamente `npm start`. Obs: remover a pasta `sessions` irá apagar a sessão vinculada ao WhatsApp, então ao reiniciar você precisará espelhar novamente.

## Verificação

Execute `npm run check` para validar a sintaxe JavaScript. O GitHub Actions também executa a checagem em pushes e pull requests. Isso não substitui um teste real de conexão com o WhatsApp.
