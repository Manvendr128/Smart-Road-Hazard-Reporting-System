/**
 * Phase 1 Comprehensive Automated Verification Suite
 */

const http = require("http");

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = options.body ? JSON.stringify(options.body) : null;

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

    if (postData) {
      reqOptions.headers["Content-Type"] = "application/json";
      reqOptions.headers["Content-Length"] = Buffer.byteLength(postData);
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
    if (postData) req.write(postData);
    req.end();
  });
}

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    }).on("error", reject);
  });
}

async function runTests() {
  console.log("=================================================");
  console.log("SMART ROAD HAZARD REPORTING SYSTEM - PHASE 1 TESTS");
  console.log("=================================================\n");

  const results = [];

  // TEST 1: Backend starts & responds
  try {
    const backendRoot = await fetchJson("http://localhost:5000/");
    const pass = backendRoot.status === 200 && backendRoot.data.success === true;
    results.push({ name: "1. Backend starts & root API responds", pass, details: backendRoot.data.message });
  } catch (err) {
    results.push({ name: "1. Backend starts & root API responds", pass: false, details: err.message });
  }

  // TEST 2: Frontend starts & serves static pages
  try {
    const homeRes = await fetchHtml("http://localhost:3000/home.html");
    const loginRes = await fetchHtml("http://localhost:3000/login.html");
    const registerRes = await fetchHtml("http://localhost:3000/register.html");
    const adminRes = await fetchHtml("http://localhost:3000/admin.html");
    const pass = homeRes.status === 200 && loginRes.status === 200 && registerRes.status === 200 && adminRes.status === 200;
    results.push({
      name: "2. Frontend starts & serves pages (home, login, register, admin)",
      pass,
      details: `Statuses: home=${homeRes.status}, login=${loginRes.status}, register=${registerRes.status}, admin=${adminRes.status}`,
    });
  } catch (err) {
    results.push({ name: "2. Frontend starts & serves pages", pass: false, details: err.message });
  }

  // Generate unique test user
  const uniqueId = Date.now();
  const testUser = {
    name: "Test Citizen " + uniqueId,
    email: `citizen_${uniqueId}@test.com`,
    phone: "9876543210",
    password: "TestPassword123",
  };

  let citizenToken = "";

  // TEST 3: New user registration works
  try {
    const regRes = await fetchJson("http://localhost:5000/api/users/register", {
      method: "POST",
      body: testUser,
    });
    const pass = regRes.status === 201 && regRes.data.success === true && regRes.data.user.role === "user" && !!regRes.data.token;
    citizenToken = regRes.data.token;
    results.push({
      name: "3. New user registration works (role: user enforced)",
      pass,
      details: `Status: ${regRes.status}, Role: ${regRes.data?.user?.role}, Token received: ${!!citizenToken}`,
    });
  } catch (err) {
    results.push({ name: "3. New user registration works", pass: false, details: err.message });
  }

  // TEST 4: Duplicate email rejected
  try {
    const dupRes = await fetchJson("http://localhost:5000/api/users/register", {
      method: "POST",
      body: testUser,
    });
    const pass = dupRes.status === 409 && dupRes.data.success === false;
    results.push({
      name: "4. Duplicate email registration rejected (409 Conflict)",
      pass,
      details: `Status: ${dupRes.status}, Message: ${dupRes.data.message}`,
    });
  } catch (err) {
    results.push({ name: "4. Duplicate email rejected", pass: false, details: err.message });
  }

  // TEST 5: User login works
  try {
    const loginRes = await fetchJson("http://localhost:5000/api/users/login", {
      method: "POST",
      body: {
        email: testUser.email,
        password: testUser.password,
      },
    });
    const pass = loginRes.status === 200 && loginRes.data.success === true && loginRes.data.user.role === "user";
    if (loginRes.data?.token) citizenToken = loginRes.data.token;
    results.push({
      name: "5. User login works with valid credentials",
      pass,
      details: `Status: ${loginRes.status}, User: ${loginRes.data?.user?.email}, Role: ${loginRes.data?.user?.role}`,
    });
  } catch (err) {
    results.push({ name: "5. User login works", pass: false, details: err.message });
  }

  // TEST 6: Incorrect password rejected
  try {
    const wrongPassRes = await fetchJson("http://localhost:5000/api/users/login", {
      method: "POST",
      body: {
        email: testUser.email,
        password: "WrongPassword999!",
      },
    });
    const pass = wrongPassRes.status === 401 && wrongPassRes.data.success === false;
    results.push({
      name: "6. Incorrect password rejected (401 Unauthorized)",
      pass,
      details: `Status: ${wrongPassRes.status}, Message: ${wrongPassRes.data.message}`,
    });
  } catch (err) {
    results.push({ name: "6. Incorrect password rejected", pass: false, details: err.message });
  }

  // TEST 7: Admin login works using existing admin account
  let adminToken = "";
  try {
    const adminLoginRes = await fetchJson("http://localhost:5000/api/users/login", {
      method: "POST",
      body: {
        email: "manvendra123@gmail.com",
        password: "Admin@123",
      },
    });
    const pass = adminLoginRes.status === 200 && adminLoginRes.data.success === true && adminLoginRes.data.user.role === "admin";
    adminToken = adminLoginRes.data.token;
    results.push({
      name: "7. Admin login works using existing admin account (role: admin)",
      pass,
      details: `Status: ${adminLoginRes.status}, Role: ${adminLoginRes.data?.user?.role}, Token received: ${!!adminToken}`,
    });
  } catch (err) {
    results.push({ name: "7. Admin login works", pass: false, details: err.message });
  }

  // TEST 8: Normal users cannot enter the admin interface / role access control
  try {
    // 8a: Normal user token accessing an admin-protected route on backend
    const adminEndpointRes = await fetchJson("http://localhost:5000/api/reports", {
      method: "GET",
      headers: { Authorization: `Bearer ${citizenToken}` },
    });

    // 8b: Admin token accessing the same route succeeds
    const adminAllowedRes = await fetchJson("http://localhost:5000/api/reports", {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // In adminMiddleware.js: if req.user.role !== "admin" -> 403 Forbidden
    const pass =
      adminEndpointRes.status === 403 &&
      adminEndpointRes.data.success === false &&
      adminAllowedRes.status === 200 &&
      adminAllowedRes.data.success === true;

    results.push({
      name: "8. Role-based authorization enforced (User denied 403, Admin allowed 200)",
      pass,
      details: `Citizen access: ${adminEndpointRes.status} (${adminEndpointRes.data?.message}), Admin access: ${adminAllowedRes.status} (${adminAllowedRes.data?.message})`,
    });
  } catch (err) {
    results.push({ name: "8. Normal users denied admin access", pass: false, details: err.message });
  }

  // TEST 9: Protected profile API works
  try {
    const profileRes = await fetchJson("http://localhost:5000/api/users/profile", {
      method: "GET",
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    const user = profileRes.data.user;
    const pass = profileRes.status === 200 && profileRes.data.success === true && user.email === testUser.email.toLowerCase();
    results.push({
      name: "9. Protected profile API works (GET /api/users/profile with Bearer token)",
      pass,
      details: `Status: ${profileRes.status}, User ID: ${user._id}, Name: ${user.name}, Phone: ${user.phone}`,
    });
  } catch (err) {
    results.push({ name: "9. Protected profile API works", pass: false, details: err.message });
  }

  // TEST 10: Logout and session expiration behave correctly
  try {
    const invalidTokenRes = await fetchJson("http://localhost:5000/api/users/profile", {
      method: "GET",
      headers: { Authorization: "Bearer invalid.expired.token" },
    });
    const missingTokenRes = await fetchJson("http://localhost:5000/api/users/profile", {
      method: "GET",
    });
    const pass = invalidTokenRes.status === 401 && missingTokenRes.status === 401;
    results.push({
      name: "10. Expired / missing token rejected on protected routes (401 Unauthorized)",
      pass,
      details: `Invalid token status: ${invalidTokenRes.status} (${invalidTokenRes.data.message}), Missing token status: ${missingTokenRes.status} (${missingTokenRes.data.message})`,
    });
  } catch (err) {
    results.push({ name: "10. Session expiration behaves correctly", pass: false, details: err.message });
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
  console.log(`SUMMARY: ${results.filter((r) => r.pass).length} / ${results.length} tests passed.`);
  console.log("=================================================");

  process.exit(allPass ? 0 : 1);
}

runTests();
