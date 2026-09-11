const FORM_ID = '1FAIpQLSd45IxIFq9nKdkVwbdflQ6MEaZ6MUPEaiKEmG6ulIVXdFXvig';
const html = await (await fetch(`https://docs.google.com/forms/d/e/${FORM_ID}/viewform`)).text();

const match = html.match(/FB_PUBLIC_LOAD_DATA_ = (\[[\s\S]*?\]);<\/script>/);
const data = JSON.parse(match[1]);

// data[1][10] tends to hold the email-collection mode.
console.log('form settings slice:', JSON.stringify(data[1].slice(9, 12)));

const questions = data[1][1];
console.log('\nquestions:');
for (const q of questions) {
  console.log(`  "${q[1]}" type=${q[3]} entry=${q[4] && q[4][0] ? q[4][0][0] : 'none'}`);
}

// Look for the hidden email element Forms injects when collecting responder input.
const hidden = [...html.matchAll(/name="(emailAddress|emailReceipt|[^"]*email[^"]*)"/gi)].map((m) => m[1]);
console.log('\nemail-ish names in markup:', JSON.stringify([...new Set(hidden)]));

const jsname = [...html.matchAll(/jsname="YPqjbf"[^>]*name="([^"]+)"/g)].map((m) => m[1]);
console.log('YPqjbf named:', JSON.stringify(jsname));
