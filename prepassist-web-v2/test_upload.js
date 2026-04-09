require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes } = require('firebase/storage');
const fs = require('fs');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log('Using config:', JSON.stringify(firebaseConfig, null, 2));

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

async function testUpload() {
  console.log('Attempting upload using Web SDK...');
  try {
    const dummyData = new Uint8Array([1, 2, 3]);
    const storageRef = ref(storage, `admin-temp/newspapers/test-${Date.now()}.txt`);
    
    const snapshot = await uploadBytes(storageRef, dummyData);
    console.log('UPLOAD SUCCESSFUL!', snapshot.metadata.fullPath);
  } catch (error) {
    console.error('UPLOAD FAILED', error);
  }
}

testUpload();
