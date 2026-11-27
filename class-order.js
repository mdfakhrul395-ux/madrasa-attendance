// শ্রেণির স্বাভাবিক ক্রম (ছোট থেকে বড়) — app.js-এর getClassList() এটি বদলে দেয়
const CLASS_ORDER = ['প্লে','নার্সারী','কেজি','প্রথম','দ্বিতীয়','তৃতীয়','চতুর্থ','পঞ্চম','ষষ্ঠ','সপ্তম','অষ্টম','নবম','দশম','একাদশ','দ্বাদশ']
  .map(x => x.normalize('NFD'));

function classSortKey(name) {
  const n = String(name || '').trim().replace('নার্সারি', 'নার্সারী').normalize('NFD');
  let idx = CLASS_ORDER.findIndex(c => n.startsWith(c));
  if (idx === -1) idx = 999; // তালিকায় নেই এমন শ্রেণি সবার শেষে
  const gender = n.includes('বালিকা'.normalize('NFD')) ? 2 : (n.includes('বালক'.normalize('NFD')) ? 1 : 0);
  return [idx, gender];
}

function getClassList() {
  const set = new Set(studentsCache.map(s => s.className).filter(Boolean));
  return Array.from(set).sort((a, b) => {
    const ka = classSortKey(a), kb = classSortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return String(a).localeCompare(String(b), 'bn');
  });
}
