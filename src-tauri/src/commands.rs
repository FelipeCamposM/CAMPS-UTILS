use tauri::{AppHandle, Emitter, Manager};
use tauri::path::BaseDirectory;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::ShellExt;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_opener::OpenerExt;
use std::path::{Path, PathBuf};

fn emit_progress_lines(app: &AppHandle, tool: &str, text: &str) {
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("PROGRESS:") {
            if let Ok(pct) = rest.trim().parse::<u32>() {
                let _ = app.emit("tool-progress", pct);
            }
        } else if let Some(rest) = trimmed.strip_prefix("EVENT:") {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(rest.trim()) {
                let _ = app.emit("youtube-event", val);
            }
        }
    }
    eprint!("[converter/{tool}] {text}");
}

/// Runs the Python tool and returns its stdout (one JSON line by contract).
/// In debug builds runs the source via the venv Python (instant iteration);
/// in release builds runs the bundled light sidecar — except `pdf2md`, que roda
/// o sidecar Docling baixado sob demanda.
async fn run_python_tool(app: &AppHandle, tool: &str, input_json: &str) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        run_dev_python(app, tool, input_json).await
    }
    #[cfg(not(debug_assertions))]
    {
        if tool == "pdf2md" {
            run_docling_release(app, input_json).await
        } else {
            run_sidecar_python(app, tool, input_json).await
        }
    }
}

/// Spawna um executável (python dev ou sidecar docling), coleta stdout e
/// encaminha progresso/eventos do stderr. Retorna o stdout completo.
async fn spawn_and_collect(app: &AppHandle, program: &Path, args: &[String]) -> Result<String, String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};

    let mut child = tokio::process::Command::new(program)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Falha ao iniciar processo: {e}"))?;

    if let Some(stderr) = child.stderr.take() {
        let app2 = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                emit_progress_lines(&app2, "tool", &format!("{line}\n"));
            }
        });
    }

    let mut stdout = String::new();
    if let Some(mut out) = child.stdout.take() {
        out.read_to_string(&mut stdout).await.map_err(|e| e.to_string())?;
    }
    let _ = child.wait().await;

    if stdout.trim().is_empty() {
        return Err("{\"success\":false,\"errorCode\":\"CONVERSION_FAILED\",\"message\":\"Conversor não retornou resposta.\"}".to_string());
    }
    Ok(stdout)
}

/// Dev: executa `python/converter.py` direto pela venv, sem PyInstaller.
#[cfg(debug_assertions)]
async fn run_dev_python(app: &AppHandle, tool: &str, input_json: &str) -> Result<String, String> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or("raiz do projeto não encontrada")?;
    let python = root.join(".venv").join("Scripts").join("python.exe");
    let script = root.join("python").join("converter.py");
    let python = if python.exists() { python } else { PathBuf::from("python") };

    let args = vec![
        script.to_string_lossy().to_string(),
        "--tool".into(),
        tool.to_string(),
        "--input".into(),
        input_json.to_string(),
    ];
    spawn_and_collect(app, &python, &args).await
}

/// Release: executa o sidecar Docling baixado (pdf2md).
#[cfg(not(debug_assertions))]
async fn run_docling_release(app: &AppHandle, input_json: &str) -> Result<String, String> {
    let exe = docling_exe_path(app);
    if !exe.as_ref().map(|p| p.exists()).unwrap_or(false) {
        return Err("{\"success\":false,\"errorCode\":\"DOCLING_MISSING\",\"message\":\"Módulo PDF→Markdown ainda não instalado.\"}".to_string());
    }
    let args = vec![
        "--tool".into(),
        "pdf2md".into(),
        "--input".into(),
        input_json.to_string(),
    ];
    spawn_and_collect(app, &exe.unwrap(), &args).await
}

