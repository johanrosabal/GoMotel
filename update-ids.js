const { Project, SyntaxKind } = require("ts-morph");

const project = new Project({ tsConfigFilePath: "tsconfig.json" });

project.addSourceFilesAtPaths("src/components/**/*.tsx");
project.addSourceFilesAtPaths("src/app/**/*.tsx");

const elementsToTag = new Set([
  "Button", "button", "Input", "SelectTrigger", 
  "Textarea", "Link", "Checkbox", "Switch",
  "RadioGroupItem", "form"
]);

const sourceFiles = project.getSourceFiles();

let totalModifiedFiles = 0;
let totalIdReplaced = 0;

function cleanString(str) {
  if (!str) return "";
  return str.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function getSemanticSuffix(node, tagName) {
  const getPropValue = (propName) => {
    const attrNode = node.getAttribute ? node.getAttribute(propName) : null;
    if (attrNode && attrNode.getInitializer()) {
      const init = attrNode.getInitializer();
      if (init.getKind() === SyntaxKind.StringLiteral) {
        return init.getLiteralValue();
      }
    }
    return null;
  };

  const getInnerText = () => {
    if (node.getKind() === SyntaxKind.JsxOpeningElement) {
      const parent = node.getParent();
      if (parent && parent.getKind() === SyntaxKind.JsxElement) {
        let text = "";
        parent.getJsxChildren().forEach(child => {
          if (child.getKind() === SyntaxKind.JsxText) {
             // exclude trailing/leading newlines/whitespace
            text += child.getText().replace(/[\r\n]+/g, ' ').trim() + " ";
          }
        });
        return text.trim();
      }
    }
    return "";
  };

  let suffix = "";
  if (tagName === "Button" || tagName === "button" || tagName === "Link") {
    let text = getInnerText().trim();
    if (text) {
        text = text.split(/\s+/).slice(0, 3).join("-");
        suffix = text;
    }
    if (!suffix && tagName === "Link") {
      const href = getPropValue("href");
      if (href) suffix = href;
    }
    if (!suffix) {
      const ariaLabel = getPropValue("aria-label");
      if (ariaLabel) suffix = ariaLabel;
    }
  } else if (tagName === "Input" || tagName === "Textarea" || tagName === "Checkbox" || tagName === "Switch") {
    const name = getPropValue("name");
    if (name) suffix = name;
    if (!suffix) {
      const ph = getPropValue("placeholder");
      if (ph) suffix = ph.split(/\s+/).slice(0, 3).join("-");
    }
  } else if (tagName === "form") {
    suffix = "main";
  }

  return cleanString(suffix);
}

for (const sourceFile of sourceFiles) {
  const fileName = sourceFile.getBaseNameWithoutExtension();
  let modified = false;
  let elementCounters = {};

  sourceFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.JsxSelfClosingElement || node.getKind() === SyntaxKind.JsxOpeningElement) {
      const tagNameNode = node.getTagNameNode();
      if (!tagNameNode) return;
      const tagName = tagNameNode.getText();
      
      if (elementsToTag.has(tagName)) {
        const idAttr = node.getAttribute ? node.getAttribute("id") : null;
        
        let shouldReplace = false;
        let originalId = "";
        
        if (!idAttr) {
            shouldReplace = true;
        } else {
            const init = idAttr.getInitializer();
            if (init && init.getKind() === SyntaxKind.StringLiteral) {
                originalId = init.getLiteralValue();
                if (/^[a-z0-9]+-(button|input|selecttrigger|textarea|link|checkbox|switch|radiogroupitem|form)-\d+$/i.test(originalId)) {
                    shouldReplace = true;
                }
            }
        }

        if (shouldReplace) {
          const suffix = getSemanticSuffix(node, tagName);
          let newId = "";
          
          if (suffix) {
            newId = `${fileName}-${tagName}-${suffix}`.toLowerCase();
          } else {
            if (!elementCounters[tagName]) elementCounters[tagName] = 1;
            else elementCounters[tagName]++;
            newId = `${fileName}-${tagName}-${elementCounters[tagName]}`.toLowerCase();
          }
          
          let finalId = newId;
          let dupeCounter = 1;
          const usedIdsInFile = elementCounters._used || new Set();
          if (!elementCounters._used) elementCounters._used = usedIdsInFile;
          
          while (usedIdsInFile.has(finalId)) {
            finalId = `${newId}-${dupeCounter}`;
            dupeCounter++;
          }
          usedIdsInFile.add(finalId);
          
          if (originalId !== finalId) {
             if (idAttr) idAttr.remove();
             node.addAttribute({
                name: "id",
                initializer: `"${finalId}"`
             });
             modified = true;
             totalIdReplaced++;
          }
        }
      }
    }
  });

  if (modified) {
    totalModifiedFiles++;
    console.log(`Replaced generic IDs in ${fileName}.tsx`);
  }
}

console.log(`\nDone! Successfully modified ${totalModifiedFiles} files.`);
console.log(`Total new semantic IDs injected: ${totalIdReplaced}`);
project.saveSync();
