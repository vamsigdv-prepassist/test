import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import path from 'path';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const filename = body.filename || 'newspaper.pdf';

    let storage: Storage;

    // Securely Instantiate Cloud Storage locally or via Vercel injects
    if (process.env.GCP_PRIVATE_KEY && process.env.GCP_CLIENT_EMAIL) {
       storage = new Storage({
          credentials: {
             client_email: process.env.GCP_CLIENT_EMAIL,
             private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
          },
          projectId: process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'prepassist-v2',
       });
    } else {
       storage = new Storage({
          keyFilename: path.join(process.cwd(), 'gcp-key.json')
       });
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'prepassist-v2';
    const destination = `admin-temp/newspapers/${Date.now()}_${filename}`;
    
    const options = {
      version: 'v4' as const,
      action: 'write' as const,
      expires: Date.now() + 60 * 60 * 1000, // 1 hour token
      contentType: 'application/pdf',
    };

    // Generate V4 Crypto Signed URL strictly locked to PUT operations natively for Client
    const [uploadUrl] = await storage.bucket(bucketName).file(destination).getSignedUrl(options);

    // Generate V4 Crypto Signed URL explicitly for the Backend Server to securely read and parse the PDF without ACL issues
    const [downloadUrl] = await storage.bucket(bucketName).file(destination).getSignedUrl({
       version: 'v4',
       action: 'read',
       expires: Date.now() + 60 * 60 * 1000 * 24 // 24 hours
    });

    return NextResponse.json({ signedUrl: uploadUrl, fileUrl: downloadUrl });
  } catch (error: any) {
    console.error("GCS Signed URL Generation Error:", error);
    return NextResponse.json({ error: "Server Signed URL Crash: " + error.message }, { status: 500 });
  }
}
