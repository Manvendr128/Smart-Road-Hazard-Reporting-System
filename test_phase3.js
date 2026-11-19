/**
 * Phase 3 Comprehensive Automated Verification Suite
 * Tests all 12 required verification items for Admin Dashboard & Report Management
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

const sampleImageBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

async function runPhase3Tests() {
  console.log("=================================================");
  console.log("SMART ROAD HAZARD REPORTING SYSTEM - PHASE 3 TESTS");
  console.log("=================================================\n");

  const results = [];
  const timestamp = Date.now();

  let adminToken = "";
  let citizenToken = "";
  let report1 = null;
  let report2 = null;

  // Setup: Register citizen & submit 2 fresh reports
  try {
    const citizenUser = {
      name: "Phase3 Citizen",
      email: `citizen_p3_${timestamp}@test.com`,
      phone: "9876543210",
      password: "Password123!",
    };

    const regCitizen = await fetchJson("http://localhost:5000/api/users/register", {
      method: "POST",
      body: citizenUser,
    });
    citizenToken = regCitizen.data?.token;

    // Report 1: for Verify -> In Progress -> Resolved
    const mp1 = buildMultipartFormData(
      {
        category: "Pothole",
        severity: "High",
        address: "Grand Trunk Road, Sector 5",
        landmark: "Near Metro Station",
        description: "Hazard report 1 for full lifecycle testing",
      },
      {
        name: "image",
        filename: "hazard1.png",
        contentType: "image/png",
        buffer: sampleImageBuffer,
      }
    );

    const r1Res = await fetchJson("http://localhost:5000/api/reports", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${citizenToken}`,
        "Content-Type": mp1.contentType,
      },
      body: mp1.buffer,
    });
    report1 = r1Res.data?.report;

    // Report 2: for Rejection testing
    const mp2 = buildMultipartFormData(
      {
        category: "Damaged Road",
        severity: "Medium",
        address: "Park Avenue Road",
        landmark: "Near Public Garden",
        description: "Hazard report 2 for rejection testing",
      },
      {
        name: "image",
        filename: "hazard2.png",
        contentType: "image/png",
        buffer: sampleImageBuffer,
      }
    );

    const r2Res = await fetchJson("http://localhost:5000/api/reports", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${citizenToken}`,
        "Content-Type": mp2.contentType,
      },
      body: mp2.buffer,
    });
    report2 = r2Res.data?.report;
  } catch (err) {
    console.error("Setup error:", err.message);
  }

  // 1. Login as an existing admin
  try {
    const adminLoginRes = await fetchJson("http://localhost:5000/api/users/login", {
      method: "POST",
      body: {
        email: "manvendra123@gmail.com",
        password: "Admin@123",
      },
    });

    const pass = adminLoginRes.status === 200 && adminLoginRes.data?.user?.role === "admin";
    adminToken = adminLoginRes.data?.token;
    results.push({
      name: "1. Login as existing admin (role: admin)",
      pass,
      details: `Status: ${adminLoginRes.status}, User: ${adminLoginRes.data?.user?.email}, Role: ${adminLoginRes.data?.user?.role}`,
    });
  } catch (err) {
    results.push({ name: "1. Login as existing admin", pass: false, details: err.message });
  }

  // 2. Open Admin Dashboard
  try {
    const adminPage = await fetchHtml("http://localhost:3000/admin.html");
    const pass = adminPage.status === 200 && adminPage.body.includes("Admin Dashboard");
    results.push({
      name: "2. Open Admin Dashboard (HTTP 200)",
      pass,
      details: `Status: ${adminPage.status}, Contains Admin Dashboard title: ${pass}`,
    });
  } catch (err) {
    results.push({ name: "2. Open Admin Dashboard", pass: false, details: err.message });
  }

  // 3. Fetch all user reports via GET /api/reports
  try {
    const allReportsRes = await fetchJson("http://localhost:5000/api/reports", {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const reports = allReportsRes.data?.reports || [];
    const hasR1 = reports.some((r) => r._id === report1?._id);
    const hasR2 = reports.some((r) => r._id === report2?._id);
    const sampleRep = reports.find((r) => r._id === report1?._id);
    const hasReporter = sampleRep && sampleRep.userId && sampleRep.userId.name && sampleRep.userId.email;

    const pass = allReportsRes.status === 200 && hasR1 && hasR2 && !!hasReporter;
    results.push({
      name: "3. Fetch all user reports (GET /api/reports with populated userId)",
      pass,
      details: `Status: ${allReportsRes.status}, Count: ${reports.length}, Contains new reports: ${hasR1 && hasR2}, Reporter: "${sampleRep?.userId?.name}" (${sampleRep?.userId?.email})`,
    });
  } catch (err) {
    results.push({ name: "3. Fetch all user reports", pass: false, details: err.message });
  }

  // 4. Open a Pending report details via GET /api/reports/:id
  try {
    const r1Details = await fetchJson(`http://localhost:5000/api/reports/${report1?._id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const rep = r1Details.data?.report;
    const pass = r1Details.status === 200 && rep && rep.status === "Pending";
    results.push({
      name: "4. Open Pending report details (GET /api/reports/:id)",
      pass,
      details: `Status: ${r1Details.status}, Report ID: ${rep?.reportId}, Current status: ${rep?.status}`,
    });
  } catch (err) {
    results.push({ name: "4. Open Pending report details", pass: false, details: err.message });
  }

  // 5. Verify the report (PATCH /api/reports/:id/status -> Verified)
  try {
    const verifyRes = await fetchJson(`http://localhost:5000/api/reports/${report1?._id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: "Verified",
        remark: "Hazard verified by administrator",
      },
    });

    const rep = verifyRes.data?.report;
    const pass = verifyRes.status === 200 && rep && rep.status === "Verified";
    results.push({
      name: "5. Verify report (Pending -> Verified transition)",
      pass,
      details: `Status: ${verifyRes.status}, Message: "${verifyRes.data?.message}", New status: ${rep?.status}`,
    });
  } catch (err) {
    results.push({ name: "5. Verify report", pass: false, details: err.message });
  }

  // 6. Mark the report In Progress (Verified -> In Progress)
  try {
    const progressRes = await fetchJson(`http://localhost:5000/api/reports/${report1?._id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: "In Progress",
        remark: "Road repair work has started",
      },
    });

    const rep = progressRes.data?.report;
    const pass = progressRes.status === 200 && rep && rep.status === "In Progress";
    results.push({
      name: "6. Mark report In Progress (Verified -> In Progress transition)",
      pass,
      details: `Status: ${progressRes.status}, New status: ${rep?.status}`,
    });
  } catch (err) {
    results.push({ name: "6. Mark report In Progress", pass: false, details: err.message });
  }

  // 7. Mark the report Resolved (In Progress -> Resolved)
  try {
    const resolvedRes = await fetchJson(`http://localhost:5000/api/reports/${report1?._id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: "Resolved",
        remark: "Road hazard has been resolved",
      },
    });

    const rep = resolvedRes.data?.report;
    const pass = resolvedRes.status === 200 && rep && rep.status === "Resolved";
    results.push({
      name: "7. Mark report Resolved (In Progress -> Resolved transition)",
      pass,
      details: `Status: ${resolvedRes.status}, New status: ${rep?.status}`,
    });
  } catch (err) {
    results.push({ name: "7. Mark report Resolved", pass: false, details: err.message });
  }

  // 8. Confirm status history is updated with all steps
  try {
    const histCheck = await fetchJson(`http://localhost:5000/api/reports/${report1?._id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const history = histCheck.data?.report?.statusHistory || [];
    const statusesInHistory = history.map((h) => h.status);
    const pass =
      histCheck.status === 200 &&
      history.length === 4 &&
      statusesInHistory[0] === "Pending" &&
      statusesInHistory[1] === "Verified" &&
      statusesInHistory[2] === "In Progress" &&
      statusesInHistory[3] === "Resolved";

    results.push({
      name: "8. Confirm status history is updated chronologically",
      pass,
      details: `History entries (${history.length}): ${statusesInHistory.join(" -> ")}`,
    });
  } catch (err) {
    results.push({ name: "8. Confirm status history is updated", pass: false, details: err.message });
  }

  // 9. Separate Pending report rejection (Pending -> Rejected)
  try {
    const rejectRes = await fetchJson(`http://localhost:5000/api/reports/${report2?._id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: "Rejected",
        remark: "Report rejected after review",
      },
    });

    const rep = rejectRes.data?.report;
    const pass = rejectRes.status === 200 && rep && rep.status === "Rejected";
    results.push({
      name: "9. Reject separate Pending report (Pending -> Rejected)",
      pass,
      details: `Status: ${rejectRes.status}, New status: ${rep?.status}, Remark: "${rep?.adminRemarks}"`,
    });
  } catch (err) {
    results.push({ name: "9. Reject report", pass: false, details: err.message });
  }

  // 10. Test invalid status transitions
  try {
    // Attempt 1: Transition from terminal Resolved -> In Progress
    const invalidTrans1 = await fetchJson(`http://localhost:5000/api/reports/${report1?._id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: "In Progress" },
    });

    // Attempt 2: Transition from terminal Rejected -> Verified
    const invalidTrans2 = await fetchJson(`http://localhost:5000/api/reports/${report2?._id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: "Verified" },
    });

    const pass =
      invalidTrans1.status === 400 &&
      invalidTrans1.data?.message?.includes("Cannot change status") &&
      invalidTrans2.status === 400 &&
      invalidTrans2.data?.message?.includes("Cannot change status");

    results.push({
      name: "10. Invalid status transitions rejected (400 Bad Request)",
      pass,
      details: `Resolved->InProgress: ${invalidTrans1.status} ("${invalidTrans1.data?.message}"), Rejected->Verified: ${invalidTrans2.status} ("${invalidTrans2.data?.message}")`,
    });
  } catch (err) {
    results.push({ name: "10. Test invalid status transitions", pass: false, details: err.message });
  }

  // 11. Test unauthorized admin access using public-user JWT
  try {
    // Citizen attempts GET /api/reports (all reports)
    const citizenGetAll = await fetchJson("http://localhost:5000/api/reports", {
      method: "GET",
      headers: { Authorization: `Bearer ${citizenToken}` },
    });

    // Citizen attempts PATCH /api/reports/:id/status
    const citizenPatchStatus = await fetchJson(`http://localhost:5000/api/reports/${report1?._id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: { status: "Verified" },
    });

    const pass = citizenGetAll.status === 403 && citizenPatchStatus.status === 403;
    results.push({
      name: "11. Unauthorized admin access blocked for public users (403 Forbidden)",
      pass,
      details: `GET /api/reports: ${citizenGetAll.status} ("${citizenGetAll.data?.message}"), PATCH /api/reports/:id/status: ${citizenPatchStatus.status} ("${citizenPatchStatus.data?.message}")`,
    });
  } catch (err) {
    results.push({ name: "11. Test unauthorized admin access", pass: false, details: err.message });
  }

  // 12. Confirm updated statuses appear in public user's My Reports page
  try {
    const citizenMyReports = await fetchJson("http://localhost:5000/api/reports/my-reports", {
      method: "GET",
      headers: { Authorization: `Bearer ${citizenToken}` },
    });

    const reports = citizenMyReports.data?.reports || [];
    const rep1InList = reports.find((r) => r._id === report1?._id);
    const rep2InList = reports.find((r) => r._id === report2?._id);

    const pass =
      citizenMyReports.status === 200 &&
      rep1InList &&
      rep1InList.status === "Resolved" &&
      rep2InList &&
      rep2InList.status === "Rejected";

    results.push({
      name: "12. Updated statuses reflected in public user's My Reports",
      pass,
      details: `Report 1 Status: ${rep1InList?.status}, Report 2 Status: ${rep2InList?.status}`,
    });
  } catch (err) {
    results.push({ name: "12. Confirm updated statuses in My Reports", pass: false, details: err.message });
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

runPhase3Tests();
