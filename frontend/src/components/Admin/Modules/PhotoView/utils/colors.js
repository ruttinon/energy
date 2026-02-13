export const safeColor = (c) => {
    if (!c || c === 'transparent') return '#000000';
    if (/^#[0-9A-Fa-f]{6}$/.test(c)) return c;
    return '#000000';
};