/// Release: executa o sidecar PyInstaller empacotado.
#[cfg(not(debug_assertions))]
async fn run_sidecar_python(app: &AppHandle, tool: &str, input_json: &str) -> Result<String, String> {
    let sidecar = app
        .shell()
        .sidecar("converter")
        .map_err(|e| format!("Sidecar não encontrado: {e}"))?;

    let (mut rx, _child) = sidecar
        .args(["--tool", tool, "--input", input_json])
        .spawn()
        .map_err(|e| format!("Falha ao iniciar o conversor: {e}"))?;

    let mut stdout = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => {
                stdout.push_str(&String::from_utf8_lossy(&bytes));
            }
            CommandEvent::Stderr(bytes) => {
                emit_progress_lines(app, tool, &String::from_utf8_lossy(&bytes));
            }
            CommandEvent::Terminated(payload) => {
                if stdout.is_empty() {
                    let code = payload.code.unwrap_or(-1);
                    return Err(format!(
                        "{{\"success\":false,\"errorCode\":\"CONVERSION_FAILED\",\"message\":\"Conversor encerrou com código {code}.\"}}"
                    ));
                }
                break;
            }
            CommandEvent::Error(msg) => {
                return Err(format!(
                    "{{\"success\":false,\"errorCode\":\"CONVERSION_FAILED\",\"message\":\"Erro interno: {msg}\"}}"
                ));
            }
            _ => {}
        }
    }

    Ok(stdout)
}

/// PDF → Markdown (Docling). Kept for compatibility; thin wrapper over the sidecar dispatcher.
#[tauri::command]
pub async fn convert_pdf(app: AppHandle, input_json: String) -> Result<String, String> {
    run_python_tool(&app, "pdf2md", &input_json).await
}

/// Generic sidecar tool runner (md2pdf, pdf_merge, youtube, …).
#[tauri::command]
pub async fn run_tool(app: AppHandle, tool: String, input_json: String) -> Result<String, String> {
    run_python_tool(&app, &tool, &input_json).await
}

// ─── Módulo Docling (baixado sob demanda) ────────────────────────────────────
const TARGET_TRIPLE: &str = "x86_64-pc-windows-msvc";
const DOCLING_URL: &str =
    "https://github.com/FelipeCamposM/CAMPS-UTILS/releases/download/docling-v1/camps-docling.zip";
/// SHA256 do camps-docling.zip (de `python build.py docling`).
const DOCLING_SHA256: &str = "6620709852f9edeba4a8d9f4b232c2f1b70396f0286b040370eb3f789f6782bf";

fn docling_exe_name() -> String {
    format!("converter-docling-{TARGET_TRIPLE}.exe")
}

fn docling_runtime_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_local_data_dir().ok().map(|d| d.join("runtime"))
}

fn docling_exe_path(app: &AppHandle) -> Option<PathBuf> {
    docling_runtime_dir(app).map(|d| d.join(docling_exe_name()))
}

/// Informa se o módulo Docling está pronto. Em dev, sempre true (roda a fonte).
#[tauri::command]
pub async fn docling_installed(app: AppHandle) -> bool {
    #[cfg(debug_assertions)]
    {
        let _ = app;
        true
    }
    #[cfg(not(debug_assertions))]
    {
        docling_exe_path(&app).map(|p| p.exists()).unwrap_or(false)
    }
}

fn extract_zip(zip_path: &Path, dest: &Path) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let out = dest.join(entry.name());
        if entry.is_dir() {
            std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = out.parent() {
                std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
            }
            let mut o = std::fs::File::create(&out).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut o).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Baixa e extrai o módulo Docling do GitHub Release (se ainda não presente).
