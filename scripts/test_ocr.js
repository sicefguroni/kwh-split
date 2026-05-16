
const fs = require('fs');
const fetch = require('node-fetch');

async function testOCR() {
  const apiKey = 'rSx6V1Up2bNkqYk2xvOjx4ZLtqE7dhTB6aX4V39d28OZaD2mleRl5SHOAPffEGW2';
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Please provide a file path');
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(filePath);
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  formData.append('file', blob, 'receipt.jpg');
  formData.append('documentType', 'receipt');

  console.log('Submitting image to TabScanner...');
  const response = await fetch('https://api.tabscanner.com/api/2/process', {
    method: 'POST',
    headers: { apikey: apiKey },
    body: formData,
  });

  const data = await response.json();
  console.log('Response:', data);
}

testOCR().catch(console.error);
