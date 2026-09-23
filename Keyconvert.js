import fs from 'fs';
import path from 'path';

try {
  const rootDir = process.cwd();
  const files = fs.readdirSync(rootDir);

  // Search for firebase key files
  const keyFile = files.find(file => 
    file === 'firebase-admin-service-key.json' || 
    (file.includes('firebase-adminsdk') && file.endsWith('.json'))
  );

  if (keyFile) {
    const fullPath = path.join(rootDir, keyFile);
    console.log(`\n📄 Found Firebase Key File: "${keyFile}"`);

    const keyContent = fs.readFileSync(fullPath, 'utf8');
    const base64 = Buffer.from(keyContent).toString('base64');

    console.log('\n🔑 Firebase Admin Service Account Base64 String:\n');
    console.log(base64);
    console.log('\n✅ Copy the string above and set it as your FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable in Vercel.\n');
  } else {
    console.log('⚠️ No Firebase service account JSON file found in the root directory.');
    console.log('👉 Please place your "firebase-admin-service-key.json" or "*firebase-adminsdk*.json" file in the server directory.\n');
  }
} catch (err) {
  console.error('❌ Error converting key to Base64:', err.message);
}
