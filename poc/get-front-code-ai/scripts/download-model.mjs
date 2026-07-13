import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const url = 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf';
const dir = path.join(process.cwd(), 'models');
const dest = path.join(dir, 'qwen2.5-coder.gguf');

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

// Check size if it exists
if (fs.existsSync(dest)) {
    const stats = fs.statSync(dest);
    // The exact size of the model is around 1117366912 bytes
    if (stats.size > 1100000000) {
        console.log('Model already fully downloaded. Skipping download.');
        process.exit(0);
    } else {
        console.log(`Model is partially downloaded (${(stats.size/1024/1024).toFixed(2)} MB). Resuming download...`);
    }
} else {
    console.log('Downloading Qwen2.5-Coder 1.5B GGUF model...');
}

console.log('This might take a while depending on your internet connection (approx 1.1GB).');

// Use built-in curl on Windows to handle resumes and robust downloading
const curlArgs = [
    '-L',      // Follow redirects
    '-C', '-', // Resume broken download
    '-k',      // Insecure (bypass SSL issues)
    '-o', dest,
    url
];

console.log(`Running: curl ${curlArgs.join(' ')}`);

const result = spawnSync('curl.exe', curlArgs, {
    stdio: 'inherit'
});

if (result.error) {
    console.error('Failed to start curl. Please download the file manually.');
    console.error(result.error);
    process.exit(1);
}

if (result.status !== 0) {
    console.error(`curl exited with code ${result.status}. Please check your connection.`);
    process.exit(result.status);
}

console.log('\nDownload complete! You can now start the server.');
