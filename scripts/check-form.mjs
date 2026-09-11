const FORM_ID = process.argv[2] || '1FAIpQLScB3SoTxA2gaUlOakUKqbZH2PtlDaQLkfh7XGkt-OsejLGTTA';
const url = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`;

const html = await (await fetch(url)).text();
const match = html.match(/FB_PUBLIC_LOAD_DATA_ = (\[[\s\S]*?\]);<\/script>/);
if (!match) throw new Error('Could not read the form definition.');

const data = JSON.parse(match[1]);
const fields = data[1][1].map((q) => ({
  title: q[1],
  type: q[3],
  entry: q[4] && q[4][0] ? `entry.${q[4][0][0]}` : null
}));

const action = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;
console.log(JSON.stringify({ action, fields, emailSetting: data[1].slice(9, 12) }, null, 2));

// Prove a plain POST still works, which is what the site needs.
const body = new URLSearchParams();
fields.forEach((f, i) => { if (f.entry) body.set(f.entry, ['Probe', 'probe@example.com', 'Founder'][i] || 'Probe'); });
const res = await fetch(action, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: body.toString()
});
console.log('\nplain POST status:', res.status, res.status === 200 ? '(accepted)' : '(rejected)');
