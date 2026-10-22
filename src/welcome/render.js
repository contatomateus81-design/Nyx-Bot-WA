import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const template = JSON.parse(readFileSync(new URL('./template.json', import.meta.url), 'utf8'));

const clampText = (value, max = 48) => {
  const text = String(value ?? '').replace(/[\\r\\n]+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
};

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

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawFallbackBackground(ctx, width, height) {
  ctx.fillStyle = template.colors.background;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * 0.5, height * 0.32, 10, width * 0.5, height * 0.32, width * 0.75);
  glow.addColorStop(0, '#38205B');
  glow.addColorStop(1, template.colors.background);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
  ctx.lineWidth = 2;
  for (let x = -height; x < width + height; x += 72) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - height, height); ctx.stroke();
  }
}

export async function renderWelcomeCard(sock, jid, details = {}) {
  const { width, height, colors, avatar, text, fonts } = template;
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
  if (!backgroundLoaded) drawFallbackBackground(ctx, width, height);

  // A subtle frame keeps the composition readable even on a custom Canva background.
  ctx.strokeStyle = colors.purple;
  ctx.lineWidth = 3;
  roundedRect(ctx, 32, 32, width - 64, height - 64, 36);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colors.lavender;
  ctx.font = fonts.title;
  ctx.shadowColor = colors.purple;
  ctx.shadowBlur = 18;
  ctx.fillText('SEJA BEM-VINDO(A)', width / 2, text.titleY, width - 100);
  ctx.shadowBlur = 0;

  const picture = await getAvatar(sock, jid);
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatar.x, avatar.y, avatar.radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (picture) {
    const scale = Math.max((avatar.radius * 2) / picture.width, (avatar.radius * 2) / picture.height);
    const w = picture.width * scale;
    const h = picture.height * scale;
    ctx.drawImage(picture, avatar.x - w / 2, avatar.y - h / 2, w, h);
  } else {
    ctx.fillStyle = colors.panel;
    ctx.fillRect(avatar.x - avatar.radius, avatar.y - avatar.radius, avatar.radius * 2, avatar.radius * 2);
    ctx.fillStyle = colors.lavender;
    ctx.font = '700 100px sans-serif';
    ctx.fillText('?', avatar.x, avatar.y);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(avatar.x, avatar.y, avatar.radius + 7, 0, Math.PI * 2);
  ctx.strokeStyle = colors.purple;
  ctx.lineWidth = 10;
  ctx.shadowColor = colors.purple;
  ctx.shadowBlur = 22;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const lines = [
    { value: clampText(details.name || 'Novo membro', 32), y: text.nameY, font: fonts.name, color: colors.white },
    { value: '📱 ' + clampText(details.phone || 'Número indisponível', 36), y: text.phoneY, font: fonts.detail, color: colors.muted },
    { value: 'MENÇÃO  ' + clampText(details.mention || '@membro', 36), y: text.mentionY, font: fonts.detail, color: colors.lavender },
    { value: 'ID  ' + clampText(details.id || 'Indisponível', 46), y: text.idY, font: '400 24px sans-serif', color: colors.muted },
  ];
  for (const line of lines) {
    ctx.font = line.font;
    ctx.fillStyle = line.color;
    ctx.fillText(line.value, width / 2, line.y, width - 110);
  }

  ctx.fillStyle = colors.lavender;
  ctx.font = fonts.footer;
  ctx.fillText('NYX BOT  •  WELCOME SYSTEM', width / 2, text.footerY, width - 100);

  return canvas.toBuffer('image/png');
}
