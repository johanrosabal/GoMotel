const { Project, SyntaxKind } = require("ts-morph");

const project = new Project({ tsConfigFilePath: "tsconfig.json" });

project.addSourceFilesAtPaths("src/components/**/*.tsx");
project.addSourceFilesAtPaths("src/app/**/*.tsx");

const sourceFiles = project.getSourceFiles();

let totalModifiedFiles = 0;
let totalRefinedIds = 0;

function cleanString(str) {
  if (!str) return "";
  return str.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function getPropValue(node, propName) {
    if (!node || !node.getAttribute) return null;
    const attrNode = node.getAttribute(propName);
    if (attrNode && attrNode.getInitializer()) {
      const init = attrNode.getInitializer();
      if (init.getKind() === SyntaxKind.StringLiteral) {
        return init.getLiteralValue();
      }
    }
    return null;
}

function solveInputName(node) {
    let current = node.getParent();
    let depth = 0;
    while (current && depth < 5) {
        if (current.getKind() === SyntaxKind.JsxElement || current.getKind() === SyntaxKind.JsxSelfClosingElement) {
           let openingNode = current.getKind() === SyntaxKind.JsxElement ? current.getOpeningElement() : current;
           
           if (openingNode.getTagNameNode().getText() === "FormField") {
               return getPropValue(openingNode, "name");
           }
        }
        current = current.getParent();
        depth++;
    }
    return null;
}

function solveButtonAction(node) {
    // Check for type="submit"
    if (getPropValue(node, "type") === "submit") return "submit";
    
    // Check for icons inside
    let hasCloseIcon = false;
    let hasTrashIcon = false;
    let hasEditIcon = false;
    let hasPlusIcon = false;

    if (node.getKind() === SyntaxKind.JsxOpeningElement) {
       const parent = node.getParent();
       if (parent && parent.getKind() === SyntaxKind.JsxElement) {
          parent.getJsxChildren().forEach(child => {
             if (child.getKind() === SyntaxKind.JsxElement || child.getKind() === SyntaxKind.JsxSelfClosingElement) {
                 const opening = child.getKind() === SyntaxKind.JsxElement ? child.getOpeningElement() : child;
                 const tag = opening.getTagNameNode().getText();
                 if (tag === "X" || tag === "XIcon" || tag === "XCircle") hasCloseIcon = true;
                 if (tag === "Trash" || tag === "Trash2" || tag === "TrashIcon") hasTrashIcon = true;
                 if (tag === "Pencil" || tag === "Edit" || tag === "Edit2") hasEditIcon = true;
                 if (tag === "Plus" || tag === "PlusCircle" || tag === "PlusIcon") hasPlusIcon = true;
             }
          });
       }
    }

    if (hasCloseIcon) return "close";
    if (hasTrashIcon) return "delete";
    if (hasEditIcon) return "edit";
    if (hasPlusIcon) return "add";

    // check onClick
    const onClickAttr = node.getAttribute ? node.getAttribute("onClick") : null;
    if (onClickAttr && onClickAttr.getInitializer()) {
        const text = onClickAttr.getInitializer().getText().toLowerCase();
        if (text.includes("close") || text.includes("setopen(false)") || text.includes("cancel")) return "cancel";
        if (text.includes("delete") || text.includes("remove")) return "delete";
    }

    return null;
}

for (const sourceFile of sourceFiles) {
  const fileName = sourceFile.getBaseNameWithoutExtension();
  let modified = false;

  sourceFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.JsxSelfClosingElement || node.getKind() === SyntaxKind.JsxOpeningElement) {
      const testIdAttr = node.getAttribute ? node.getAttribute("data-testid") : null;
      if (!testIdAttr) return;

      const init = testIdAttr.getInitializer();
      if (init && init.getKind() === SyntaxKind.StringLiteral) {
          const originalId = init.getLiteralValue();
          
          if (/-\d+$/.test(originalId)) {
             const tagName = node.getTagNameNode().getText().toLowerCase();
             let semanticReplacement = null;

             if (["input", "textarea", "selecttrigger", "checkbox", "switch"].includes(tagName)) {
                 semanticReplacement = solveInputName(node);
             } else if (tagName === "button") {
                 semanticReplacement = solveButtonAction(node);
             }
             
             if (semanticReplacement) {
                 const newId = `${fileName}-${tagName}-${cleanString(semanticReplacement)}`.toLowerCase();
                 if (newId !== originalId) {
                     testIdAttr.setInitializer(`"${newId}"`);
                     modified = true;
                     totalRefinedIds++;
                 }
             }
          }
      }
    }
  });

  if (modified) {
    totalModifiedFiles++;
    console.log(`Refined ids in ${fileName}.tsx`);
  }
}

console.log(`\nDone! Successfully modified ${totalModifiedFiles} files.`);
console.log(`Total data-testid intelligently refined: ${totalRefinedIds}`);
project.saveSync();
