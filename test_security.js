/**
 * Phase 4 Comprehensive Security & Validation Test Suite
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = options.body;
    const isBuffer = Buffer.isBuffer(postData);
    const bodyStr = !isBuffer && typeof postData === "object" ? JSON.stringify(postData) : postData;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    };

    if (bodyStr && !reqOptions.headers["Content-Type"]) {
      reqOptions.headers["Content-Type"] = "application/json";
    }

    if (bodyStr) {
      reqOptions.headers["Content-Length"] = isBuffer ? bodyStr.length : Buffer.byteLength(bodyStr);
    }

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          data: parsed,
          headers: res.headers,
        });
      });
    });

    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function buildMultipartFormData(fields, fileField) {
  const boundary = "----SecurityFormBoundary" + Math.random().toString(36).substring(2);
  const crlf = "\r\n";
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(
      Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="${key}"${crlf}${crlf}${val}${crlf}`, "utf-8")
    );
  }

  if (fileField) {
    const fileHeader = `--${boundary}${crlf}Content-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"${crlf}Content-Type: ${fileField.contentType}${crlf}${crlf}`;
    parts.push(Buffer.from(fileHeader, "utf-8"));
    parts.push(fileField.buffer);
    parts.push(Buffer.from(crlf, "utf-8"));
  }

  parts.push(Buffer.from(`--${boundary}--${crlf}`, "utf-8"));

  const fullBuffer = Buffer.concat(parts);

  return {
    buffer: fullBuffer,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

const sampleValidPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

async function runSecurityTests() {
  console.log("=================================================");
  console.log("SMART ROAD HAZARD REPORTING SYSTEM - SECURITY & VALIDATION TESTS");
  console.log("=================================================\n");

  const results = [];
  const timestamp = Date.now();

  let citizenAToken = "";
  let citizenBToken = "";
  let adminToken = "";
  let reportA = null;

  // Setup: Register Citizen A, Citizen B, Login Admin, Create Report A
  try {
    // 1. Citizen A tries privilege escalation by sending role: "admin"
    const regRes = await fetchJson("http://localhost:5000/api/users/register", {
      method: "POST",
      body: {
        name: "Security Tester A",
        email: `sec_a_${timestamp}@test.com`,
        phone: "9876543210",
        password: "Password123!",
        role: "admin", // ATTEMPTED PRIVILEGE ESCALATION
      },
    });

    citizenAToken = regRes.data?.token;
    const isEscalationBlocked = regRes.status === 201 && regRes.data?.user?.role === "user";
    results.push({
      name: "S1. Privilege escalation prevented during public registration (forced role: 'user')",
      pass: isEscalationBlocked,
      details: `Saved role: "${regRes.data?.user?.role}" (Privilege escalation denied)`,
    });

    // 2. Citizen B
    const regB = await fetchJson("http://localhost:5000/api/users/register", {
      method: "POST",
      body: {
        name: "Security Tester B",
        email: `sec_b_${timestamp}@test.com`,
        phone: "9876543211",
        password: "Password123!",
      },
    });
    citizenBToken = regB.data?.token;

    // 3. Admin login
    const adminLog = await fetchJson("http://localhost:5000/api/users/login", {
      method: "POST",
      body: {
        email: "manvendra123@gmail.com",
        password: "Admin@123",
      },
    });
    adminToken = adminLog.data?.token;

    // 4. Create Report A
    const mpA = buildMultipartFormData(
      {
        category: "Pothole",
        severity: "High",
        address: "Airport Road",
        landmark: "Gate 3",
        description: "Security test hazard report",
      },
      {
        name: "image",
        filename: "test.png",
        contentType: "image/png",
        buffer: sampleValidPng,
      }
    );

    const rA = await fetchJson("http://localhost:5000/api/reports", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
        "Content-Type": mpA.contentType,
      },
      body: mpA.buffer,
    });
    reportA = rA.data?.report;
  } catch (err) {
    console.error("Setup error:", err);
  }

  // S2. Normal users cannot access admin-only endpoint GET /api/reports
  try {
    const res = await fetchJson("http://localhost:5000/api/reports", {
      method: "GET",
      headers: { Authorization: `Bearer ${citizenAToken}` },
    });
    const pass = res.status === 403 && res.data?.message?.includes("Admin only");
    results.push({
      name: "S2. Normal users blocked from GET /api/reports (403 Forbidden)",
      pass,
      details: `Status: ${res.status}, Message: "${res.data?.message}"`,
    });
  } catch (err) {
    results.push({ name: "S2. Normal users blocked from GET /api/reports", pass: false, details: err.message });
  }

  // S3. Normal users cannot access admin-only endpoint PATCH /api/reports/:id/status
  try {
    const res = await fetchJson(`http://localhost:5000/api/reports/${reportA?._id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${citizenAToken}` },
      body: { status: "Verified" },
    });
    const pass = res.status === 403 && res.data?.message?.includes("Admin only");
    results.push({
      name: "S3. Normal users blocked from PATCH /api/reports/:id/status (403 Forbidden)",
      pass,
      details: `Status: ${res.status}, Message: "${res.data?.message}"`,
    });
  } catch (err) {
    results.push({ name: "S3. Normal users blocked from status update", pass: false, details: err.message });
  }

  // S4. Horizontal Privilege Escalation: Citizen B cannot view Citizen A's report
  try {
    const res = await fetchJson(`http://localhost:5000/api/reports/${reportA?._id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${citizenBToken}` },
    });
    const pass = res.status === 403 && res.data?.message?.includes("not authorized");
    results.push({
      name: "S4. Horizontal isolation enforced (Citizen B blocked from Citizen A's report with 403)",
      pass,
      details: `Status: ${res.status}, Message: "${res.data?.message}"`,
    });
  } catch (err) {
    results.push({ name: "S4. Horizontal isolation enforced", pass: false, details: err.message });
  }

  // S5. Missing JWT returns 401
  try {
    const res = await fetchJson("http://localhost:5000/api/users/profile", {
      method: "GET",
    });
    const pass = res.status === 401 && res.data?.message?.includes("token missing");
    results.push({
      name: "S5. Missing JWT rejected on protected endpoints (401 Unauthorized)",
      pass,
      details: `Status: ${res.status}, Message: "${res.data?.message}"`,
    });
  } catch (err) {
    results.push({ name: "S5. Missing JWT rejected", pass: false, details: err.message });
  }

  // S6. Invalid / forged JWT returns 401
  try {
    const res = await fetchJson("http://localhost:5000/api/users/profile", {
      method: "GET",
      headers: { Authorization: "Bearer forged.token.signature" },
    });
    const pass = res.status === 401 && res.data?.message?.includes("Invalid or expired");
    results.push({
      name: "S6. Forged / invalid JWT signature rejected (401 Unauthorized)",
      pass,
      details: `Status: ${res.status}, Message: "${res.data?.message}"`,
    });
  } catch (err) {
    results.push({ name: "S6. Forged JWT rejected", pass: false, details: err.message });
  }

  // S7. Invalid format report ID returns 400
  try {
    const res = await fetchJson("http://localhost:5000/api/reports/invalid-mongo-id-here", {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pass = res.status === 400 && res.data?.message === "Invalid report ID";
    results.push({
      name: "S7. Non-ObjectId report ID string rejected (400 Invalid report ID)",
      pass,
      details: `Status: ${res.status}, Message: "${res.data?.message}"`,
    });
  } catch (err) {
    results.push({ name: "S7. Invalid format report ID rejected", pass: false, details: err.message });
  }

  // S8. Valid format but non-existent ObjectId returns 404
  try {
    const res = await fetchJson("http://localhost:5000/api/reports/507f1f77bcf86cd799439011", {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pass = res.status === 404 && res.data?.message === "Report not found";
    results.push({
      name: "S8. Non-existent report ID returns clean 404 Not Found",
      pass,
      details: `Status: ${res.status}, Message: "${res.data?.message}"`,
    });
  } catch (err) {
    results.push({ name: "S8. Non-existent report ID returns 404", pass: false, details: err.message });
  }

  // S9. Invalid report status rejected by admin status controller
  try {
    const res = await fetchJson(`http://localhost:5000/api/reports/${reportA?._id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: "ArbitraryIllegalStatus" },
    });
    const pass = res.status === 400 && res.data?.message === "Invalid report status";
    results.push({
      name: "S9. Arbitrary / illegal report status values rejected (400 Bad Request)",
      pass,
      details: `Status: ${res.status}, Message: "${res.data?.message}"`,
    });
  } catch (err) {
    results.push({ name: "S9. Illegal status values rejected", pass: false, details: err.message });
  }

  // S10. Unsupported file type rejected by Multer
  try {
    const txtBuffer = Buffer.from("This is a plain text file, not an image.", "utf-8");
    const mpTxt = buildMultipartFormData(
      {
        category: "Pothole",
        severity: "Low",
        address: "Test Street",
        description: "Text file test",
      },
      {
        name: "image",
        filename: "notes.txt",
        contentType: "text/plain",
        buffer: txtBuffer,
      }
    );

    const res = await fetchJson("http://localhost:5000/api/reports", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
        "Content-Type": mpTxt.contentType,
      },
      body: mpTxt.buffer,
    });

    const pass = res.status === 400 && res.data?.message === "Only image files are allowed";
    results.push({
      name: "S10. Non-image file upload rejected by file filter (400 Only image files are allowed)",
      pass,
      details: `Status: ${res.status}, Message: "${res.data?.message}"`,
    });
  } catch (err) {
    results.push({ name: "S10. Non-image file upload rejected", pass: false, details: err.message });
  }

  // S11. Oversized image (> 5MB) rejected by Multer limit
  try {
    // 5.5 MB dummy buffer
    const bigBuffer = Buffer.alloc(5.5 * 1024 * 1024, 0xff);
    const mpBig = buildMultipartFormData(
      {
        category: "Pothole",
        severity: "Low",
        address: "Test Street",
        description: "Oversized file test",
      },
      {
        name: "image",
        filename: "huge_photo.png",
        contentType: "image/png",
        buffer: bigBuffer,
      }
    );

    const res = await fetchJson("http://localhost:5000/api/reports", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
        "Content-Type": mpBig.contentType,
      },
      body: mpBig.buffer,
    });

    const pass = res.status === 400 && res.data?.message === "Image size must not exceed 5 MB";
    results.push({
      name: "S11. Oversized file (>5MB) rejected by Multer limit (400 Image size must not exceed 5 MB)",
      pass,
      details: `Status: ${res.status}, Message: "${res.data?.message}"`,
    });
  } catch (err) {
    results.push({ name: "S11. Oversized file rejected", pass: false, details: err.message });
  }

  // S12. Password hashes are never leaked in API responses
  try {
    const profRes = await fetchJson("http://localhost:5000/api/users/profile", {
      method: "GET",
      headers: { Authorization: `Bearer ${citizenAToken}` },
    });
    const hasPasswordInProfile = !!profRes.data?.user?.password;

    const logRes = await fetchJson("http://localhost:5000/api/users/login", {
      method: "POST",
      body: {
        email: `sec_a_${timestamp}@test.com`,
        password: "Password123!",
      },
    });
    const hasPasswordInLogin = !!logRes.data?.user?.password;

    const pass = !hasPasswordInProfile && !hasPasswordInLogin;
    results.push({
      name: "S12. Sensitive password hashes omitted from profile & login responses (select: false)",
      pass,
      details: `Profile has password: ${hasPasswordInProfile}, Login has password: ${hasPasswordInLogin}`,
    });
  } catch (err) {
    results.push({ name: "S12. Password hashes omitted", pass: false, details: err.message });
  }

  // S13. Git ignore rules verify .env and node_modules are excluded
  try {
    const gitignoreContent = fs.readFileSync(".gitignore", "utf-8");
    const ignoresEnv = gitignoreContent.includes(".env");
    const ignoresNodeModules = gitignoreContent.includes("node_modules");
    const pass = ignoresEnv && ignoresNodeModules;
    results.push({
      name: "S13. Sensitive .env and node_modules strictly excluded from Git (.gitignore verified)",
      pass,
      details: `Ignores .env: ${ignoresEnv}, Ignores node_modules: ${ignoresNodeModules}`,
    });
  } catch (err) {
    results.push({ name: "S13. Git ignore rules verified", pass: false, details: err.message });
  }

  console.log("-------------------------------------------------");
  let allPass = true;
  for (const r of results) {
    const statusMark = r.pass ? "[PASS]" : "[FAIL]";
    console.log(`${statusMark} ${r.name}`);
    console.log(`       Details: ${r.details}`);
    if (!r.pass) allPass = false;
  }
  console.log("-------------------------------------------------");
  console.log(`SUMMARY: ${results.filter((r) => r.pass).length} / ${results.length} security tests passed.`);
  console.log("=================================================");

  process.exit(allPass ? 0 : 1);
}

runSecurityTests();