/// Emite `docling-progress` (0–100). Em dev é no-op.
#[tauri::command]
pub async fn ensure_docling(app: AppHandle) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        let _ = app;
        return Ok(());
    }
    #[cfg(not(debug_assertions))]
    {
        use futures_util::StreamExt;
        use sha2::Digest;
        use tokio::io::AsyncWriteExt;

        let dir = docling_runtime_dir(&app).ok_or("pasta local não encontrada")?;
        let exe = dir.join(docling_exe_name());
        if exe.exists() {
            return Ok(());
        }
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

        let resp = reqwest::get(DOCLING_URL)
            .await
            .map_err(|e| format!("Falha no download: {e}"))?;
        if !resp.status().is_success() {
            return Err(format!("Download retornou HTTP {}.", resp.status()));
        }
        let total = resp.content_length().unwrap_or(0);

        let tmp = dir.join("camps-docling.zip.part");
        let mut out = tokio::fs::File::create(&tmp).await.map_err(|e| e.to_string())?;
        let mut hasher = sha2::Sha256::new();
        let mut downloaded: u64 = 0;
        let mut stream = resp.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            hasher.update(&chunk);
            out.write_all(&chunk).await.map_err(|e| e.to_string())?;
            downloaded += chunk.len() as u64;
            if total > 0 {
                let pct = (downloaded * 100 / total) as u32;
                let _ = app.emit("docling-progress", pct);
            }
        }
        out.flush().await.ok();
        drop(out);

        if !DOCLING_SHA256.is_empty() {
            let got = hex::encode(hasher.finalize());
            if !got.eq_ignore_ascii_case(DOCLING_SHA256) {
                std::fs::remove_file(&tmp).ok();
                return Err("Verificação de integridade (SHA256) falhou.".to_string());
            }
        }

        let tmp2 = tmp.clone();
        let dir2 = dir.clone();
        tokio::task::spawn_blocking(move || extract_zip(&tmp2, &dir2))
            .await
            .map_err(|e| e.to_string())??;
        std::fs::remove_file(&tmp).ok();

        if !exe.exists() {
            return Err("Módulo extraído mas o executável não foi encontrado.".to_string());
        }
        let _ = app.emit("docling-progress", 100u32);
        Ok(())
    }
}

/// Resolve um binário empacotado (produção via resource; dev via manifest dir; fallback exe dir).
fn resolve_bundled(app: &AppHandle, name: &str) -> Option<PathBuf> {
    if let Ok(p) = app.path().resolve(format!("binaries/{name}"), BaseDirectory::Resource) {
        if p.exists() {
            return Some(p);
        }
    }
    let dev = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries").join(name);
    if dev.exists() {
        return Some(dev);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join(name);
            if p.exists() {
                return Some(p);
            }
        }
    }
    None
}

fn resolve_ffmpeg(app: &AppHandle) -> Option<String> {
    resolve_bundled(app, "ffmpeg.exe").map(|p| p.to_string_lossy().to_string())
}

async fn probe_duration(ffprobe: &Path, input: &str) -> f64 {
    tokio::process::Command::new(ffprobe)
        .args(["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", input])
        .output()
        .await
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.trim().parse::<f64>().ok())
        .unwrap_or(0.0)
}

/// Roda o ffmpeg emitindo `tool-progress` (usa `-progress pipe:1` + duração total).
async fn ffmpeg_run_progress(
    app: &AppHandle,
    ffmpeg: &Path,
    args: Vec<String>,
    total: f64,
) -> Result<(), String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, BufReader};

    let mut child = tokio::process::Command::new(ffmpeg)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Falha ao iniciar ffmpeg: {e}"))?;

    if let Some(out) = child.stdout.take() {
        let app2 = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(out).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if let Some(v) = line.strip_prefix("out_time_us=") {
                    if total > 0.0 {
                        if let Ok(us) = v.trim().parse::<f64>() {
                            let pct = ((us / 1_000_000.0) / total * 100.0).clamp(0.0, 100.0) as u32;
                            let _ = app2.emit("tool-progress", pct);
                        }
                    }
                }
            }
        });
    }
    if let Some(err) = child.stderr.take() {
        tokio::spawn(async move {
            let mut lines = BufReader::new(err).lines();
            while let Ok(Some(_)) = lines.next_line().await {}
        });
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("ffmpeg falhou.".to_string());
    }
    let _ = app.emit("tool-progress", 100u32);
    Ok(())
}

/// Roda o ffmpeg sem progresso (operações rápidas em lote).
async fn ffmpeg_run(ffmpeg: &Path, args: &[String]) -> Result<(), String> {
    use std::process::Stdio;
    let status = tokio::process::Command::new(ffmpeg)
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map_err(|e| format!("Falha ao iniciar ffmpeg: {e}"))?;
    if !status.success() {
        return Err("ffmpeg falhou.".to_string());
    }
    Ok(())
}

#[derive(serde::Deserialize)]
pub struct CompressVideoArgs {
    input: String,
    output: String,
    crf: Option<u8>,
    preset: Option<String>,
}

