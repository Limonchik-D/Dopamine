const baseUrl = process.argv[2];
const authToken = process.argv[3] || "";

if (!baseUrl) {
  console.error("Usage: node ./scripts/smoke.mjs <baseUrl>");
  process.exit(1);
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}:`, error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

async function expectStatus(path, expectedStatuses, init) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, init);
  if (!expectedStatuses.includes(response.status)) {
    const body = await response.text();
    throw new Error(`Expected ${expectedStatuses.join("/")}, got ${response.status}. Body: ${body}`);
  }
  return response;
}

await check("health endpoint", async () => {
  const response = await expectStatus("/health", [200]);
  const json = await response.json();
  if (json.status !== "ok") {
    throw new Error("Health response status is not 'ok'");
  }
});

await check("dependencies health endpoint", async () => {
  const response = await expectStatus("/health/dependencies", [200]);
  const json = await response.json();
  if (!json.ready || json.dependencies?.db !== true || json.dependencies?.kv !== true) {
    throw new Error("Dependencies health is not ready");
  }
});

await check("spa root endpoint", async () => {
  await expectStatus("/", [200]);
});

await check("auth validation endpoint", async () => {
  await expectStatus("/api/auth/login", [400], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
});

if (authToken) {
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  };

  await check("authorized profile endpoint", async () => {
    await expectStatus("/api/me", [200], {
      method: "GET",
      headers: authHeaders,
    });
  });

  await check("authorized checkins endpoint", async () => {
    await expectStatus("/api/checkins", [200], {
      method: "GET",
      headers: authHeaders,
    });
  });

  await check("authorized stats endpoint", async () => {
    await expectStatus("/api/stats/week", [200], {
      method: "GET",
      headers: authHeaders,
    });
  });

  await check("admin diagnostics endpoint (role dependent)", async () => {
    await expectStatus("/api/admin/diagnostics", [200, 403], {
      method: "GET",
      headers: authHeaders,
    });
  });
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}

console.log("Smoke checks passed.");
