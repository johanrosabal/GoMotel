const { Project, SyntaxKind } = require("ts-morph");
const path = require("path");

const project = new Project({ tsConfigFilePath: "tsconfig.json" });

project.addSourceFilesAtPaths("src/app/**/*.tsx");

const sourceFiles = project.getSourceFiles();

let totalModifiedFiles = 0;
let totalRefinedIds = 0;

for (const sourceFile of sourceFiles) {
  let originalBaseName = sourceFile.getBaseNameWithoutExtension(); // e.g. "page"
  let contextualName = originalBaseName.toLowerCase();
  
  if (originalBaseName === "page" || originalBaseName === "layout" || originalBaseName === "index") {
      const dirPath = sourceFile.getDirectory().getPath(); 
      contextualName = path.basename(dirPath).toLowerCase();
  }

  let modified = false;

  sourceFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.JsxSelfClosingElement || node.getKind() === SyntaxKind.JsxOpeningElement) {
      const testIdAttr = node.getAttribute ? node.getAttribute("data-testid") : null;
      if (!testIdAttr) return;

      const init = testIdAttr.getInitializer();
      if (init && init.getKind() === SyntaxKind.StringLiteral) {
          const originalId = init.getLiteralValue();
          
          if (originalId.startsWith("page-") || originalId.startsWith("layout-") || originalId.startsWith("index-")) {
             const parts = originalId.split("-");
             parts[0] = contextualName; 
             const newId = parts.join("-");

             if (newId !== originalId) {
                 testIdAttr.setInitializer(`"${newId}"`);
                 modified = true;
                 totalRefinedIds++;
             }
          }
      }
    }
  });

  if (modified) {
    totalModifiedFiles++;
    console.log(`Contextualized prefix in /${contextualName}/${originalBaseName}.tsx`);
  }
}

console.log(`\nDone! Successfully modified ${totalModifiedFiles} files.`);
console.log(`Total context prefixes fixed: ${totalRefinedIds}`);
project.saveSync();
