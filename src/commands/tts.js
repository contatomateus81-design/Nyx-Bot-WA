import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { registerCommand } from '../handler.js';
import { config } from '../config.js';

const MAX_TEXT_LENGTH = 600;
const PROCESS_TIMEOUT_MS = 45_000;

function runProcess(binary, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('A síntese demorou demais e foi interrompida.'));
    }, PROCESS_TIMEOUT_MS);
    child.stderr.on('data', chunk => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    child.once('error', error => {
      clearTimeout(timer);
      reject(new Error(`Não consegui executar "${binary}". Verifique se está instalado e configurado.`));
    });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `O processo terminou com código ${code}.`));
    });
    child.stdin.end(input);
  });
}

registerCommand({
  name: 'tts',
  aliases: ['falar'],
  role: 'membro',
  async execute({ args, sock, chatJid, message, reply }) {
    const text = args.join(' ').trim();
    if (!text) {
      return reply('🗣️ Use: !tts texto que a Nyx deve falar\nO prefixo real é o configurado no bot.');
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return reply(`✂️ O texto pode ter no máximo ${MAX_TEXT_LENGTH} caracteres por áudio.`);
    }

    const model = process.env.PIPER_MODEL;
    const piperBin = process.env.PIPER_BIN || 'piper';
    const ffmpegBin = process.env.FFMPEG_BIN || 'ffmpeg';
    if (!model) {
      return reply('⚙️ O TTS neural ainda não está configurado. Defina PIPER_MODEL no .env com o caminho completo do modelo Piper .onnx.');
    }

    const workDir = join(tmpdir(), `nyx-tts-${randomUUID()}`);
    const wavPath = join(workDir, 'speech.wav');
    const oggPath = join(workDir, 'speech.ogg');
    try {
      await mkdir(workDir, { recursive: true });
      await runProcess(piperBin, ['--model', model, '--output_file', wavPath], text);
      await runProcess(ffmpegBin, [
        '-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath,
        '-vn', '-ac', '1', '-c:a', 'libopus', '-b:a', '32k',
        '-vbr', 'on', '-application', 'voip', '-f', 'ogg', oggPath,
      ], '');
      await sock.sendMessage(
        chatJid,
        { audio: { url: oggPath }, mimetype: 'audio/ogg; codecs=opus', ptt: true },
        { quoted: message },
      );
    } catch (error) {
      console.error('[command:tts]', error?.message ?? error);
      await reply('⚠️ Não consegui gerar o áudio. Confira se o Piper, o modelo de voz e o FFmpeg estão instalados/configurados no Termux.');
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  },
});
