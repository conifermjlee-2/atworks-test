const fs = require('fs');
const path = 'C:/Users/lee/Desktop/atworks-test/poc/atworks-v3/src/components/ScenarioWithAIView.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update DEFAULT_API_LOGS
const logPath = 'C:/Users/lee/Desktop/atworks-test/poc/tmp-project/shopping-mall-next-js/log/api_logs.json';
const logContent = fs.readFileSync(logPath, 'utf8');
const startMarker = 'const DEFAULT_API_LOGS = `';
const endMarker = '`;';
const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);
if (startIndex !== -1 && endIndex !== -1) {
  content = content.slice(0, startIndex + startMarker.length) + logContent + content.slice(endIndex);
  console.log('Successfully updated DEFAULT_API_LOGS');
}

// 2. Replace Target Project buttons
const btnTarget1 = `onClick={() => handleTargetChange('C:\\\\Users\\\\lee\\\\Desktop\\\\atworks-test\\\\poc\\\\tmp-project\\\\react-board-example')}`;
const btnReplace1 = `onClick={() => {
              handleTargetChange('C:\\\\Users\\\\lee\\\\Desktop\\\\atworks-test\\\\poc\\\\tmp-project\\\\react-board-example');
              setReferenceLog(DEFAULT_BOARD_LOGS);
              setLoadedLogFileName('react_board_api_logs.json');
            }}`;
content = content.replace(btnTarget1, btnReplace1);

const btnTarget2 = `onClick={() => setTargetPath('C:\\\\Users\\\\lee\\\\Desktop\\\\atworks-test\\\\poc\\\\tmp-project\\\\shopping-mall-next-js')}`;
const btnReplace2 = `onClick={() => {
              handleTargetChange('C:\\\\Users\\\\lee\\\\Desktop\\\\atworks-test\\\\poc\\\\tmp-project\\\\shopping-mall-next-js');
              setReferenceLog(DEFAULT_API_LOGS);
              setLoadedLogFileName('shopping_mall_api_logs.json');
            }}`;
content = content.replace(btnTarget2, btnReplace2);

// 3. Replace Log buttons
const logBtnTarget1 = `setLoadedLogFileName('api_logs.json');`;
const logBtnReplace1 = `setLoadedLogFileName('shopping_mall_api_logs.json');`;
content = content.replace(logBtnTarget1, logBtnReplace1);

const logBtnTarget2 = `setLoadedLogFileName('board_logs.json');`;
const logBtnReplace2 = `setLoadedLogFileName('react_board_api_logs.json');`;
content = content.replace(logBtnTarget2, logBtnReplace2);

const logBtnText1 = `쇼핑몰 api_logs`;
const logBtnText2 = `게시판 board_logs`;
content = content.replace(logBtnText1, '쇼핑몰 api_logs.json');
content = content.replace(logBtnText2, '게시판 api_logs.json');

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated UI buttons');
