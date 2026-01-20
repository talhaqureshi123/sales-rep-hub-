/**
 * API Smoke Test Script (Salesman + Admin)
 *
 * Usage:
 *   1) Start backend server (PORT default 4000)
 *   2) Run:
 *        node scripts/api-smoke-test.js
 *
 * CLI flags (recommended so you don't edit this file):
 *   --salesman-email="x" --salesman-password="y"
 *
 * Optional env vars:
 *   API_BASE_URL=http://localhost:4000
 *   SALESMAN_EMAIL=salesman@example.com
 *   SALESMAN_PASSWORD=salesman123
 */
/* eslint-disable no-console */
const axios = require("axios");
const config = require("../config");

function parseArgs(argv) {
  const out = {};
  for (const raw of argv || []) {
    if (!raw.startsWith("--")) continue;
    const s = raw.slice(2);
    const eq = s.indexOf("=");
    if (eq === -1) {
      out[s] = true;
    } else {
      const k = s.slice(0, eq);
      let v = s.slice(eq + 1);
      v = v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      out[k] = v;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const API_BASE_URL =
  args["api-base-url"] ||
  process.env.API_BASE_URL ||
  `http://localhost:${config.PORT || 4000}`;

// Salesman-only smoke test (as requested)
const SALESMAN_EMAIL =
  args["salesman-email"] ||
  process.env.SALESMAN_EMAIL ||
  "usman.abid00321@gmail.com";
const SALESMAN_PASSWORD =
  args["salesman-password"] || process.env.SALESMAN_PASSWORD || "salesman123";

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  validateStatus: () => true, // we handle status manually
});

function nowIso() {
  return new Date().toISOString();
}

function shortId(id) {
  if (!id) return "";
  const s = String(id);
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

async function http({
  name,
  method,
  url,
  token,
  data,
  params,
  okStatuses = [200],
  alsoOkStatuses = [],
}) {
  const started = Date.now();
  const res = await client.request({
    method,
    url,
    data,
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const ms = Date.now() - started;
  const allowed = new Set([...okStatuses, ...alsoOkStatuses]);
  const ok = allowed.has(res.status);

  const meta = `${res.status} ${method.toUpperCase()} ${url} (${ms}ms)`;
  if (!ok) {
    const msg =
      (res.data && (res.data.message || res.data.error)) ||
      (typeof res.data === "string" ? res.data : "");
    console.log(`❌ ${name}: ${meta}${msg ? ` — ${msg}` : ""}`);
    return { ok: false, res };
  }

  console.log(`✅ ${name}: ${meta}`);
  return { ok: true, res };
}

async function login({ email, password }) {
  const r = await http({
    name: `Login ${email}`,
    method: "post",
    url: "/api/auth/login",
    data: { email, password },
    okStatuses: [200],
  });
  if (!r.ok) return null;
  const token = r.res.data?.data?.token;
  const user = r.res.data?.data?.user;
  if (!token || !user) {
    console.log(`❌ Login payload missing token/user for ${email}`);
    return null;
  }
  return { token, user };
}

function pickFirst(arr) {
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

async function main() {
  console.log(`\n=== API Smoke Test @ ${nowIso()} ===`);
  console.log(`Base URL: ${API_BASE_URL}\n`);

  // 0) Health check
  const health = await http({
    name: "Health check",
    method: "get",
    url: "/api/health",
    okStatuses: [200],
  });
  if (!health.ok) {
    console.log(
      "\nServer reachable nahi hai. Pehle backend start karo: `cd backend` then `npm run dev` (ya `node server.js`)."
    );
    process.exitCode = 1;
    return;
  }

  // Non-interactive: credentials come from defaults/env/flags only
  const salesmanEmail = SALESMAN_EMAIL;
  const salesmanPassword = SALESMAN_PASSWORD;

  // 1) Login salesman (always)
  const salesman = await login({
    email: salesmanEmail,
    password: salesmanPassword,
  });

  if (!salesman) {
    console.log(
      "\nSalesman login fail. Check email/password and status 'Active'."
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Salesman: ${salesman.user.email} (${salesman.user.role}) id=${shortId(
      salesman.user.id
    )}\n`
  );

  // 2) Salesman - list customers
  await http({
    name: "Salesman customers (list)",
    method: "get",
    url: "/api/salesman/customers",
    token: salesman.token,
    okStatuses: [200],
  });

  // 3) Create customer via salesman
  const uniq = Date.now();
  const customerName = `SmokeTest-${uniq}`;
  const customerEmail = `smoketest.${uniq}@example.com`;

  const createCustomer = await http({
    name: "Salesman create customer",
    method: "post",
    url: "/api/salesman/customers",
    token: salesman.token,
    okStatuses: [201],
    data: {
      firstName: customerName,
      email: customerEmail,
      phone: `99999${String(uniq).slice(-5)}`,
      company: "SmokeTest Co",
      city: "TestCity",
      state: "TestState",
      address: "SmokeTest Address",
      postcode: "123456",
      notes: "Created by api-smoke-test.js",
      status: "Active",
    },
  });
  if (!createCustomer.ok) {
    process.exitCode = 1;
    return;
  }

  const createdCustomerId = createCustomer.res.data?.data?._id;
  console.log(`Created customerId=${shortId(createdCustomerId)}\n`);

  // 3b) Salesman customer (detail)
  if (createdCustomerId) {
    await http({
      name: "Salesman customer (detail)",
      method: "get",
      url: `/api/salesman/customers/${createdCustomerId}`,
      token: salesman.token,
      okStatuses: [200],
    });
  }

  // 4) Verify on salesman side (search)
  const salesmanSearch = await http({
    name: "Salesman customers (search created)",
    method: "get",
    url: "/api/salesman/customers",
    token: salesman.token,
    okStatuses: [200],
    params: { search: customerName },
  });

  const salesmanFound =
    salesmanSearch.ok &&
    Array.isArray(salesmanSearch.res.data?.data) &&
    salesmanSearch.res.data.data.some((c) => c._id === createdCustomerId);
  console.log(
    salesmanFound
      ? "✅ Salesman can see created customer\n"
      : "❌ Salesman cannot see created customer (unexpected)\n"
  );

  // Admin checks intentionally removed (salesman-only run)

  // 6) Salesman other GET endpoints (safe smoke)
  await http({
    name: "Salesman achievements",
    method: "get",
    url: "/api/salesman/achievements",
    token: salesman.token,
    okStatuses: [200],
  });

  await http({
    name: "Salesman products (list)",
    method: "get",
    url: "/api/salesman/products",
    token: salesman.token,
    okStatuses: [200],
  });

  // Products detail by id/code (if any)
  const productsList = await http({
    name: "Salesman products (list for detail pick)",
    method: "get",
    url: "/api/salesman/products",
    token: salesman.token,
    okStatuses: [200],
  });
  const firstProduct = pickFirst(productsList.res?.data?.data);
  if (firstProduct?._id) {
    await http({
      name: "Salesman product (detail)",
      method: "get",
      url: `/api/salesman/products/${firstProduct._id}`,
      token: salesman.token,
      okStatuses: [200],
    });
  }
  if (firstProduct?.productCode) {
    await http({
      name: "Salesman product (by code)",
      method: "get",
      url: `/api/salesman/products/code/${encodeURIComponent(
        firstProduct.productCode
      )}`,
      token: salesman.token,
      okStatuses: [200],
    });
  }

  await http({
    name: "Salesman dashboard",
    method: "get",
    url: "/api/salesman/dashboard",
    token: salesman.token,
    okStatuses: [200],
  });

  const visitTargets = await http({
    name: "Salesman visit-targets (list)",
    method: "get",
    url: "/api/salesman/visit-targets",
    token: salesman.token,
    okStatuses: [200],
  });
  const vt = pickFirst(visitTargets.res?.data?.data);
  if (vt?._id) {
    await http({
      name: "Salesman visit-target (detail)",
      method: "get",
      url: `/api/salesman/visit-targets/${vt._id}`,
      token: salesman.token,
      okStatuses: [200],
    });

    // Proximity check (requires latitude/longitude to be truthy)
    const lat = vt.latitude || vt.lat || 24.8607;
    const lng = vt.longitude || vt.lng || 67.0011;
    await http({
      name: "Salesman visit-target (check proximity)",
      method: "post",
      url: `/api/salesman/visit-targets/${vt._id}/check-proximity`,
      token: salesman.token,
      okStatuses: [200],
      data: { latitude: lat, longitude: lng },
      alsoOkStatuses: [400], // if target missing lat/lng etc.
    });

    // Update status (non-destructive-ish fields)
    await http({
      name: "Salesman visit-target (update status)",
      method: "put",
      url: `/api/salesman/visit-targets/${vt._id}`,
      token: salesman.token,
      okStatuses: [200],
      data: {
        status: "In Progress",
        notes: "Smoke test update",
        startingKilometers: 1000,
        endingKilometers: 1001,
        estimatedKilometers: 1,
      },
      alsoOkStatuses: [400],
    });
  }

  // Quotations: list + create + get + update + delete (requires a product)
  await http({
    name: "Salesman quotations (list)",
    method: "get",
    url: "/api/salesman/quotations",
    token: salesman.token,
    okStatuses: [200],
  });

  if (firstProduct?._id) {
    const createQ = await http({
      name: "Salesman quotation (create)",
      method: "post",
      url: "/api/salesman/quotations",
      token: salesman.token,
      okStatuses: [201],
      data: {
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: `99999${String(uniq).slice(-5)}`,
        customerAddress: "SmokeTest Address",
        items: [{ productId: firstProduct._id, quantity: 1 }],
        tax: 0,
        discount: 0,
        notes: "Created by api-smoke-test.js",
      },
      alsoOkStatuses: [400],
    });

    const createdQId = createQ.res?.data?.data?._id;
    if (createQ.ok && createdQId) {
      await http({
        name: "Salesman quotation (detail)",
        method: "get",
        url: `/api/salesman/quotations/${createdQId}`,
        token: salesman.token,
        okStatuses: [200],
      });

      await http({
        name: "Salesman quotation (update)",
        method: "put",
        url: `/api/salesman/quotations/${createdQId}`,
        token: salesman.token,
        okStatuses: [200],
        data: {
          notes: "Updated by api-smoke-test.js",
          items: [{ productId: firstProduct._id, quantity: 1 }],
        },
      });

      await http({
        name: "Salesman quotation (delete)",
        method: "delete",
        url: `/api/salesman/quotations/${createdQId}`,
        token: salesman.token,
        okStatuses: [200],
      });
    }
  } else {
    console.log(
      "ℹ️ Quotation create/update/delete skipped (no products found)\n"
    );
  }

  // Samples: list + create + get + update
  await http({
    name: "Salesman samples (list)",
    method: "get",
    url: "/api/salesman/samples",
    token: salesman.token,
    okStatuses: [200],
  });

  const createSample = await http({
    name: "Salesman sample (create)",
    method: "post",
    url: "/api/salesman/samples",
    token: salesman.token,
    okStatuses: [201],
    data: {
      customerName: customerName,
      customerEmail: customerEmail,
      customerPhone: `99999${String(uniq).slice(-5)}`,
      productName: firstProduct?.name || "Sample Product",
      productCode: firstProduct?.productCode || undefined,
      quantity: 1,
      notes: "Created by api-smoke-test.js",
    },
    alsoOkStatuses: [400],
  });

  const createdSampleId = createSample.res?.data?.data?._id;
  if (createSample.ok && createdSampleId) {
    await http({
      name: "Salesman sample (detail)",
      method: "get",
      url: `/api/salesman/samples/${createdSampleId}`,
      token: salesman.token,
      okStatuses: [200],
    });

    await http({
      name: "Salesman sample (update)",
      method: "put",
      url: `/api/salesman/samples/${createdSampleId}`,
      token: salesman.token,
      okStatuses: [200],
      data: { notes: "Updated by api-smoke-test.js" },
    });
  }

  // Location: POST + GET + latest
  await http({
    name: "Salesman location (save)",
    method: "post",
    url: "/api/salesman/location",
    token: salesman.token,
    okStatuses: [201],
    data: { latitude: 24.8607, longitude: 67.0011, accuracy: 10 },
    alsoOkStatuses: [400],
  });

  await http({
    name: "Salesman tracking (list)",
    method: "get",
    url: "/api/salesman/tracking",
    token: salesman.token,
    okStatuses: [200],
  });
  const activeBefore = await http({
    name: "Salesman tracking (active) (404 ok if none)",
    method: "get",
    url: "/api/salesman/tracking/active",
    token: salesman.token,
    okStatuses: [200],
    alsoOkStatuses: [404],
  });

  // If already active, stop it first so start doesn't return 400
  const activeBeforeId = activeBefore.res?.data?.data?._id;
  if (activeBefore.ok && activeBeforeId) {
    await http({
      name: "Salesman tracking (stop existing active before start)",
      method: "put",
      url: `/api/salesman/tracking/stop/${activeBeforeId}`,
      token: salesman.token,
      okStatuses: [200],
      data: { endingKilometers: 1001 },
      alsoOkStatuses: [400],
    });
  }

  // Tracking: start + stop
  const startTracking = await http({
    name: "Salesman tracking (start)",
    method: "post",
    url: "/api/salesman/tracking/start",
    token: salesman.token,
    okStatuses: [201],
    data: {
      startingKilometers: 1000,
      speedometerImage: "data:image/png;base64,AAAA",
      latitude: 24.8607,
      longitude: 67.0011,
    },
    alsoOkStatuses: [400], // keep for safety if server has other constraints
  });

  // Get active again and stop if we have an id
  const activeAfterStart = await http({
    name: "Salesman tracking (active after start)",
    method: "get",
    url: "/api/salesman/tracking/active",
    token: salesman.token,
    okStatuses: [200],
    alsoOkStatuses: [404],
  });
  const activeId = activeAfterStart.res?.data?.data?._id;
  if (activeAfterStart.ok && activeId) {
    await http({
      name: "Salesman tracking (stop)",
      method: "put",
      url: `/api/salesman/tracking/stop/${activeId}`,
      token: salesman.token,
      okStatuses: [200],
      data: { endingKilometers: 1001 },
      alsoOkStatuses: [400],
    });
  } else if (startTracking.ok && startTracking.res?.data?.data?._id) {
    // fallback: stop using start response id
    const startedId = startTracking.res.data.data._id;
    await http({
      name: "Salesman tracking (stop - fallback)",
      method: "put",
      url: `/api/salesman/tracking/stop/${startedId}`,
      token: salesman.token,
      okStatuses: [200],
      data: { endingKilometers: 1001 },
      alsoOkStatuses: [400],
    });
  }

  await http({
    name: "Salesman location history (limit=1)",
    method: "get",
    url: "/api/salesman/location",
    token: salesman.token,
    okStatuses: [200],
    params: { limit: 1 },
  });
  await http({
    name: "Salesman location latest (404 ok if none)",
    method: "get",
    url: "/api/salesman/location/latest",
    token: salesman.token,
    okStatuses: [200],
    alsoOkStatuses: [404],
  });

  console.log("=== Done ===\n");
}

main().catch((err) => {
  console.error("❌ Script crashed:", err);
  process.exitCode = 1;
});
