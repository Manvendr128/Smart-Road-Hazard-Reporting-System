/**
 * End-to-End Test Runner for Phase 1
 * Starts Backend on :5000, Frontend on :3000, runs test_phase1.js, then shuts down.
 */

const { spawn } = require("child_process");
const http = require("http");

function checkPort(port, path = "/") {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}${path}`, (res) => {
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port, name, maxRetries = 15) {
  for (let i = 0; i < maxRetries; i++) {
    if (await checkPort(port)) {
      console.log(`[OK] ${name} is ready on port ${port}.`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`${name} failed to start on port ${port} in time.`);
}

async function main() {
  console.log("Starting Backend server on port 5000...");
  const backendProc = spawn("node", ["server.js"], {
    cwd: "./Backend",
    stdio: "inherit",
    shell: true,
  });

  console.log("Starting Frontend server on port 3000...");
  const frontendProc = spawn("node", ["server.js"], {
    cwd: "./frontend",
    stdio: "inherit",
    shell: true,
  });

  function cleanup() {
    console.log("\nShutting down test servers...");
    try {
      backendProc.kill();
    } catch (e) {}
    try {
      frontendProc.kill();
    } catch (e) {}
  }

  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    await waitForServer(5000, "Backend API");
    await waitForServer(3000, "Frontend Static Server");

    console.log("\nRunning Phase 1 Verification Test Suite...\n");
    const test1Proc = spawn("node", ["test_phase1.js"], {
      stdio: "inherit",
      shell: true,
    });

    test1Proc.on("close", (code1) => {
      if (code1 !== 0) {
        console.error("Phase 1 tests failed.");
        cleanup();
        process.exit(code1);
      }

      console.log("\nRunning Phase 2 Verification Test Suite...\n");
      const test2Proc = spawn("node", ["test_phase2.js"], {
        stdio: "inherit",
        shell: true,
      });

      test2Proc.on("close", (code2) => {
        if (code2 !== 0) {
          console.error("Phase 2 tests failed.");
          cleanup();
          process.exit(code2);
        }

        console.log("\nRunning Phase 3 Verification Test Suite...\n");
        const test3Proc = spawn("node", ["test_phase3.js"], {
          stdio: "inherit",
          shell: true,
        });

        test3Proc.on("close", (code3) => {
          if (code3 !== 0) {
            console.error("Phase 3 tests failed.");
            cleanup();
            process.exit(code3);
          }

          console.log("\nRunning Security & Validation Test Suite...\n");
          const secProc = spawn("node", ["test_security.js"], {
            stdio: "inherit",
            shell: true,
          });

          secProc.on("close", (codeSec) => {
            cleanup();
            process.exit(codeSec);
          });
        });
      });
    });
  } catch (err) {
    console.error("Test runner failed:", err.message);
    cleanup();
    process.exit(1);
  }
}

main();
