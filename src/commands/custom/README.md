# Comandos personalizados da Nyx

Coloque nesta pasta um arquivo `.js` para cada comando personalizado. A Nyx carrega os arquivos automaticamente ao iniciar.

## Modelo

Crie, por exemplo, `meucomando.js`:

```js
export default {
  name: 'meucomando',
  aliases: ['mc'],
  description: 'Meu primeiro comando personalizado',

  async execute({ sock, message, args, reply, senderNumber, isGroup, isOwner }) {
    await reply('Olá! Este é meu comando personalizado.');
  }
};
```

Depois, use `}meucomando` ou `}mc` no WhatsApp. O objeto recebido por `execute()` contém o contexto da mensagem, incluindo `sock`, `message`, `args`, `reply`, `senderNumber`, `isGroup` e as informações de proprietário.

## Regras

- Cada arquivo deve ter um `export default` com um objeto.
- O objeto precisa declarar `name` e uma função `async execute(context)`.
- `aliases` é opcional e deve ser uma lista de nomes alternativos.
- Nomes e aliases aceitam letras, números, hífen e underline.
- Não use um nome ou alias que já pertença a outro comando.
- Somente arquivos `.js` diretamente nesta pasta são carregados; subpastas são ignoradas.
- A Nyx carrega os comandos personalizados ao iniciar. Reinicie o bot depois de adicionar ou editar um arquivo.

**Atenção:** arquivos nesta pasta executam código JavaScript com os mesmos privilégios do processo do bot. Adicione somente códigos que você escreveu ou revisou e em que confia.