/// Comprime um vídeo (re-encode H.264) usando o ffmpeg empacotado.
#[tauri::command]
pub async fn compress_video(app: AppHandle, args: CompressVideoArgs) -> Result<String, String> {
    let ffmpeg = resolve_bundled(&app, "ffmpeg.exe").ok_or("ffmpeg não encontrado.")?;
    let total = match resolve_bundled(&app, "ffprobe.exe") {
        Some(fp) => probe_duration(&fp, &args.input).await,
        None => 0.0,
    };
    let crf = args.crf.unwrap_or(28).clamp(0, 51).to_string();
    let preset = args.preset.unwrap_or_else(|| "medium".to_string());

    let ff_args: Vec<String> = vec![
        "-y", "-i", &args.input,
        "-c:v", "libx264", "-crf", &crf, "-preset", &preset,
        "-c:a", "aac", "-b:a", "128k",
        "-progress", "pipe:1", "-nostats",
        &args.output,
    ]
    .into_iter()
    .map(String::from)
    .collect();

    ffmpeg_run_progress(&app, &ffmpeg, ff_args, total).await?;
    Ok(args.output)
}

#[derive(serde::Deserialize)]
pub struct AudioConvertArgs {
    inputs: Vec<String>,
    out_dir: String,
    format: String,
    bitrate: Option<u32>,
}

/// Converte áudios em lote (mp3/wav/flac) via ffmpeg empacotado. Retorna caminhos.
#[tauri::command]
pub async fn convert_audio(app: AppHandle, args: AudioConvertArgs) -> Result<Vec<String>, String> {
    let ffmpeg = resolve_bundled(&app, "ffmpeg.exe").ok_or("ffmpeg não encontrado.")?;
    let fmt = args.format.to_lowercase();
    let bitrate = args.bitrate.unwrap_or(192);

    let dir = PathBuf::from(&args.out_dir);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let mut outputs = Vec::with_capacity(args.inputs.len());
    for input in &args.inputs {
        let stem = Path::new(input)
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("nome de arquivo inválido")?;
        let out_path = dir.join(format!("{stem}.{fmt}"));
        let out_str = out_path.to_string_lossy().to_string();

        let mut ff_args: Vec<String> = vec!["-y".into(), "-i".into(), input.clone()];
        match fmt.as_str() {
            "mp3" => {
                ff_args.extend(["-c:a".into(), "libmp3lame".into(), "-b:a".into(), format!("{bitrate}k")]);
            }
            "wav" => {
                ff_args.extend(["-c:a".into(), "pcm_s16le".into()]);
            }
            "flac" => {
                ff_args.extend(["-c:a".into(), "flac".into()]);
            }
            other => return Err(format!("formato de áudio não suportado: {other}")),
        }
        ff_args.push(out_str.clone());

        ffmpeg_run(&ffmpeg, &ff_args)
            .await
            .map_err(|e| format!("{input}: {e}"))?;
        outputs.push(out_str);
    }
    Ok(outputs)
}

#[derive(serde::Deserialize)]
pub struct GifArgs {
    input: String,
    output: String,
    fps: Option<u32>,
    width: Option<u32>,
    start: Option<f64>,
    duration: Option<f64>,
}

/// Converte um trecho de vídeo em GIF via ffmpeg empacotado.
#[tauri::command]
pub async fn video_to_gif(app: AppHandle, args: GifArgs) -> Result<String, String> {
    let ffmpeg = resolve_bundled(&app, "ffmpeg.exe").ok_or("ffmpeg não encontrado.")?;
    let fps = args.fps.unwrap_or(12).clamp(1, 50);
    let width = args.width.unwrap_or(480).clamp(64, 1920);

    let total = match args.duration {
        Some(d) if d > 0.0 => d,
        _ => match resolve_bundled(&app, "ffprobe.exe") {
            Some(fp) => probe_duration(&fp, &args.input).await,
            None => 0.0,
        },
    };

    let mut ff_args: Vec<String> = vec!["-y".into()];
    if let Some(s) = args.start {
        ff_args.extend(["-ss".into(), s.to_string()]);
    }
    if let Some(d) = args.duration {
        ff_args.extend(["-t".into(), d.to_string()]);
    }
    ff_args.extend([
        "-i".into(),
        args.input.clone(),
        "-vf".into(),
        format!("fps={fps},scale={width}:-1:flags=lanczos"),
        "-progress".into(),
        "pipe:1".into(),
        "-nostats".into(),
        args.output.clone(),
    ]);

    ffmpeg_run_progress(&app, &ffmpeg, ff_args, total).await?;
    Ok(args.output)
}

