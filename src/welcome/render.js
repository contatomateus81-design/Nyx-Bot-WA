import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const template = JSON.parse(readFileSync(new URL('./template.json', import.meta.url), 'utf8'));
const WELCOME_LINES = ['💜 Bem-vindo, novo', 'integrante 💜'];

async function getAvatar(sock, jid) {
  try {
    const url = await sock.profilePictureUrl(jid, 'image');
    if (url) {
      const response = await fetch(url);
      if (response.ok) {
        const data = Buffer.from(await response.arrayBuffer());
        if (data.length > 0 && data.length <= 8 * 1024 * 1024) return await loadImage(data);
      }
    }
  } catch {}
  try {
    return await loadImage(await readFile(new URL('../../mídia/nopic.jpg', import.meta.url)));
  } catch {
    return null;
  }
}

function drawBackground(ctx, width, height) {
  ctx.fillStyle = template.colors.background;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * 0.5, height * 0.38, 10, width * 0.5, height * 0.38, width * 0.75);
  glow.addColorStop(0, '#38205B');
  glow.addColorStop(1, template.colors.background);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.16)';
  ctx.lineWidth = 2;
  for (let x = -height; x < width + height; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - height, height);
    ctx.stroke();
  }
}

export async function renderWelcomeCard(sock, jid) {
  const { width, height, colors } = template;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const bgPath = new URL('../../mídia/welcome-bg.png', import.meta.url);
  let backgroundLoaded = false;
  try {
    if (existsSync(bgPath)) {
      const background = await loadImage(bgPath);
      ctx.drawImage(background, 0, 0, width, height);
      backgroundLoaded = true;
    }
  } catch {}
  if (!backgroundLoaded) drawBackground(ctx, width, height);

  // Decorative frame
  ctx.strokeStyle = colors.purple;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(32, 32, width - 64, height - 64, 36);
  ctx.stroke();

  const avatar = { x: width / 2, y: 390, radius: 178 };
  const picture = await getAvatar(sock, jid);
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatar.x, avatar.y, avatar.radius, 0, Math.PI * 2);
  ctx.clip();
  if (picture) {
    const scale = Math.max((avatar.radius * 2) / picture.width, (avatar.radius * 2) / picture.height);
    const w = picture.width * scale;
    const h = picture.height * scale;
    ctx.drawImage(picture, avatar.x - w / 2, avatar.y - h / 2, w, h);
  } else {
    ctx.fillStyle = colors.panel;
    ctx.fillRect(avatar.x - avatar.radius, avatar.y - avatar.radius, avatar.radius * 2, avatar.radius * 2);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(avatar.x, avatar.y, avatar.radius + 8, 0, Math.PI * 2);
  ctx.strokeStyle = colors.purple;
  ctx.lineWidth = 12;
  ctx.shadowColor = colors.purple;
  ctx.shadowBlur = 26;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colors.lavender;
  // Use broadly supported serif text so the welcome title never disappears
  // when the runtime lacks the Unicode Mathematical Fraktur glyphs.
  ctx.font = 'bold 48px "DejaVu Serif", serif';
  ctx.shadowColor = colors.purple;
  ctx.shadowBlur = 14;
  ctx.fillText(WELCOME_LINES[0], width / 2, 700, width - 100);
  ctx.fillText(WELCOME_LINES[1], width / 2, 762, width - 100);
  ctx.shadowBlur = 0;

  return canvas.toBuffer('image/png');
}
