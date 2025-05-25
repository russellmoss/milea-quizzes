const fs = require('fs');
const path = require('path');

// Create js directory if it doesn't exist
const jsDir = path.join(__dirname, 'js');
if (!fs.existsSync(jsDir)) {
    fs.mkdirSync(jsDir);
}

// Generate config.js from environment variables
const configContent = `// config.js
export const firebaseConfig = {
  apiKey: "${process.env.FIREBASE_API_KEY}",
  authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
  projectId: "${process.env.FIREBASE_PROJECT_ID}",
  storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
  appId: "${process.env.FIREBASE_APP_ID}"
};`;

fs.writeFileSync(path.join(jsDir, 'config.js'), configContent);
console.log('Generated config.js from environment variables'); 