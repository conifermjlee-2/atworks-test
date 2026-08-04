const sharp = require('sharp');
const path = require('path');

const originPath = 'C:\\Users\\lee\\Documents\\이민진\\origin';

async function check() {
  const metadata = await sharp(path.join(originPath, '1.png')).metadata();
  console.log('Image dimensions:', metadata.width, 'x', metadata.height);
}
check();
