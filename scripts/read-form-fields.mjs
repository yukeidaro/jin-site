const FORM_ID = '1FAIpQLSd45IxIFq9nKdkVwbdflQ6MEaZ6MUPEaiKEmG6ulIVXdFXvig';
const url = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`;

const html = await (await fetch(url)).text();
const match = html.match(/FB_PUBLIC_LOAD_DATA_ = (\[[\s\S]*?\]);<\/script>/);
if (!match) throw new Error('Could not find the form load data.');

const data = JSON.parse(match[1]);
const questions = data[1][1];

const fields = questions.map((q) => ({
  title: q[1],
  type: q[3],
  entry: q[4] && q[4][0] ? `entry.${q[4][0][0]}` : null,
  required: Boolean(q[4] && q[4][0] && q[4][0][2])
}));

console.log(JSON.stringify({ formId: FORM_ID, action: `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`, fields }, null, 2));
