const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public");

const files = [
  ["app-v3.html", "index.html"],
  ["app-v3.html", "app-v3.html"],
  ["app-integrado.html", "app-integrado.html"],
  ["backend-test.html", "backend-test.html"],
  ["portal-aluno.html", "portal-aluno.html"],
  ["portal-gestor.html", "portal-gestor.html"],
  ["portal-professor.html", "portal-professor.html"],
  ["portal-responsavel.html", "portal-responsavel.html"],
  ["portal-suporte.html", "portal-suporte.html"],
  ["i9-smart-erp-tutorial.pdf", "i9-smart-erp-tutorial.pdf"],
];

const apiBase = process.env.I9_API_BASE;
const apiV2Base = process.env.I9_API_V2_BASE;

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const [source, target] of files) {
  const sourcePath = path.join(root, source);
  if (!fs.existsSync(sourcePath)) continue;

  const targetPath = path.join(outDir, target);
  if (source.endsWith(".html")) {
    let html = fs.readFileSync(sourcePath, "utf8");
    if (apiBase) {
      html = html.replace(
        "localStorage.getItem('i9_api_base') || 'http://127.0.0.1:4000'",
        `localStorage.getItem('i9_api_base') || '${apiBase}'`
      );
      html = html.replace(/value="http:\/\/127\.0\.0\.1:4000"/g, `value="${apiBase}"`);
      html = html.replace(
        /restoreField\('apiBase', 'http:\/\/127\.0\.0\.1:4000'\)/g,
        `restoreField('apiBase', '${apiBase}')`
      );
    }
    if (apiV2Base) {
      html = html.replace(
        "localStorage.getItem('i9_api_v2_base') || 'http://127.0.0.1:4001'",
        `localStorage.getItem('i9_api_v2_base') || '${apiV2Base}'`
      );
      html = html.replace(/value="http:\/\/127\.0\.0\.1:4001"/g, `value="${apiV2Base}"`);
      html = html.replace(
        /restoreField\('apiV2Base', 'http:\/\/127\.0\.0\.1:4001'\)/g,
        `restoreField('apiV2Base', '${apiV2Base}')`
      );
    }
    fs.writeFileSync(targetPath, html);
  } else {
    fs.copyFileSync(sourcePath, targetPath);
  }
}

fs.writeFileSync(
  path.join(outDir, "_redirects"),
  [
    "/app /index.html 200",
    "/gestor /portal-gestor.html 200",
    "/professor /portal-professor.html 200",
    "/responsavel /portal-responsavel.html 200",
    "/aluno /portal-aluno.html 200",
    "/suporte /portal-suporte.html 200",
    "",
  ].join("\n")
);

console.log(`Netlify static bundle written to ${outDir}`);
