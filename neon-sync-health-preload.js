const crypto = require("crypto");

const enabled = Boolean(process.env.DATABASE_URL) && process.env.NEON_SYNC_ENABLED !== "false";

if (enabled) {
  const { Pool, Client } = require("pg");

  const healthPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  const BUSINESS_TABLES = [
    "users",
    "orders",
    "payments",
    "products_catalog",
    "partners",
    "support_tickets",
    "whatsapp_messages",
    "admin_tasks",
    "ai_actions",
    "journal_entries"
  ];

  const instanceId = String(
    process.env.RENDER_INSTANCE_ID ||
    process.env.HOSTNAME ||
    `node-${process.pid}-${crypto.randomBytes(4).toString("hex")}`
  ).slice(0, 200);

  const originalQuery = Client.prototype.query;
  const healthClients = new WeakSet();
  const mirroringClients = new WeakSet();

  function queryText(query) {
    if (typeof query === "string") return query;
    return String(query?.text || "");
  }

  async function remoteBusinessCount(client) {
    const expression = BUSINESS_TABLES.map(table => `(SELECT COUNT(*) FROM "${table}")`).join(" + ");
    const result = await originalQuery.call(client, `SELECT ${expression} AS count`);
    return Number(result.rows[0]?.count || 0);
  }

  async function recordStatus(status, mirrored = false) {
    let client;
    try {
      client = await healthPool.connect();
      healthClients.add(client);
      const count = await remoteBusinessCount(client);
      await originalQuery.call(client, `
        INSERT INTO durable_sync_status(
          id, instance_id, connected_at, last_mirrored_at,
          local_business_rows, remote_business_rows, status
        ) VALUES (
          1, $1, CURRENT_TIMESTAMP,
          CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE NULL END,
          $2, $2, $4
        )
        ON CONFLICT (id) DO UPDATE SET
          instance_id = EXCLUDED.instance_id,
          connected_at = CASE
            WHEN EXCLUDED.status = 'connected' THEN CURRENT_TIMESTAMP
            ELSE durable_sync_status.connected_at
          END,
          last_mirrored_at = CASE
            WHEN $3 THEN CURRENT_TIMESTAMP
            ELSE durable_sync_status.last_mirrored_at
          END,
          local_business_rows = EXCLUDED.local_business_rows,
          remote_business_rows = EXCLUDED.remote_business_rows,
          status = EXCLUDED.status
      `, [instanceId, count, mirrored, status]);
    } catch (error) {
      console.error("Neon sync health update failed", error.message);
    } finally {
      client?.release();
    }
  }

  Client.prototype.query = function monitoredQuery(query, ...args) {
    const text = queryText(query);
    const result = originalQuery.call(this, query, ...args);

    if (!healthClients.has(this)) {
      if (/^\s*DELETE\s+FROM\s+"?(users|orders|payments|products_catalog|partners|support_tickets|whatsapp_messages|admin_tasks|ai_actions|journal_entries)"?/i.test(text)) {
        mirroringClients.add(this);
      }

      if (mirroringClients.has(this) && /^\s*COMMIT\b/i.test(text)) {
        Promise.resolve(result).then(
          () => {
            mirroringClients.delete(this);
            recordStatus("mirrored", true);
          },
          () => {
            mirroringClients.delete(this);
            recordStatus("error", false);
          }
        );
      }

      if (mirroringClients.has(this) && /^\s*ROLLBACK\b/i.test(text)) {
        Promise.resolve(result).finally(() => {
          mirroringClients.delete(this);
          recordStatus("error", false);
        });
      }
    }

    return result;
  };

  setImmediate(() => recordStatus("connected", false));
  const readyTimer = setTimeout(() => recordStatus("ready", false), 3000);
  readyTimer.unref?.();

  healthPool.on("error", error => console.error("Neon sync health pool error", error.message));
}