/// Busca metadados do vídeo (título, thumbnail, qualidades) sem baixar.
#[tauri::command]
pub async fn youtube_info(app: AppHandle, url: String) -> Result<String, String> {
    let input = serde_json::json!({ "url": url }).to_string();
    run_python_tool(&app, "youtube_info", &input).await
}

/// Baixa vídeo/música do YouTube via yt-dlp, usando o ffmpeg empacotado.
/// mode: "audio" | "video" | "playlist_audio". Emite eventos `tool-progress`.
#[tauri::command]
pub async fn download_youtube(
    app: AppHandle,
    url: String,
    mode: String,
    output_dir: String,
    audio_kbps: Option<u32>,
    max_height: Option<u32>,
) -> Result<String, String> {
    let ffmpeg = resolve_ffmpeg(&app);
    let input = serde_json::json!({
        "url": url,
        "mode": mode,
        "outputDir": output_dir,
        "audioKbps": audio_kbps,
        "maxHeight": max_height,
        "ffmpegLocation": ffmpeg,
    })
    .to_string();
    run_python_tool(&app, "youtube", &input).await
}

/// Baixa playlist/álbum/faixa do Spotify (metadados Spotify → áudio do YouTube via spotdl).
#[tauri::command]
pub async fn download_spotify(
    app: AppHandle,
    url: String,
    output_dir: String,
    audio_kbps: Option<u32>,
    client_id: Option<String>,
    client_secret: Option<String>,
) -> Result<String, String> {
    let ffmpeg = resolve_ffmpeg(&app);
    let input = serde_json::json!({
        "url": url,
        "outputDir": output_dir,
        "audioKbps": audio_kbps,
        "clientId": client_id,
        "clientSecret": client_secret,
        "ffmpegLocation": ffmpeg,
    })
    .to_string();
    run_python_tool(&app, "spotify", &input).await
}

#[derive(serde::Deserialize)]
pub struct ImageConvertArgs {
    inputs: Vec<String>,
    format: String,
    out_dir: Option<String>,
    quality: Option<u8>,
}

/// Batch image conversion (webp/png/jpg/ico), native via the `image`/`webp` crates.
/// Returns the list of output paths.
#[tauri::command]
pub async fn convert_images(args: ImageConvertArgs) -> Result<Vec<String>, String> {
    let quality = args.quality.unwrap_or(85).clamp(1, 100);
    let fmt = args.format.to_lowercase();
    let mut outputs = Vec::with_capacity(args.inputs.len());
    for input in &args.inputs {
        let out = convert_one_image(input, &fmt, args.out_dir.as_deref(), quality)
            .map_err(|e| format!("{input}: {e}"))?;
        outputs.push(out);
    }
    Ok(outputs)
}

fn ext_for(fmt: &str) -> &str {
    match fmt {
        "jpeg" => "jpg",
        other => other,
    }
}

/// Escreve uma imagem já decodificada no formato pedido.
fn write_image(
    img: &image::DynamicImage,
    fmt: &str,
    out_path: &Path,
    quality: u8,
) -> Result<(), String> {
    match fmt {
        "webp" => {
            let encoder = webp::Encoder::from_image(img).map_err(|e| e.to_string())?;
            let mem = encoder.encode(quality as f32);
            std::fs::write(out_path, &*mem).map_err(|e| e.to_string())?;
        }
        "png" => {
            img.save_with_format(out_path, image::ImageFormat::Png)
                .map_err(|e| e.to_string())?;
        }
        "jpg" | "jpeg" => {
            let rgb = img.to_rgb8();
            let file = std::fs::File::create(out_path).map_err(|e| e.to_string())?;
            let mut writer = std::io::BufWriter::new(file);
            let mut encoder =
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut writer, quality);
            encoder.encode_image(&rgb).map_err(|e| e.to_string())?;
        }
        "ico" => {
            // ICO máximo é 256x256 — reduz se necessário.
            let icon = if img.width() > 256 || img.height() > 256 {
                img.resize(256, 256, image::imageops::FilterType::Lanczos3)
            } else {
                img.clone()
            };
            icon.save_with_format(out_path, image::ImageFormat::Ico)
                .map_err(|e| e.to_string())?;
        }
        other => return Err(format!("formato não suportado: {other}")),
    }
    Ok(())
}

