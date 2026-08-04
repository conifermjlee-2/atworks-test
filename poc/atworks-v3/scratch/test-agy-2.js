const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const tempDir = path.join(os.tmpdir(), `agy-test-2`);
fs.mkdirSync(tempDir, { recursive: true });

const promptFile = path.join(tempDir, 'prompt.txt');
const resultFile = path.join(tempDir, 'result.json');
const scriptFile = path.join(tempDir, 'run.ps1');

fs.writeFileSync(promptFile, 'Return a JSON with a single scenario. Output ONLY JSON.', 'utf8');

const psScript = `
$ErrorActionPreference = 'Stop'
[console]::InputEncoding = [System.Text.Encoding]::UTF8
[console]::OutputEncoding = [System.Text.Encoding]::UTF8

$prompt = Get-Content -Raw -Path '${promptFile}'

# Execute agy and save output
& agy --print $prompt *>&1 | Out-File -FilePath '${resultFile}' -Encoding utf8
`;
fs.writeFileSync(scriptFile, psScript, 'utf8');

try {
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptFile}"`);
  console.log('Result:', fs.readFileSync(resultFile, 'utf8'));
} catch (e) {
  console.log('Exec error:', e.message);
  if (fs.existsSync(resultFile)) {
    console.log('Result File:', fs.readFileSync(resultFile, 'utf8'));
  }
}
