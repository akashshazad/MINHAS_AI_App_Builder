import mysql from "mysql2/promise";

async function main() {
  const c = await mysql.createConnection(process.env.DATABASE_URL!);
  await c.beginTransaction();
  try {
    const [result] = await c.execute(
      "INSERT INTO projects (userId,name,idea,sourceLanguage,projectType,framework,status,buildStatus,planJson,deployStatus) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [1, "__schema_insert_verification__", "A complete rollback-only project INSERT verification prompt.", "english", "mobile_app", "Expo + React Native + TypeScript", "plan_ready", "not_checked", JSON.stringify({ schemaVersion: "1.0", action: "create_project" }), "planned"],
    );
    const insertId = Number((result as { insertId?: number }).insertId ?? 0);
    if (!insertId) throw new Error("Project INSERT returned no generated ID");
    await c.execute("INSERT INTO projectEvents (projectId,type,message,metadataJson) VALUES (?,?,?,?)", [insertId, "plan_created", "Rollback-only verification event", JSON.stringify({ verification: true })]);
    await c.rollback();
    console.log(JSON.stringify({ ok: true, rolledBack: true, generatedProjectId: insertId }));
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    await c.end();
  }
}
main().catch((error) => { console.error(error); process.exit(1); });
