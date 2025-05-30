require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Log the current working directory and environment
console.log('Current working directory:', process.cwd());
console.log('Node environment:', process.env.NODE_ENV);

// Check if environment variables are set
const requiredEnvVars = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID'
];

console.log('\nChecking environment variables:');
requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    console.log(`${varName}: ${value ? '✓ Set' : '✗ Missing'}`);
});

// Create necessary directories
const dirs = ['dist', 'js'];
dirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    console.log(`Creating directory: ${dirPath}`);
    if (!fs.existsSync(dirPath)) {
        try {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`Successfully created directory: ${dirPath}`);
        } catch (error) {
            console.error(`Error creating directory ${dirPath}:`, error);
            process.exit(1);
        }
    } else {
        console.log(`Directory already exists: ${dirPath}`);
    }
});

// Ensure the dist directory exists
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

// Copy static files
const staticFiles = [
    'index.html',
    'quiz-app.html',
    'admin.html',
    'quiz-app.js',
    'admin-dashboard.js',
    'config.js'
];

// Copy each static file to dist directory
staticFiles.forEach(file => {
    try {
        fs.copyFileSync(file, path.join('dist', file));
        console.log(`Copied ${file} to dist/`);
    } catch (err) {
        console.error(`Error copying ${file}:`, err);
    }
});

// Build Tailwind CSS
console.log('\n=== Starting CSS Build Process ===');
console.log('Current directory:', process.cwd());

// Ensure src directory exists
const srcDir = path.join(process.cwd(), 'src');
if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir);
    console.log('Created src directory');
}

// Check if input.css exists
const inputCssPath = path.join(process.cwd(), 'src', 'input.css');
if (!fs.existsSync(inputCssPath)) {
    console.error('Error: input.css not found in src directory');
    process.exit(1);
}
console.log('Found input.css at:', inputCssPath);

// Build CSS
console.log('\nBuilding Tailwind CSS...');
try {
    // Run PostCSS with Tailwind
    console.log('Running PostCSS...');
    execSync('npx tailwindcss -i ./src/input.css -o ./output.css --minify', { stdio: 'inherit' });
    
    // Copy output.css to dist directory
    fs.copyFileSync('output.css', path.join('dist', 'output.css'));
    console.log('Copied output.css to dist/');
    
    // Verify the output file
    const outputStats = fs.statSync('output.css');
    console.log('\nCSS build successful!');
    console.log('Output file:', 'output.css');
    console.log('File size:', outputStats.size, 'bytes');
    
    // Log the first few characters of the generated CSS
    const cssContent = fs.readFileSync('output.css', 'utf8');
    console.log('\nFirst 200 characters of generated CSS:');
    console.log(cssContent.substring(0, 200));
} catch (error) {
    console.error('Error building CSS:', error);
    process.exit(1);
}

// Handle config.js for Vercel deployment
if (process.env.VERCEL) {
    console.log('Vercel environment detected, creating config.js from environment variables...');
    const configContent = `export const firebaseConfig = {
        apiKey: "${process.env.FIREBASE_API_KEY}",
        authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
        projectId: "${process.env.FIREBASE_PROJECT_ID}",
        storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET}",
        messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
        appId: "${process.env.FIREBASE_APP_ID}"
    };`;
    
    fs.writeFileSync(path.join('dist', 'config.js'), configContent);
    console.log('Created config.js from environment variables');
}

// List all files in the root directory
console.log('\nFiles in root directory:');
fs.readdirSync(process.cwd()).forEach(file => {
    const stats = fs.statSync(path.join(process.cwd(), file));
    console.log(`${file} (${stats.size} bytes)`);
});

// List all files in dist directory
console.log('\nFiles in dist directory:');
fs.readdirSync(path.join(process.cwd(), 'dist')).forEach(file => {
    const stats = fs.statSync(path.join(process.cwd(), 'dist', file));
    console.log(`${file} (${stats.size} bytes)`);
});

console.log('Build completed successfully!'); 