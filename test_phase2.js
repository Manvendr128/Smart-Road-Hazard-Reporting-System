/**
 * Phase 2 Comprehensive Automated Verification Suite
 * Tests all 13 required verification items
 */

const http = require("http");

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

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    }).on("error", reject);
  });
}

function buildMultipartFormData(fields, fileField) {
  const boundary = "----NodeFormBoundary" + Math.random().toString(36).substring(2);
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

// 1x1 test PNG image buffer
const sampleImageBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

async function runPhase2Tests() {
  console.log("=================================================");
  console.log("SMART ROAD HAZARD REPORTING SYSTEM - PHASE 2 TESTS");
  console.log("=================================================\n");

  const results = [];
  const timestamp = Date.now();

  // Test User A
  const userA = {
    name: "Citizen Alpha",
    email: `citizen_a_${timestamp}@test.com`,
    phone: "9876543210",
    password: "Password123!",
  };

  // Test User B
  const userB = {
    name: "Citizen Beta",
    email: `citizen_b_${timestamp}@test.com`,
    phone: "9876543211",
    password: "Password123!",
  };

  let tokenA = "";
  let tokenB = "";
  let submittedReport = null;

  // 1. Register & Login as public user A
  try {
    const regRes = await fetchJson("http://localhost:5000/api/users/register", {
      method: "POST",
      body: userA,
    });
    tokenA = regRes.data?.token;
    const loginRes = await fetchJson("http://localhost:5000/api/users/login", {
      method: "POST",
      body: { email: userA.email, password: userA.password },
    });
    const pass = loginRes.status === 200 && loginRes.data?.user?.role === "user" && !!tokenA;
    results.push({
      name: "1. Login as public user (User A authenticated)",
      pass,
      details: `Status: ${loginRes.status}, User: ${loginRes.data?.user?.email}, Role: ${loginRes.data?.user?.role}`,
    });
  } catch (err) {
    results.push({ name: "1. Login as public user", pass: false, details: err.message });
  }

  // 2. Open User Dashboard & Frontend Pages
  try {
    const featuresPage = await fetchHtml("http://localhost:3000/features.html");
    const reportPage = await fetchHtml("http://localhost:3000/report.html");
    const myReportsPage = await fetchHtml("http://localhost:3000/my-reports.html");
    const reportDetailsPage = await fetchHtml("http://localhost:3000/report-details.html");
    const pass =
      featuresPage.status === 200 &&
      reportPage.status === 200 &&
      myReportsPage.status === 200 &&
      reportDetailsPage.status === 200;
    results.push({
      name: "2. Open User Dashboard & Hazard pages (features, report, my-reports, report-details)",
      pass,
      details: `features=${featuresPage.status}, report=${reportPage.status}, my-reports=${myReportsPage.status}, report-details=${reportDetailsPage.status}`,
    });
  } catch (err) {
    results.push({ name: "2. Open User Dashboard", pass: false, details: err.message });
  }

  // 3. Submit Pothole report with an image via multipart/form-data
  try {
    const reportPayload = {
      category: "Pothole",
      severity: "High",
      address: "Station Road near Central Flyover",
      landmark: "Opposite Pillar 42",
      description: "Severe pothole approximately 15cm deep causing severe damage to two-wheelers and braking hazard.",
    };

    const multipart = buildMultipartFormData(reportPayload, {
      name: "image",
      filename: "pothole_defect.png",
      contentType: "image/png",
      buffer: sampleImageBuffer,
    });

    const createRes = await fetchJson("http://localhost:5000/api/reports", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": multipart.contentType,
      },
      body: multipart.buffer,
    });

    submittedReport = createRes.data?.report;
    const pass = createRes.status === 201 && createRes.data?.success === true && !!submittedReport;
    results.push({
      name: "3. Submit Pothole report with photograph (multipart/form-data)",
      pass,
      details: `Status: ${createRes.status}, Message: ${createRes.data?.message}, Report ID: ${submittedReport?.reportId}`,
    });
  } catch (err) {
    results.push({ name: "3. Submit Pothole report with photograph", pass: false, details: err.message });
  }

  // 4. Verify successful API response
  try {
    const pass =
      !!submittedReport &&
      submittedReport.category === "Pothole" &&
      submittedReport.severity === "High" &&
      submittedReport.address === "Station Road near Central Flyover";
    results.push({
      name: "4. Verify successful API response structure and fields",
      pass,
      details: `Report ID: ${submittedReport?.reportId}, Category: ${submittedReport?.category}, Severity: ${submittedReport?.severity}`,
    });
  } catch (err) {
    results.push({ name: "4. Verify successful API response", pass: false, details: err.message });
  }

  // 5. Verify image is stored in Cloudinary
  try {
    const imageUrl = submittedReport?.imageUrl || "";
    const isCloudinary = imageUrl.includes("cloudinary.com") && imageUrl.startsWith("https://");
    results.push({
      name: "5. Verify image is stored in Cloudinary",
      pass: isCloudinary,
      details: `Cloudinary Image URL: ${imageUrl}`,
    });
  } catch (err) {
    results.push({ name: "5. Verify image stored in Cloudinary", pass: false, details: err.message });
  }

  // 6. Verify report data is stored in MongoDB
  try {
    const mongoId = submittedReport?._id;
    const isMongoId = typeof mongoId === "string" && mongoId.length === 24;
    results.push({
      name: "6. Verify report data is stored in MongoDB",
      pass: isMongoId,
      details: `MongoDB _id: ${mongoId}, reportId: ${submittedReport?.reportId}`,
    });
  } catch (err) {
    results.push({ name: "6. Verify report data stored in MongoDB", pass: false, details: err.message });
  }

  // 7 & 8. Open My Reports and confirm new report appears
  try {
    const myReportsRes = await fetchJson("http://localhost:5000/api/reports/my-reports", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const reportsList = myReportsRes.data?.reports || [];
    const foundReport = reportsList.find((r) => r.reportId === submittedReport?.reportId);
    const pass = myReportsRes.status === 200 && !!foundReport;

    results.push({
      name: "7 & 8. Open My Reports (GET /api/reports/my-reports) & confirm new report appears",
      pass,
      details: `Status: ${myReportsRes.status}, Total user reports: ${reportsList.length}, Found Report ID: ${foundReport?.reportId}`,
    });
  } catch (err) {
    results.push({ name: "7 & 8. Open My Reports & confirm new report appears", pass: false, details: err.message });
  }

  // 9 & 10. Open report details by MongoDB _id and confirm status is Pending
  try {
    const detailRes = await fetchJson(`http://localhost:5000/api/reports/${submittedReport?._id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const rep = detailRes.data?.report;
    const pass =
      detailRes.status === 200 &&
      rep &&
      rep.status === "Pending" &&
      Array.isArray(rep.statusHistory) &&
      rep.statusHistory.length > 0 &&
      rep.statusHistory[0].status === "Pending";

    results.push({
      name: "9 & 10. Open report details (GET /api/reports/:id) & confirm status is Pending with statusHistory",
      pass,
      details: `Status: ${rep?.status}, History Count: ${rep?.statusHistory?.length}, Initial Remark: "${rep?.statusHistory[0]?.remark}"`,
    });
  } catch (err) {
    results.push({ name: "9 & 10. Open report details & confirm status is Pending", pass: false, details: err.message });
  }

  // 11. Test missing-image validation
  try {
    const missingImgPayload = {
      category: "Pothole",
      severity: "Medium",
      address: "Main Avenue",
      description: "Pothole without photo",
    };

    const multipartNoImg = buildMultipartFormData(missingImgPayload, null);

    const noImgRes = await fetchJson("http://localhost:5000/api/reports", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": multipartNoImg.contentType,
      },
      body: multipartNoImg.buffer,
    });

    const pass = noImgRes.status === 400 && noImgRes.data?.message === "Please upload a hazard image";
    results.push({
      name: "11. Test missing-image validation (rejected with 400 Bad Request)",
      pass,
      details: `Status: ${noImgRes.status}, Message: "${noImgRes.data?.message}"`,
    });
  } catch (err) {
    results.push({ name: "11. Test missing-image validation", pass: false, details: err.message });
  }

  // 12. Test unauthorized report access (missing / invalid token)
  try {
    const unauthRes = await fetchJson(`http://localhost:5000/api/reports/${submittedReport?._id}`, {
      method: "GET",
    });

    const invalidTokenRes = await fetchJson(`http://localhost:5000/api/reports/${submittedReport?._id}`, {
      method: "GET",
      headers: { Authorization: "Bearer bad.token.here" },
    });

    const pass = unauthRes.status === 401 && invalidTokenRes.status === 401;
    results.push({
      name: "12. Test unauthorized report access (rejected with 401 Unauthorized)",
      pass,
      details: `Missing token: ${unauthRes.status} (${unauthRes.data?.message}), Invalid token: ${invalidTokenRes.status} (${invalidTokenRes.data?.message})`,
    });
  } catch (err) {
    results.push({ name: "12. Test unauthorized report access", pass: false, details: err.message });
  }

  // 13. Test a second user to verify report isolation
  try {
    // Register User B
    const regB = await fetchJson("http://localhost:5000/api/users/register", {
      method: "POST",
      body: userB,
    });
    tokenB = regB.data?.token;

    // User B checks my-reports -> User A's report should NOT be present
    const myReportsB = await fetchJson("http://localhost:5000/api/reports/my-reports", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const bHasReport = (myReportsB.data?.reports || []).some((r) => r.reportId === submittedReport?.reportId);

    // User B directly tries to access User A's report by MongoDB _id -> 403 Forbidden!
    const directAccessB = await fetchJson(`http://localhost:5000/api/reports/${submittedReport?._id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    const pass = !bHasReport && directAccessB.status === 403;
    results.push({
      name: "13. Test second user for report isolation (User B isolated & denied User A's report with 403)",
      pass,
      details: `User B my-reports contains User A report: ${bHasReport}, Direct GET /api/reports/:id: ${directAccessB.status} (${directAccessB.data?.message})`,
    });
  } catch (err) {
    results.push({ name: "13. Test second user for report isolation", pass: false, details: err.message });
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

runPhase2Tests();
