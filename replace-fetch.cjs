const fs = require('fs');
const path = require('path');

const files = [
  'src/components/ProfileEditModal.tsx',
  'src/components/Auth.tsx',
  'src/components/Layout.tsx',
  'src/components/MobileAppHandler.tsx',
  'src/pages/admin/Messages.tsx',
  'src/pages/admin/PromoCodes.tsx',
  'src/pages/admin/Recharges.tsx',
  'src/pages/admin/Balance.tsx',
  'src/pages/admin/Users.tsx',
  'src/pages/admin/Categories.tsx',
  'src/pages/admin/Settings.tsx',
  'src/pages/admin/Products.tsx',
  'src/pages/admin/Orders.tsx',
  'src/pages/ContactUs.tsx',
  'src/pages/Orders.tsx',
  'src/pages/Mail.tsx',
  'src/pages/PromoCodes.tsx',
  'src/pages/Recharge.tsx',
  'src/pages/Instructions.tsx',
  'src/pages/Home.tsx',
  'src/context/AuthContext.tsx',
  'src/context/CurrencyContext.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('apiFetch')) return; // Already processed
  
  // Replace fetch( with apiFetch(
  content = content.replace(/\bfetch\(/g, 'apiFetch(');
  
  // Calculate relative path to src/utils/api
  const depth = file.split('/').length - 2; // src/components/Auth.tsx -> 2 - 2 = 0 -> ../
  let importPath = '';
  if (depth === 0) importPath = './utils/api';
  else if (depth === 1) importPath = '../utils/api';
  else if (depth === 2) importPath = '../../utils/api';
  
  // Add import statement after the last import
  const importStatement = `import { apiFetch } from '${importPath}';\n`;
  const lastImportIndex = content.lastIndexOf('import ');
  if (lastImportIndex !== -1) {
    const endOfLastImport = content.indexOf('\n', lastImportIndex) + 1;
    content = content.slice(0, endOfLastImport) + importStatement + content.slice(endOfLastImport);
  } else {
    content = importStatement + content;
  }
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