fn convert_one_image(
    input: &str,
    fmt: &str,
    out_dir: Option<&str>,
    quality: u8,
) -> Result<String, String> {
    let src = Path::new(input);
    let img = image::open(src).map_err(|e| format!("falha ao abrir imagem: {e}"))?;

    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("nome de arquivo inválido")?;

    let dir: PathBuf = match out_dir {
        Some(d) => PathBuf::from(d),
        None => src.parent().unwrap_or(Path::new(".")).to_path_buf(),
    };
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let out_path = dir.join(format!("{stem}.{}", ext_for(fmt)));

    write_image(&img, fmt, &out_path, quality)?;
    Ok(out_path.to_string_lossy().to_string())
}

#[derive(serde::Deserialize)]
pub struct ResizeArgs {
    inputs: Vec<String>,
    out_dir: String,
    max_width: Option<u32>,
    max_height: Option<u32>,
    /// Escala percentual (1–100); aplicada se max_width/max_height não vierem.
    scale_pct: Option<u32>,
    /// Formato alvo; mantém o da origem se ausente.
    format: Option<String>,
    quality: Option<u8>,
    /// Se presente, saída = `<prefix>_<n>.<ext>` (renomeio em lote).
    rename_prefix: Option<String>,
}

/// Redimensiona/comprime imagens em lote. Retorna os caminhos gerados.
#[tauri::command]
pub async fn resize_images(args: ResizeArgs) -> Result<Vec<String>, String> {
    let quality = args.quality.unwrap_or(85).clamp(1, 100);
    let dir = PathBuf::from(&args.out_dir);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let mut outputs = Vec::with_capacity(args.inputs.len());
    for (i, input) in args.inputs.iter().enumerate() {
        let out = resize_one(input, &dir, &args, quality, i + 1)
            .map_err(|e| format!("{input}: {e}"))?;
        outputs.push(out);
    }
    Ok(outputs)
}

