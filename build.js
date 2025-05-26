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

// Build Tailwind CSS
console.log('\nBuilding Tailwind CSS...');
try {
    const cssOutputPath = path.join(process.cwd(), 'dist', 'output.css');
    console.log(`CSS output path: ${cssOutputPath}`);
    
    execSync('npx tailwindcss -i ./src/input.css -o ./dist/output.css', { 
        stdio: 'inherit',
        cwd: process.cwd()
    });
    
    // Verify CSS file was created
    if (fs.existsSync(cssOutputPath)) {
        console.log('CSS build completed successfully');
        console.log(`CSS file size: ${fs.statSync(cssOutputPath).size} bytes`);
    } else {
        throw new Error('CSS file was not created');
    }
} catch (error) {
    console.error('Error building CSS:', error);
    process.exit(1);
}

// Generate config.js
console.log('\nGenerating config.js...');
try {
    // Check if all required environment variables are set
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    const configContent = `// config.js - Generated for production
export const firebaseConfig = {
    apiKey: "${process.env.FIREBASE_API_KEY}",
    authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
    projectId: "${process.env.FIREBASE_PROJECT_ID}",
    storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET}",
    messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
    appId: "${process.env.FIREBASE_APP_ID}"
};`;

    // Write config.js to root directory
    const configPath = path.join(process.cwd(), 'config.js');
    console.log(`Writing config.js to: ${configPath}`);
    fs.writeFileSync(configPath, configContent);
    
    // Also write to dist directory for backup
    const distConfigPath = path.join(process.cwd(), 'dist', 'config.js');
    console.log(`Writing config.js to dist directory: ${distConfigPath}`);
    fs.writeFileSync(distConfigPath, configContent);
    
    // Verify config files were created
    if (fs.existsSync(configPath) && fs.existsSync(distConfigPath)) {
        console.log('Generated config.js successfully in both locations');
        console.log(`Root config file size: ${fs.statSync(configPath).size} bytes`);
        console.log(`Dist config file size: ${fs.statSync(distConfigPath).size} bytes`);
    } else {
        throw new Error('Config files were not created');
    }
} catch (error) {
    console.error('Error generating config.js:', error);
    process.exit(1);
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