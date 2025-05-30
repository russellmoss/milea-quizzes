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
const filesToCopy = [
    'index.html',
    'quiz-app.html',
    'admin.html',
    'quiz-app.js',
    'admin-dashboard.js',
    'config.js'
];

filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join('dist', file));
        console.log(`Copied ${file} to dist/`);
    }
});

// Build Tailwind CSS
try {
    console.log('\n=== Starting CSS Build Process ===');
    console.log('Current directory:', process.cwd());
    
    // First ensure src directory exists
    if (!fs.existsSync('src')) {
        console.log('Creating src directory...');
        fs.mkdirSync('src', { recursive: true });
    }
    
    // Check if input.css exists
    const inputCssPath = './src/input.css';
    if (!fs.existsSync(inputCssPath)) {
        console.error('Error: input.css not found at', inputCssPath);
        process.exit(1);
    }
    console.log('Found input.css at:', inputCssPath);
    
    // Build Tailwind CSS with PostCSS
    console.log('\nBuilding Tailwind CSS...');
    const outputCssPath = './dist/output.css';
    
    // First run PostCSS
    execSync('npx postcss ./src/input.css -o ./dist/output.css --minify', { stdio: 'inherit' });
    
    // Then run Tailwind
    execSync(`npx tailwindcss -i ${inputCssPath} -o ${outputCssPath} --minify`, { stdio: 'inherit' });
    
    // Verify the output file exists and has content
    if (fs.existsSync(outputCssPath)) {
        const stats = fs.statSync(outputCssPath);
        console.log(`\nCSS build successful!`);
        console.log(`Output file: ${outputCssPath}`);
        console.log(`File size: ${stats.size} bytes`);
        
        // Copy to root directory
        fs.copyFileSync(outputCssPath, './output.css');
        console.log('Copied output.css to root directory');
        
        // Log the first few lines of the CSS file
        const cssContent = fs.readFileSync(outputCssPath, 'utf8');
        console.log('\nFirst 200 characters of generated CSS:');
        console.log(cssContent.substring(0, 200));
        
        // Verify CSS content
        if (cssContent.includes('@tailwind')) {
            console.error('Error: Raw Tailwind directives found in output CSS');
            process.exit(1);
        }
    } else {
        console.error('Error: output.css was not created');
        process.exit(1);
    }
} catch (error) {
    console.error('\nError building Tailwind CSS:', error);
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