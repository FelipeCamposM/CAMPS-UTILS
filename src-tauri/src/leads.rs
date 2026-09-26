use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const DEFAULT_STAGES: &str = r##"[
  {"id":"new","name":"Novo","color":"#64748b","position":0,"terminal":false},
  {"id":"qualified","name":"Qualificado","color":"#38bdf8","position":1,"terminal":false},
  {"id":"contacted","name":"Contatado","color":"#a78bfa","position":2,"terminal":false},
  {"id":"replied","name":"Respondeu","color":"#f59e0b","position":3,"terminal":false},
  {"id":"meeting","name":"Reunião","color":"#14b8a6","position":4,"terminal":false},
  {"id":"proposal","name":"Proposta","color":"#f97316","position":5,"terminal":false},
  {"id":"won","name":"Ganho","color":"#22c55e","position":6,"terminal":true},
  {"id":"lost","name":"Perdido","color":"#ef4444","position":7,"terminal":true}
]"##;

const DEFAULT_WEIGHTS: &str = r#"{"noSite":30,"brokenSite":28,"weakSite":18,"socialOnly":24,"instagram":12,"contact":10,"reviews":6,"distance":4}"#;

fn app_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn db(app: &AppHandle) -> Result<Connection, String> {
    let conn = Connection::open(app_dir(app)?.join("leads.db")).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         CREATE TABLE IF NOT EXISTS lead_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS lead_campaigns (
           id TEXT PRIMARY KEY, status TEXT NOT NULL, updated_at INTEGER NOT NULL, data TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS leads (
           id TEXT PRIMARY KEY,
           campaign_id TEXT NOT NULL,
           stage_id TEXT NOT NULL,
           website_status TEXT NOT NULL,
           score REAL NOT NULL DEFAULT 0,
           deleted_at INTEGER,
           updated_at INTEGER NOT NULL,
           data TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);
         CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage_id);
         CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(website_status);
         CREATE INDEX IF NOT EXISTS idx_leads_deleted ON leads(deleted_at);"
    ).map_err(|e| e.to_string())?;
    conn.execute("INSERT OR IGNORE INTO lead_meta(key,value) VALUES('schema_version','1')", []).map_err(|e| e.to_string())?;
    conn.execute("INSERT OR IGNORE INTO lead_meta(key,value) VALUES('stages',?1)", [DEFAULT_STAGES]).map_err(|e| e.to_string())?;
    conn.execute("INSERT OR IGNORE INTO lead_meta(key,value) VALUES('score_weights',?1)", [DEFAULT_WEIGHTS]).map_err(|e| e.to_string())?;
    Ok(conn)
}

fn required_str<'a>(v: &'a Value, key: &str) -> Result<&'a str, String> {
    v.get(key).and_then(Value::as_str).filter(|s| !s.is_empty()).ok_or_else(|| format!("Campo obrigatório ausente: {key}"))
}

fn epoch_ms() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as i64
}

