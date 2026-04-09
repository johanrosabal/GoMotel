const { Project, SyntaxKind } = require("ts-morph");
const path = require("path");

const project = new Project({ tsConfigFilePath: "tsconfig.json" });

project.addSourceFilesAtPaths("src/components/**/*.tsx");
project.addSourceFilesAtPaths("src/app/**/*.tsx");

const sourceFiles = project.getSourceFiles();

const TRANSLATIONS = {
    "guardar": "save",
    "crear": "create",
    "añadir": "add",
    "agregar": "add",
    "nuevo": "new",
    "cancelar": "cancel",
    "cerrar": "close",
    "eliminar": "delete",
    "quitar": "remove",
    "editar": "edit",
    "modificar": "edit",
    "actualizar": "update",
    "login": "login",
    "iniciar": "login",
    "entrar": "login",
    "salir": "logout",
    "continuar": "continue",
    "siguiente": "next",
    "anterior": "prev",
    "volver": "back",
    "regresar": "back",
    "buscar": "search",
    "imprimir": "print",
    "descargar": "download"
};

function translateAction(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    for (const [es, en] of Object.entries(TRANSLATIONS)) {
        if (lower.includes(es)) return en;
    }
    return null;
}

function cleanString(str) {
  if (!str) return "";
  return str.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function getContext(sourceFile) {
    let baseName = sourceFile.getBaseNameWithoutExtension();
    if (["page", "layout", "index"].includes(baseName)) {
        const dirPath = sourceFile.getDirectory().getPath(); 
        baseName = path.basename(dirPath);
        if (baseName.startsWith("[")) {
            // [id] -> id
            baseName = baseName.replace(/\[|\]/g, "");
        }
    }
    return cleanString(baseName);
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

function getFormFieldName(node) {
    let current = node.getParent();
    let depth = 0;
    while (current && depth < 5) {
        if (current.getKind() === SyntaxKind.JsxElement || current.getKind() === SyntaxKind.JsxSelfClosingElement) {
           const openingNode = current.getKind() === SyntaxKind.JsxElement ? current.getOpeningElement() : current;
           if (openingNode.getTagNameNode().getText() === "FormField") {
               return getPropValue(openingNode, "name");
           }
        }
        current = current.getParent();
        depth++;
    }
    return null;
}

function getSemanticName(node, tagName) {
    const isButton = ["button", "link", "a"].includes(tagName);
    
    if (!isButton) {
        // Form inputs/selects
        let fName = getFormFieldName(node);
        if (fName) return fName;
        
        let nName = getPropValue(node, "name");
        if (nName) return nName;
        
        // Final fallback to placeholder or standard testid fragment if possible
        if (tagName === "form") return "main";
        return null;
    }
    
    // Buttons/Links
    // 1. Try to translate standard visible text
    let textContent = "";
    if (node.getKind() === SyntaxKind.JsxOpeningElement) {
       const parent = node.getParent();
       if (parent && parent.getKind() === SyntaxKind.JsxElement) {
          parent.getJsxChildren().forEach(child => {
             if (child.getKind() === SyntaxKind.JsxText) textContent += child.getText() + " ";
          });
       }
    }
    let translated = translateAction(textContent);
    if (translated) return translated;
    
    // 2. Check inner Icons
    let hasIconAction = null;
    if (node.getKind() === SyntaxKind.JsxOpeningElement) {
       const parent = node.getParent();
       if (parent && parent.getKind() === SyntaxKind.JsxElement) {
          parent.getJsxChildren().forEach(child => {
             if (child.getKind() === SyntaxKind.JsxElement || child.getKind() === SyntaxKind.JsxSelfClosingElement) {
                 const tag = child.getKind() === SyntaxKind.JsxElement ? child.getOpeningElement().getTagNameNode().getText() : child.getTagNameNode().getText();
                 if (["X", "XIcon", "XCircle"].includes(tag)) hasIconAction = "close";
                 if (["Trash", "Trash2", "TrashIcon"].includes(tag)) hasIconAction = "delete";
                 if (["Pencil", "Edit", "Edit2"].includes(tag)) hasIconAction = "edit";
                 if (["Plus", "PlusCircle", "PlusIcon"].includes(tag)) hasIconAction = "add";
                 if (["Search", "SearchIcon"].includes(tag)) hasIconAction = "search";
                 if (["ArrowRight", "ChevronRight"].includes(tag) && !hasIconAction) hasIconAction = "next";
                 if (["ArrowLeft", "ChevronLeft"].includes(tag) && !hasIconAction) hasIconAction = "back";
             }
          });
       }
    }
    if (hasIconAction) return hasIconAction;

    // 3. Fallback to special props and type="submit"
    if (getPropValue(node, "type") === "submit") return "submit";
    const onClick = getPropValue(node, "onClick"); // Mostly it's a JSXExpr though
    if (onClick && typeof onClick === 'string') {
        const lowerClick = onClick.toLowerCase();
        if (lowerClick.includes("close")) return "close";
        if (lowerClick.includes("delete")) return "delete";
    }
    if (tagName === "link" || tagName === "a") {
        let hf = getPropValue(node, "href");
        if (hf) {
            hf = hf.replace(/[/]/g, "-").replace(/--/g, "-");
            return hf; // e.g. -dashboard
        }
    }
    
    // 4. Fallback to parsing original auto-generated semantic text from aria config
    const ariaLabel = getPropValue(node, "aria-label");
    if (ariaLabel) {
        let tr = translateAction(ariaLabel);
        if (tr) return tr;
        return ariaLabel.split(/\s+/)[0]; 
    }
    
    return "action"; // absolute fallback for buttons without context
}

const UI_COMPONENTS_DIR = path.join(process.cwd(), 'src/components/ui');

// Ensure we don't mess up the clean ui components again
let totalModifiedFiles = 0;
let totalFormattedIds = 0;

for (const sourceFile of sourceFiles) {
  // Prevent adding testids inside /ui/ base templates
  if (sourceFile.getFilePath().startsWith(UI_COMPONENTS_DIR)) {
      continue;
  }

  const context = getContext(sourceFile);
  let modified = false;
  let fallbackCounters = {};

  sourceFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.JsxSelfClosingElement || node.getKind() === SyntaxKind.JsxOpeningElement) {
      
      const testIdAttr = node.getAttribute ? node.getAttribute("data-testid") : null;
      if (!testIdAttr) return; // We only refactor elements that ALREADY have an ID assigned from previous passes (which is basically all UI elems now)

      let tagName = node.getTagNameNode().getText().toLowerCase();
      // Simplify tag name to standardized types
      if (tagName === "a") tagName = "link";
      if (tagName === "selecttrigger") tagName = "select";

      // Re-evaluate Semantic Name
      let nameFragment = cleanString(getSemanticName(node, tagName));
      
      if (!nameFragment || nameFragment === "-") {
          // If all inference is totally lost, use an index to prevent invalid duplicates, but this is rare now
          if (!fallbackCounters[tagName]) fallbackCounters[tagName] = 1;
          else fallbackCounters[tagName]++;
           nameFragment = fallbackCounters[tagName].toString();
      }

      // Structure Format: [context]-[name]-[type]
      let newId = `${context}-${nameFragment}-${tagName}`;
      // Clean possible double dashes caused by empty fragments
      newId = newId.replace(/--+/g, "-").replace(/^-+/, "").replace(/-+$/, "");

      const init = testIdAttr.getInitializer();
      if (init && init.getKind() === SyntaxKind.StringLiteral) {
          const originalId = init.getLiteralValue();
          if (newId !== originalId) {
             testIdAttr.setInitializer(`"${newId}"`);
             modified = true;
             totalFormattedIds++;
          }
      }
    }
  });

  if (modified) {
    totalModifiedFiles++;
    console.log(`Estandarizado a convención [contexto]-[name]-[tipo] en ${sourceFile.getBaseName()}`);
  }
}

console.log(`\nScript Completado! Archivos modificados: ${totalModifiedFiles}.`);
console.log(`Total data-testids re-escritos en formato inglés estricto: ${totalFormattedIds}`);
project.saveSync();
