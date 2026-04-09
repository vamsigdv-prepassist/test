const { Storage } = require('@google-cloud/storage');
const path = require('path');

async function listBuckets() {
  try {
    const storage = new Storage({
      keyFilename: path.join(__dirname, 'gcp-key.json'),
    });

    console.log('Fetching buckets...');
    const [buckets] = await storage.getBuckets();
    console.log('Buckets:');
    buckets.forEach(bucket => {
      console.log(bucket.name);
    });
  } catch (error) {
    console.error('Failed to list buckets:', error);
  }
}

listBuckets();
