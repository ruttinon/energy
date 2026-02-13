export const getRegistersFromTemplate = ({ manufacturer, model, templateRef }) => {
  try {
    const mods = import.meta.glob('/services/backend/device_templates/**/*.json', { eager: true });
    const norm = (s) => String(s || '').trim().toLowerCase();
    const targetRef = norm(templateRef || '');
    const targetManu = norm(manufacturer || '');
    const targetModel = norm(model || '');
    for (const [path, json] of Object.entries(mods)) {
      const p = path.replace(/\\/g, '/').toLowerCase();
      const okByRef = targetRef && p.endsWith(targetRef);
      const okByMM = p.includes(`/services/backend/device_templates/${targetManu}/`) && p.endsWith(`${targetModel}.json`);
      if (okByRef || okByMM) {
        const regs = (json?.registers || []).map(r => r.key).filter(Boolean);
        return regs;
      }
    }
  } catch {}
  return [];
};
