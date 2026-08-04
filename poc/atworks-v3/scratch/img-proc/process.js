const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const originDir = 'C:\\Users\\lee\\Documents\\이민진\\origin';
const targetDir = 'C:\\Users\\lee\\Documents\\이민진\\target';

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function processImages() {
  const files = fs.readdirSync(originDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
  
  for (const file of files) {
    const inputPath = path.join(originDir, file);
    const outputPath = path.join(targetDir, file);
    
    console.log(`Processing ${file}...`);
    
    const metadata = await sharp(inputPath).metadata();
    const width = metadata.width;
    const height = metadata.height;

    // Remove the diamond in the bottom right by applying a strong blur to that region
    const blurBoxWidth = Math.floor(width * 0.15); // 15% of width
    const blurBoxHeight = Math.floor(height * 0.15); // 15% of height
    
    const bottomRight = await sharp(inputPath)
      .extract({ 
        left: width - blurBoxWidth, 
        top: height - blurBoxHeight, 
        width: blurBoxWidth, 
        height: blurBoxHeight 
      })
      .blur(40)
      .toBuffer();
      
    const watermarkRemoved = await sharp(inputPath)
      .composite([
        {
          input: bottomRight,
          top: height - blurBoxHeight,
          left: width - blurBoxWidth,
        }
      ])
      .toBuffer();

    // Convert to YouTube Shorts size: 1080x1920 with solid black background
    await sharp(watermarkRemoved)
      .resize(1080, 1920, { 
        fit: 'contain', 
        background: { r: 0, g: 0, b: 0, alpha: 1 } 
      })
      .toFile(outputPath);
      
    console.log(`Saved to ${outputPath}`);
  }
  console.log("All done!");
}

processImages().catch(console.error);
