import { getApiBase } from '../../../../../../../services/api';

export const listStatusImages = async () => {
  const API = getApiBase();
  let result = { on: [], off: [], src: [] };
  try {
    const r = await fetch(`${API}/photoview/status_assets/list`);
    if (r.ok) {
      const j = await r.json();
      const make = (names, cat) => (names || []).map(name => ({ name, url: `${API}/photoview/status_assets/${cat}/${encodeURIComponent(name)}` }));
      result = {
        on: make(j.on, 'on'),
        off: make(j.off, 'off'),
        src: make(j.src, 'src'),
      };
    }
  } catch {}
  if ((!result.on || result.on.length === 0) && (!result.off || result.off.length === 0)) {
    try {
      const onMods = {
        ...import.meta.glob('/src/components/Admin/Modules/PhotoView/pic/STATUS/on/*.{png,jpg,jpeg,svg}', { eager: true, query: '?url', import: 'default' }),
        ...import.meta.glob('/src/components/admin/modules/photoview/pic/STATUS/on/*.{png,jpg,jpeg,svg}', { eager: true, query: '?url', import: 'default' })
      };
      const offMods = {
        ...import.meta.glob('/src/components/Admin/Modules/PhotoView/pic/STATUS/off/*.{png,jpg,jpeg,svg}', { eager: true, query: '?url', import: 'default' }),
        ...import.meta.glob('/src/components/admin/modules/photoview/pic/STATUS/off/*.{png,jpg,jpeg,svg}', { eager: true, query: '?url', import: 'default' })
      };
      const srcMods = {
        ...import.meta.glob('/src/components/Admin/Modules/PhotoView/pic/STATUS/src/*.{png,jpg,jpeg,svg}', { eager: true, query: '?url', import: 'default' }),
        ...import.meta.glob('/src/components/admin/modules/photoview/pic/STATUS/src/*.{png,jpg,jpeg,svg}', { eager: true, query: '?url', import: 'default' })
      };
      const toItems = (mods) => Object.entries(mods).map(([p, url]) => ({ name: p.split('/').pop(), url }));
      result = { on: toItems(onMods), off: toItems(offMods), src: toItems(srcMods) };
    } catch {}
  }
  return result;
};

export const uploadStatusImage = async (file, category = 'src') => {
  const API = getApiBase();
  const fd = new FormData();
  fd.append('file', file);
  fd.append('category', category);
  const r = await fetch(`${API}/photoview/status_assets/upload`, { method: 'POST', body: fd });
  return await r.json();
};