fn save_lead_value(conn: &Connection, mut lead: Value) -> Result<(), String> {
    let now = epoch_ms();
    let obj = lead.as_object_mut().ok_or("Lead inválido")?;
    obj.entry("updatedAt").or_insert(json!(now));
    obj.entry("createdAt").or_insert(json!(now));
    obj.entry("stageId").or_insert(json!("new"));
    obj.entry("websiteStatus").or_insert(json!("unknown"));
    obj.entry("score").or_insert(json!(0));
    let id = required_str(&lead, "id")?.to_string();
    let campaign_id = required_str(&lead, "campaignId")?.to_string();
    let stage_id = lead.get("stageId").and_then(Value::as_str).unwrap_or("new");
    let website_status = lead.get("websiteStatus").and_then(Value::as_str).unwrap_or("unknown");
    let score = lead.get("score").and_then(Value::as_f64).unwrap_or(0.0);
    let deleted_at = lead.get("deletedAt").and_then(Value::as_i64);
    let updated_at = lead.get("updatedAt").and_then(Value::as_i64).unwrap_or(now);
    conn.execute(
        "INSERT INTO leads(id,campaign_id,stage_id,website_status,score,deleted_at,updated_at,data)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8)
         ON CONFLICT(id) DO UPDATE SET campaign_id=excluded.campaign_id,stage_id=excluded.stage_id,
         website_status=excluded.website_status,score=excluded.score,deleted_at=excluded.deleted_at,
         updated_at=excluded.updated_at,data=excluded.data",
        params![id, campaign_id, stage_id, website_status, score, deleted_at, updated_at, lead.to_string()],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn lead_initialize(app: AppHandle) -> Result<(), String> { db(&app).map(|_| ()) }

#[tauri::command]
pub fn lead_campaigns(app: AppHandle) -> Result<Vec<Value>, String> {
    let conn = db(&app)?;
    let mut stmt = conn.prepare("SELECT data FROM lead_campaigns ORDER BY updated_at DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string()).and_then(|s| serde_json::from_str(&s).map_err(|e| e.to_string()))).collect()
}

#[tauri::command]
pub fn lead_save_campaign(app: AppHandle, campaign: Value) -> Result<(), String> {
    let conn = db(&app)?;
    let id = required_str(&campaign, "id")?;
    let status = campaign.get("status").and_then(Value::as_str).unwrap_or("draft");
    let updated_at = campaign.get("updatedAt").and_then(Value::as_i64).unwrap_or_else(epoch_ms);
    conn.execute("INSERT INTO lead_campaigns(id,status,updated_at,data) VALUES(?1,?2,?3,?4)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at,data=excluded.data",
      params![id,status,updated_at,campaign.to_string()]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn lead_delete_campaign(app: AppHandle, id: String) -> Result<(), String> {
    let mut conn = db(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM leads WHERE campaign_id=?1", [&id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM lead_campaigns WHERE id=?1", [&id]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn lead_list(app: AppHandle, filters: Value) -> Result<Vec<Value>, String> {
    let conn = db(&app)?;
    let mut stmt = conn.prepare("SELECT data FROM leads ORDER BY score DESC, updated_at DESC").map_err(|e| e.to_string())?;
    let raw = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    let query = filters.get("query").and_then(Value::as_str).unwrap_or("").to_lowercase();
    let campaign = filters.get("campaignId").and_then(Value::as_str);
    let stage = filters.get("stageId").and_then(Value::as_str);
    let min_score = filters.get("minScore").and_then(Value::as_f64).unwrap_or(0.0);
    let deleted = filters.get("deleted").and_then(Value::as_bool).unwrap_or(false);
    let statuses = filters.get("websiteStatuses").and_then(Value::as_array);
    let has_instagram = filters.get("hasInstagram").and_then(Value::as_bool);
    let mut result = Vec::new();
    for item in raw {
        let value: Value = serde_json::from_str(&item.map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        if campaign.is_some_and(|x| value.get("campaignId").and_then(Value::as_str) != Some(x)) { continue; }
        if stage.is_some_and(|x| value.get("stageId").and_then(Value::as_str) != Some(x)) { continue; }
        if value.get("score").and_then(Value::as_f64).unwrap_or(0.0) < min_score { continue; }
        if value.get("deletedAt").is_some_and(|x| !x.is_null()) != deleted { continue; }
        if statuses.is_some_and(|xs| !xs.iter().any(|x| x.as_str() == value.get("websiteStatus").and_then(Value::as_str))) { continue; }
        if has_instagram.is_some_and(|wanted| value.get("instagramUrl").and_then(Value::as_str).is_some_and(|x| !x.is_empty()) != wanted) { continue; }
        if !query.is_empty() {
            let haystack = format!("{} {} {} {}", value.get("name").and_then(Value::as_str).unwrap_or(""), value.get("address").and_then(Value::as_str).unwrap_or(""), value.get("category").and_then(Value::as_str).unwrap_or(""), value.get("notes").and_then(Value::as_str).unwrap_or("")).to_lowercase();
            if !haystack.contains(&query) { continue; }
        }
        result.push(value);
    }
    Ok(result)
}

#[tauri::command]
pub fn lead_save(app: AppHandle, lead: Value) -> Result<(), String> { save_lead_value(&db(&app)?, lead) }

#[tauri::command]
pub fn lead_update(app: AppHandle, id: String, patch: Value) -> Result<(), String> {
    let conn = db(&app)?;
    let current: String = conn.query_row("SELECT data FROM leads WHERE id=?1", [&id], |r| r.get(0)).optional().map_err(|e| e.to_string())?.ok_or("Lead não encontrado")?;
    let mut lead: Value = serde_json::from_str(&current).map_err(|e| e.to_string())?;
    if let (Some(target), Some(changes)) = (lead.as_object_mut(), patch.as_object()) {
        for (key, value) in changes { target.insert(key.clone(), value.clone()); }
        target.insert("updatedAt".into(), json!(epoch_ms()));
    }
    save_lead_value(&conn, lead)
}

fn set_deleted(app: &AppHandle, id: &str, deleted_at: Option<i64>) -> Result<(), String> {
    let patch = match deleted_at { Some(v) => json!({"deletedAt": v}), None => json!({"deletedAt": null}) };
    lead_update(app.clone(), id.to_string(), patch)
}

#[tauri::command]
pub fn lead_trash(app: AppHandle, id: String) -> Result<(), String> { set_deleted(&app, &id, Some(epoch_ms())) }
#[tauri::command]
pub fn lead_restore(app: AppHandle, id: String) -> Result<(), String> { set_deleted(&app, &id, None) }
#[tauri::command]
pub fn lead_purge(app: AppHandle, id: String) -> Result<(), String> { db(&app)?.execute("DELETE FROM leads WHERE id=?1", [&id]).map(|_| ()).map_err(|e| e.to_string()) }

fn meta_json(app: &AppHandle, key: &str, fallback: &str) -> Result<Value, String> {
    let conn = db(app)?;
    let raw: String = conn.query_row("SELECT value FROM lead_meta WHERE key=?1", [key], |r| r.get(0)).optional().map_err(|e| e.to_string())?.unwrap_or_else(|| fallback.to_string());
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}
fn save_meta(app: &AppHandle, key: &str, value: Value) -> Result<(), String> {
    db(app)?.execute("INSERT INTO lead_meta(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key,value.to_string()]).map(|_| ()).map_err(|e| e.to_string())
}
#[tauri::command] pub fn lead_stages(app: AppHandle) -> Result<Value, String> { meta_json(&app, "stages", DEFAULT_STAGES) }
#[tauri::command] pub fn lead_save_stages(app: AppHandle, stages: Value) -> Result<(), String> { save_meta(&app, "stages", stages) }
#[tauri::command] pub fn lead_score_weights(app: AppHandle) -> Result<Value, String> { meta_json(&app, "score_weights", DEFAULT_WEIGHTS) }
#[tauri::command] pub fn lead_save_score_weights(app: AppHandle, weights: Value) -> Result<(), String> { save_meta(&app, "score_weights", weights) }

fn escape_md(value: &str) -> String { value.replace('|', "\\|").replace('\n', " ") }

#[tauri::command]
pub fn lead_export_markdown(app: AppHandle, campaign_id: String, path: String) -> Result<(), String> {
    let conn = db(&app)?;
    let campaign_raw: String = conn.query_row("SELECT data FROM lead_campaigns WHERE id=?1", [&campaign_id], |r| r.get(0)).optional().map_err(|e| e.to_string())?.ok_or("Campanha não encontrada")?;
    let campaign: Value = serde_json::from_str(&campaign_raw).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT data FROM leads WHERE campaign_id=?1 AND deleted_at IS NULL ORDER BY score DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([&campaign_id], |r| r.get::<_, String>(0)).map_err(|e| e.to_string())?;
    let mut leads = Vec::new();
    for row in rows { leads.push(serde_json::from_str::<Value>(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())?); }
    let mut md = format!("---\ncamps_utils: leads-v1\nexported_at: {}\ncampaign_id: {}\n---\n\n# {}\n\n", epoch_ms(), campaign_id, campaign.get("name").and_then(Value::as_str).unwrap_or("Campanha"));
    md.push_str("| Score | Empresa | Site | Instagram | Telefone | Etapa |\n|---:|---|---|---|---|---|\n");
    for lead in &leads {
        md.push_str(&format!("| {} | {} | {} | {} | {} | {} |\n", lead.get("score").and_then(Value::as_f64).unwrap_or(0.0).round(), escape_md(lead.get("name").and_then(Value::as_str).unwrap_or("")), escape_md(lead.get("websiteStatus").and_then(Value::as_str).unwrap_or("unknown")), escape_md(lead.get("instagramUrl").and_then(Value::as_str).unwrap_or("")), escape_md(lead.get("phone").and_then(Value::as_str).unwrap_or("")), escape_md(lead.get("stageId").and_then(Value::as_str).unwrap_or("new"))));
    }
    let payload = json!({"version":1,"campaign":campaign,"leads":leads});
    md.push_str("\n<!-- CAMPS_UTILS_DATA_BEGIN\n"); md.push_str(&serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?); md.push_str("\nCAMPS_UTILS_DATA_END -->\n");
    fs::write(Path::new(&path), md).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn lead_import_markdown(app: AppHandle, path: String) -> Result<Value, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let start = content.find("<!-- CAMPS_UTILS_DATA_BEGIN").ok_or("Arquivo Markdown não foi gerado pelo CAMPS-UTILS")? + "<!-- CAMPS_UTILS_DATA_BEGIN".len();
    let end = content[start..].find("CAMPS_UTILS_DATA_END -->").map(|x| start + x).ok_or("Bloco de dados incompleto")?;
    let payload: Value = serde_json::from_str(content[start..end].trim()).map_err(|e| format!("Dados inválidos: {e}"))?;
    let campaign = payload.get("campaign").cloned().ok_or("Campanha ausente")?;
    let campaign_id = required_str(&campaign, "id")?.to_string();
    lead_save_campaign(app.clone(), campaign)?;
    let conn = db(&app)?;
    let mut imported = 0;
    for lead in payload.get("leads").and_then(Value::as_array).cloned().unwrap_or_default() { save_lead_value(&conn, lead)?; imported += 1; }
    Ok(json!({"campaignId":campaign_id,"imported":imported}))
}

#[tauri::command]
pub fn lead_instagram_profile_dir(app: AppHandle) -> Result<String, String> {
    let dir = app_dir(&app)?.join("browser-profiles").join("instagram");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn lead_clear_instagram_session(app: AppHandle) -> Result<(), String> {
    let base = app_dir(&app)?.join("browser-profiles");
    let target = base.join("instagram");
    if target.starts_with(&base) && target.exists() { fs::remove_dir_all(&target).map_err(|e| e.to_string())?; }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::escape_md;
    #[test]
    fn markdown_table_is_escaped() { assert_eq!(escape_md("a|b\nc"), "a\\|b c"); }
}
