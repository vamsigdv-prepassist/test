const { Storage } = require('@google-cloud/storage');
const path = require('path');

async function setCors() {
  try {
    const storage = new Storage({
      keyFilename: path.join(__dirname, 'gcp-key.json'),
    });

    const bucketName = 'prepassist-v2';

    const corsConfiguration = [
      {
        origin: ['*'],
        method: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
        maxAgeSeconds: 3600,
        responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
      },
    ];

    console.log(`Setting CORS on bucket: ${bucketName}...`);
    await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);
    console.log(`Successfully updated CORS for ${bucketName}`);
  } catch (error) {
    console.error('Failed to set CORS:', error.message);
  }
}

setCors();
