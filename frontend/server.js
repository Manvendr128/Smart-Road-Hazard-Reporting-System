const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.FRONTEND_PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "Frontend");

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  // Parse clean URL pathname without query strings
  let pathname = req.url.split("?")[0];

  // Route aliases
  if (pathname === "/" || pathname === "/home") {
    pathname = "/home.html";
  } else if (pathname === "/login") {
    pathname = "/login.html";
  } else if (pathname === "/register" || pathname === "/signup") {
    pathname = "/register.html";
  } else if (pathname === "/features") {
    pathname = "/features.html";
  } else if (pathname === "/about") {
    pathname = "/about.html";
  } else if (pathname === "/contact") {
    pathname = "/contact.html";
  } else if (pathname === "/admin" || pathname === "/feature/admin") {
    pathname = "/admin.html";
  } else if (pathname === "/report" || pathname === "/feature/complaint" || pathname === "/feature/photo-upload") {
    pathname = "/report.html";
  } else if (pathname === "/my-reports" || pathname === "/history" || pathname === "/status" || pathname === "/feature/history" || pathname === "/feature/status") {
    pathname = "/my-reports.html";
  } else if (pathname === "/report-details") {
    pathname = "/report-details.html";
  }

  // Prevent path traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  let filePath = path.join(PUBLIC_DIR, safePath);

  // If path doesn't have an extension, try appending .html
  if (!path.extname(filePath)) {
    if (fs.existsSync(filePath + ".html")) {
      filePath = filePath + ".html";
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>404 Not Found</title></head>
        <body style="font-family:Arial,sans-serif;padding:40px;text-align:center;">
          <h1>404 - Page Not Found</h1>
          <p>The requested page <code>${pathname}</code> does not exist.</p>
          <a href="/home.html">Return to Home</a>
        </body>
        </html>
      `);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*"
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Frontend server running at http://localhost:${PORT}`);
});
