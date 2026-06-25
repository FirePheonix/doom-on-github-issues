import { PNG } from "pngjs";

const WIDTH = 320;
const HEIGHT = 200;
const FOV = Math.PI / 3;
const MAX_DIST = 20;

function setPixel(png, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = 255;
}

function drawRect(png, x0, y0, x1, y1, r, g, b) {
  const sx = Math.max(0, Math.floor(x0));
  const sy = Math.max(0, Math.floor(y0));
  const ex = Math.min(png.width, Math.ceil(x1));
  const ey = Math.min(png.height, Math.ceil(y1));

  for (let y = sy; y < ey; y += 1) {
    for (let x = sx; x < ex; x += 1) {
      setPixel(png, x, y, r, g, b);
    }
  }
}

function castRay(state, angle) {
  const map = state.map;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let distance = 0;

  while (distance < MAX_DIST) {
    distance += 0.02;
    const x = state.player.x + cos * distance;
    const y = state.player.y + sin * distance;
    const xi = Math.floor(x);
    const yi = Math.floor(y);

    if (yi < 0 || yi >= map.length || xi < 0 || xi >= map[0].length) {
      return { distance: MAX_DIST, hit: false };
    }

    if (map[yi][xi] === 1) {
      const fracX = x - Math.floor(x);
      const fracY = y - Math.floor(y);
      const edge = Math.min(fracX, 1 - fracX, fracY, 1 - fracY);
      return { distance, hit: true, edge };
    }
  }

  return { distance: MAX_DIST, hit: false };
}

function drawBackground(png) {
  for (let y = 0; y < png.height; y += 1) {
    const t = y / png.height;
    const isSky = y < png.height / 2;
    const r = isSky ? 18 + Math.floor(18 * (1 - t * 2)) : 40 + Math.floor(20 * (t - 0.5) * 2);
    const g = isSky ? 26 + Math.floor(26 * (1 - t * 2)) : 24 + Math.floor(20 * (t - 0.5) * 2);
    const b = isSky ? 44 + Math.floor(48 * (1 - t * 2)) : 16 + Math.floor(12 * (t - 0.5) * 2);

    for (let x = 0; x < png.width; x += 1) {
      setPixel(png, x, y, r, g, b);
    }
  }
}

function drawWalls(state, png, depthBuffer) {
  for (let x = 0; x < png.width; x += 1) {
    const camera = (x / png.width) - 0.5;
    const angle = state.player.angle + camera * FOV;
    const ray = castRay(state, angle);

    let dist = ray.distance;
    const corrected = dist * Math.cos(camera * FOV);
    dist = Math.max(0.1, corrected);
    depthBuffer[x] = dist;

    const wallHeight = Math.min(png.height, Math.floor((png.height * 0.9) / dist));
    const y0 = Math.floor((png.height - wallHeight) / 2);
    const y1 = y0 + wallHeight;

    const shade = Math.max(0.2, 1 - dist / 15);
    const edgeBoost = ray.hit ? Math.max(0, 0.12 - ray.edge) * 2.8 : 0;
    const brightness = Math.min(1, shade + edgeBoost);

    const r = Math.floor(140 * brightness);
    const g = Math.floor(72 * brightness);
    const b = Math.floor(58 * brightness);

    for (let y = y0; y < y1; y += 1) {
      setPixel(png, x, y, r, g, b);
    }
  }
}

function drawDemons(state, png, depthBuffer) {
  const sprites = [];
  for (const demon of state.demons) {
    const dx = demon.x - state.player.x;
    const dy = demon.y - state.player.y;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);

    let rel = ang - state.player.angle;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;

    if (Math.abs(rel) > FOV * 0.7) continue;
    sprites.push({ rel, dist });
  }

  sprites.sort((a, b) => b.dist - a.dist);

  for (const sprite of sprites) {
    const size = Math.max(8, Math.floor((HEIGHT * 0.65) / Math.max(0.1, sprite.dist)));
    const screenX = Math.floor((0.5 + sprite.rel / FOV) * WIDTH);
    const x0 = screenX - Math.floor(size / 2);
    const y0 = Math.floor(HEIGHT / 2 - size / 2);

    for (let x = 0; x < size; x += 1) {
      const sx = x0 + x;
      if (sx < 0 || sx >= WIDTH) continue;
      if (sprite.dist > depthBuffer[sx]) continue;

      for (let y = 0; y < size; y += 1) {
        const sy = y0 + y;
        if (sy < 0 || sy >= HEIGHT) continue;

        const nx = (x / size) * 2 - 1;
        const ny = (y / size) * 2 - 1;
        if (nx * nx + ny * ny > 1) continue;

        const shade = Math.max(0.2, 1 - sprite.dist / 14);
        const r = Math.floor(190 * shade);
        const g = Math.floor(28 * shade);
        const b = Math.floor(20 * shade);
        setPixel(png, sx, sy, r, g, b);
      }
    }
  }
}

function drawWeapon(png) {
  drawRect(png, WIDTH * 0.42, HEIGHT * 0.73, WIDTH * 0.58, HEIGHT * 0.98, 80, 80, 86);
  drawRect(png, WIDTH * 0.47, HEIGHT * 0.7, WIDTH * 0.53, HEIGHT * 0.9, 120, 120, 130);
}

function drawDamageTint(state, png) {
  const damage = Math.max(0, 1 - (state.player.hp / 6));
  if (damage <= 0) return;

  const strength = Math.floor(55 * damage);
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const idx = (png.width * y + x) << 2;
      png.data[idx] = Math.min(255, png.data[idx] + strength);
    }
  }
}

export function renderPngFrame(state) {
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  const depth = new Float32Array(WIDTH);

  drawBackground(png);
  drawWalls(state, png, depth);
  drawDemons(state, png, depth);
  drawWeapon(png);
  drawDamageTint(state, png);

  return PNG.sync.write(png);
}
