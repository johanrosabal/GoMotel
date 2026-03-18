const { Project, SyntaxKind } = require("ts-morph");
const path = require("path");

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

project.addSourceFilesAtPaths("src/components/**/*.tsx");
project.addSourceFilesAtPaths("src/app/**/*.tsx");

const elementsToTag = new Set([
  "Button", "Input", "SelectTrigger", 
  "Textarea", "Link", "Checkbox", "Switch",
  "RadioGroupItem", "form"
]);

const sourceFiles = project.getSourceFiles();

let totalModifiedFiles = 0;
let totalIdAdded = 0;

for (const sourceFile of sourceFiles) {
  const fileName = sourceFile.getBaseNameWithoutExtension();
  let modified = false;
  let elementCounters = {};

  sourceFile.forEachDescendant(node => {
    // Both self-closing and opening tags
    if (node.getKind() === SyntaxKind.JsxSelfClosingElement || node.getKind() === SyntaxKind.JsxOpeningElement) {
      const tagNameNode = node.getTagNameNode();
      if (!tagNameNode) return;
      const tagName = tagNameNode.getText();
      
      if (elementsToTag.has(tagName)) {
        // Check if id already exists
        const attributes = node.getAttributes();
        const hasId = attributes.some(attr => {
          if (attr.getKind() === SyntaxKind.JsxAttribute) {
            return attr.getNameNode().getText() === "id";
          }
          return false;
        });
        
        if (!hasId) {
          if (!elementCounters[tagName]) {
            elementCounters[tagName] = 1;
          } else {
            elementCounters[tagName]++;
          }
          
          const idValue = `${fileName}-${tagName}-${elementCounters[tagName]}`.toLowerCase();
          
          // Add attribute
          node.addAttribute({
            name: "id",
            initializer: `"${idValue}"`
          });
          
          modified = true;
          totalIdAdded++;
        }
      }
    }
  });

  if (modified) {
    totalModifiedFiles++;
    console.log(`Modified ${fileName}.tsx - Added ${Object.values(elementCounters).reduce((a,b)=>a+b, 0)} IDs.`);
  }
}

console.log(`\nDone! Successfully modified ${totalModifiedFiles} files.`);
console.log(`Total new IDs added: ${totalIdAdded}`);
project.saveSync();
