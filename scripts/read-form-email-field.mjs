const FORM_ID = '1FAIpQLSd45IxIFq9nKdkVwbdflQ6MEaZ6MUPEaiKEmG6ulIVXdFXvig';
const url = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`;

const html = await (await fetch(url)).text();

// The dedicated responder-email field is a plain input, not an entry.* question.
const emailInputs = [...html.matchAll(/<input[^>]*type="email"[^>]*>/g)].map((m) => m[0]);
console.log('email inputs in markup:');
emailInputs.forEach((i) => console.log('  ', i.slice(0, 200)));

const names = [...new Set([...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1]))];
console.log('\nall field names:', JSON.stringify(names.slice(0, 20)));

const emailCollection = html.match(/emailCollectionType["\s:]+(\d)/);
console.log('\nemailCollectionType:', emailCollection ? emailCollection[1] : 'not found');
