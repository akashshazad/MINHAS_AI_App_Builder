import mysql from "mysql2/promise";

async function main() {
  const c = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('projects','projectEvents','aiRuns') ORDER BY table_name");
  const [cols] = await c.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name IN ('projects','aiRuns') AND column_name IN ('idea','prompt') ORDER BY table_name");
  console.log(JSON.stringify({ rows, cols }));
  await c.end();
}
main().catch((error) => { console.error(error); process.exit(1); });
