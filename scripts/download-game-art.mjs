import { mkdir, writeFile } from 'node:fs/promises';

const folder = new URL('../public/images/games/', import.meta.url);
await mkdir(folder, { recursive: true });
const games = {
  'kof-95': 'kof95', 'kof-97': 'kof97', 'kof-98-um': 222420,
  'kof-99': 'kof99', 'kof-2000': 'kof2000', 'kof-2002': 'kof2002',
  'kof-xiii': 222940, 'kof-xiv': 571260, 'kof-xv': 1498570,
  'street-fighter-iv': 21660, 'street-fighter-v': 310950,
  'street-fighter-6': 1364780, 'fatal-fury-cotw': 2492040,
};
const sources = [];
for (const [slug, id] of Object.entries(games)) {
  const page = typeof id === 'number' ? `https://store.steampowered.com/app/${id}/` : `https://www.snk-corp.co.jp/official/akeaka/titles/${id}/`;
  let source;
  if (typeof id === 'number') {
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${id}`);
    const data = (await response.json())[id]?.data;
    if (!data) throw new Error(`No store data for ${slug}`);
    source = data.header_image;
    if (['street-fighter-6', 'kof-xv', 'fatal-fury-cotw'].includes(slug)) {
      const hero = data.screenshots?.[0]?.path_full;
      if (hero) await download(`${slug}-hero`, hero);
      sources.push({ file: `${slug}-hero.jpg`, source: hero, page });
    }
  } else {
    const html = await fetch(page).then(r => r.text());
    const match = html.match(new RegExp(`src="([^"]+/${id}_top\\.jpg)"`));
    if (!match) throw new Error(`No official artwork for ${slug}`);
    source = new URL(match[1], page).href;
  }
  await download(slug, source);
  sources.push({ file: `${slug}.jpg`, source, page });
}
await writeFile(new URL('sources.json', folder), JSON.stringify(sources, null, 2) + '\n');
async function download(name, url) {
  const response = await fetch(url);
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Invalid artwork: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(`${name}.jpg`, folder), bytes);
  console.log(`${name}: ${bytes.length} bytes`);
}
