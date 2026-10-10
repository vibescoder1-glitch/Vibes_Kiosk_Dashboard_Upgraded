import pg, { type Pool as PgPool, type PoolClient } from "pg";
import dotenv from "dotenv";

// Next.js normally loads .env.local for the application runtime.
// This explicit load is important for standalone Node scripts/server startup
// paths that may import this module before Next.js has populated process.env.
// Existing environment variables (for example Render's DATABASE_URL) are kept.
dotenv.config({ path: ".env.local", override: false });
dotenv.config({ path: ".env", override: false });

const { Pool } = pg;

type SqlValue = unknown;

export type DatabaseRunResult = {
  meta: {
    changes: number;
    last_row_id: number;
  };
};

// The rest of the codebase writes queries with MySQL-style `?` placeholders.
// Postgres uses positional `$1, $2, ...` placeholders instead, so every query
// is rewritten once here rather than touching every call site.
function toPositionalQuery(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

class PgStatement {
  readonly sql: string;
  readonly values: SqlValue[];

  constructor(sql: string, values: SqlValue[] = []) {
    this.sql = sql;
    this.values = values;
  }

  bind(...values: SqlValue[]) {
    return new PgStatement(this.sql, values);
  }

  async all<T extends Record<string, unknown> = Record<string, unknown>>(
    client?: PoolClient,
  ) {
    const runner = client ?? getPool();
    const result = await runner.query(
      toPositionalQuery(this.sql),
      this.values,
    );
    return { results: result.rows as T[] };
  }

  async first<T extends Record<string, unknown> = Record<string, unknown>>(
    client?: PoolClient,
  ) {
    const runner = client ?? getPool();
    const result = await runner.query(
      toPositionalQuery(this.sql),
      this.values,
    );
    return (result.rows[0] as T | undefined) ?? null;
  }

  async run(client?: PoolClient): Promise<DatabaseRunResult> {
    const runner = client ?? getPool();
    const result = await runner.query(
      toPositionalQuery(this.sql),
      this.values,
    );

    return {
      meta: {
        changes: result.rowCount ?? 0,
        last_row_id: 0,
      },
    };
  }

  async runWithConnection(connection: PoolClient): Promise<DatabaseRunResult> {
    return this.run(connection);
  }
}

class PgDatabase {
  prepare(sql: string) {
    return new PgStatement(sql);
  }

  async batch(statements: PgStatement[]) {
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      const results: DatabaseRunResult[] = [];

      for (const statement of statements) {
        results.push(await statement.runWithConnection(client));
      }

      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured. Set DATABASE_URL for PostgreSQL or configure the DATABASE_HOST/DATABASE_PORT/DATABASE_NAME/DATABASE_USER/DATABASE_PASSWORD fallback variables.`,
    );
  }

  return value;
}

function createPool() {
  // Prefer DATABASE_URL. This is the correct configuration for Render
  // PostgreSQL and other managed PostgreSQL providers.
  const connectionString = process.env.DATABASE_URL?.trim();

  const sslEnabled =
    process.env.DATABASE_SSL?.toLowerCase() !== "false";

  const maxConnections = Math.max(
    2,
    Number(process.env.DATABASE_CONNECTION_LIMIT ?? 10),
  );

  if (connectionString) {
    return new Pool({
      connectionString,
      max: maxConnections,
      idleTimeoutMillis: 60_000,
      ssl: sslEnabled
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  // Fallback to discrete host/port/user settings for a local PostgreSQL
  // installation when DATABASE_URL is not provided.
  return new Pool({
    host: requiredEnvironmentVariable("DATABASE_HOST"),
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: requiredEnvironmentVariable("DATABASE_NAME"),
    user: requiredEnvironmentVariable("DATABASE_USER"),
    password: requiredEnvironmentVariable("DATABASE_PASSWORD"),
    max: maxConnections,
    idleTimeoutMillis: 60_000,
    ssl: sslEnabled
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

declare global {
  var factoryOperationsPgPool: PgPool | undefined;
}

export function getPool() {
  if (!globalThis.factoryOperationsPgPool) {
    globalThis.factoryOperationsPgPool = createPool();
  }

  return globalThis.factoryOperationsPgPool;
}

export const database = new PgDatabase();