fn resize_one(
    input: &str,
    dir: &Path,
    args: &ResizeArgs,
    quality: u8,
    index: usize,
) -> Result<String, String> {
    let src = Path::new(input);
    let img = image::open(src).map_err(|e| format!("falha ao abrir imagem: {e}"))?;

    let resized = if args.max_width.is_some() || args.max_height.is_some() {
        let w = args.max_width.unwrap_or(u32::MAX);
        let h = args.max_height.unwrap_or(u32::MAX);
        img.resize(w, h, image::imageops::FilterType::Lanczos3)
    } else if let Some(pct) = args.scale_pct {
        let pct = pct.clamp(1, 100);
        let w = (img.width() * pct / 100).max(1);
        let h = (img.height() * pct / 100).max(1);
        img.resize(w, h, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    let src_ext = src
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let fmt = args
        .format
        .as_deref()
        .map(|f| f.to_lowercase())
        .unwrap_or(src_ext);

    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("nome de arquivo inválido")?;
    let name = match &args.rename_prefix {
        Some(prefix) => format!("{prefix}_{index}.{}", ext_for(&fmt)),
        None => format!("{stem}.{}", ext_for(&fmt)),
    };
    let out_path = dir.join(name);

    write_image(&resized, &fmt, &out_path, quality)?;
    Ok(out_path.to_string_lossy().to_string())
}

/// Generates a QR code PNG for the given text. Returns the output path.
#[tauri::command]
pub async fn generate_qr(text: String, out_path: String, size: Option<u32>) -> Result<String, String> {
    if text.trim().is_empty() {
        return Err("Texto vazio.".to_string());
    }
    let dim = size.unwrap_or(512).clamp(64, 2048);

    let code = qrcode::QrCode::new(text.as_bytes()).map_err(|e| e.to_string())?;
    let img = code
        .render::<image::Luma<u8>>()
        .min_dimensions(dim, dim)
        .build();

    let out = Path::new(&out_path);
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    img.save_with_format(out, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    Ok(out_path)
}

#[derive(serde::Deserialize)]
pub struct HashArgs {
    paths: Vec<String>,
    algo: String,
}

#[derive(serde::Serialize)]
pub struct HashResult {
    path: String,
    hash: String,
}

fn hash_bytes(algo: &str, data: &[u8]) -> Result<String, String> {
    use sha2::Digest;
    match algo {
        "sha256" => Ok(hex::encode(sha2::Sha256::digest(data))),
        "sha1" => Ok(hex::encode(sha1::Sha1::digest(data))),
        "md5" => Ok(hex::encode(md5::compute(data).0)),
        other => Err(format!("algoritmo não suportado: {other}")),
    }
}

/// Computes file hashes (md5/sha1/sha256) for the given paths.
#[tauri::command]
pub async fn hash_files(args: HashArgs) -> Result<Vec<HashResult>, String> {
    let algo = args.algo.to_lowercase();
    let mut out = Vec::with_capacity(args.paths.len());
    for path in args.paths {
        let data = std::fs::read(&path).map_err(|e| format!("{path}: {e}"))?;
        let hash = hash_bytes(&algo, &data)?;
        out.push(HashResult { path, hash });
    }
    Ok(out)
}

/// Saves text content to the given path (used by save-as flows).
#[tauri::command]
pub async fn save_markdown(path: String, content: String) -> Result<(), String> {
    let out_path = Path::new(&path);

    if let Some(parent) = out_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Não foi possível criar o diretório: {e}"))?;
        }
    }

    std::fs::write(out_path, content.as_bytes())
        .map_err(|e| format!("Não foi possível salvar o arquivo: {e}"))
}

/// Opens the folder containing the given file path in the OS file manager.
#[tauri::command]
pub async fn open_folder(app: AppHandle, file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    let folder = if path.is_dir() {
        path.to_path_buf()
    } else {
        path.parent()
            .ok_or_else(|| "Caminho inválido.".to_string())?
            .to_path_buf()
    };

    app.opener()
        .open_path(folder.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| format!("Não foi possível abrir a pasta: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_known_vectors() {
        // Hashes conhecidos da string "abc".
        assert_eq!(
            hash_bytes("sha256", b"abc").unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(hash_bytes("sha1", b"abc").unwrap(), "a9993e364706816aba3e25717850c26c9cd0d89d");
        assert_eq!(hash_bytes("md5", b"abc").unwrap(), "900150983cd24fb0d6963f7d28e17f72");
    }

    #[test]
    fn hash_unknown_algo_errors() {
        assert!(hash_bytes("crc32", b"abc").is_err());
    }

    #[test]
    fn qr_renders_png() {
        let code = qrcode::QrCode::new(b"https://exemplo.com").unwrap();
        let img = code.render::<image::Luma<u8>>().min_dimensions(128, 128).build();
        assert!(img.width() >= 128 && img.height() >= 128);
    }

    #[test]
    fn resize_and_convert_roundtrip() {
        let dir = std::env::temp_dir().join(format!("camps_test_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let src = dir.join("src.png");
        image::DynamicImage::ImageRgb8(image::RgbImage::new(200, 100))
            .save(&src)
            .unwrap();

        // Redimensiona p/ caber em 50x50 (mantém proporção → 50x25) e converte p/ jpg.
        let img = image::open(&src).unwrap();
        let resized = img.resize(50, 50, image::imageops::FilterType::Lanczos3);
        assert_eq!(resized.width(), 50);
        assert_eq!(resized.height(), 25);

        let out = dir.join("out.jpg");
        write_image(&resized, "jpg", &out, 80).unwrap();
        assert!(out.exists());

        std::fs::remove_dir_all(&dir).ok();
    }
}
