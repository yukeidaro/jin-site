const ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSd45IxIFq9nKdkVwbdflQ6MEaZ6MUPEaiKEmG6ulIVXdFXvig/formResponse';

const attempts = [
  {
    label: 'emailAddress + emailReceipt',
    body: {
      'entry.648754583': 'Receipt Test A',
      'entry.440219398': 'yukeiasano@gmail.com',
      'entry.113570650': 'Founder',
      emailAddress: 'yukeiasano@gmail.com',
      emailReceipt: 'true'
    }
  },
  {
    label: 'emailAddress only',
    body: {
      'entry.648754583': 'Receipt Test B',
      'entry.440219398': 'yukeiasano@gmail.com',
      'entry.113570650': 'Founder',
      emailAddress: 'yukeiasano@gmail.com'
    }
  }
];

for (const attempt of attempts) {
  const res = await fetch(ACTION, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(attempt.body).toString()
  });
  console.log(`${attempt.label.padEnd(28)} status=${res.status}`);
}
