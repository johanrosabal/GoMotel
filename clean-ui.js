const fs = require('fs');
const path = require('path');
const uiDir = path.join(__dirname, 'src/components/ui');

fs.readdirSync(uiDir).forEach(file => {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
     const fullPath = path.join(uiDir, file);
     let content = fs.readFileSync(fullPath, 'utf8');
     // Find and replace data-testid declarations from base ui elements safely
     const original = content;
     content = content.replace(/\sdata-testid="[^"]+"/g, '');
     if (content !== original) {
         fs.writeFileSync(fullPath, content);
         console.log(`Cleaned ${file}`);
     }
  }
});
