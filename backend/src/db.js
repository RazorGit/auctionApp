import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text, params) {
  const start = process.hrtime.bigint();
  try {
    const result = await pool.query(text, params);
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    const normalized = String(text).replace(/\s+/g, " ").trim();
    const preview = normalized.length > 140 ? `${normalized.slice(0, 140)}…` : normalized;
    const rowCount = typeof result?.rowCount === "number" ? result.rowCount : (result?.rows?.length ?? 0);

    // Avoid logging params by default (may include sensitive values).
    // Enable if you want it: LOG_DB_PARAMS=1
    const withParams = process.env.LOG_DB_PARAMS === "1" ? ` params=${JSON.stringify(params ?? [])}` : "";

    // eslint-disable-next-line no-console
    console.log(`[db] ${durationMs.toFixed(1)}ms rows=${rowCount} sql="${preview}"${withParams}`);
    return result;
  } catch (err) {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    const normalized = String(text).replace(/\s+/g, " ").trim();
    const preview = normalized.length > 140 ? `${normalized.slice(0, 140)}…` : normalized;
    // eslint-disable-next-line no-console
    console.error(`[db] ${durationMs.toFixed(1)}ms ERROR sql="${preview}"`, err);
    throw err;
  }
}

