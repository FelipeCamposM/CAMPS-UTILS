mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::convert_pdf,
            commands::docling_installed,
            commands::ensure_docling,
            commands::ffmpeg_installed,
            commands::ensure_ffmpeg,
            commands::whisper_installed,
            commands::ensure_whisper,
            commands::depth_installed,
            commands::ensure_depth,
            commands::rembg_installed,
            commands::ensure_rembg,
            commands::webcapture_installed,
            commands::ensure_webcapture,
            commands::create_zip,
            commands::run_tool,
            commands::youtube_info,
            commands::download_youtube,
            commands::compress_video,
            commands::burn_subtitles,
            commands::system_fonts,
            commands::video_encoder,
            commands::convert_audio,
            commands::video_to_gif,
            commands::convert_images,
            commands::resize_images,
            commands::compress_images,
            commands::vectorize_image,
            commands::upscale_image,
            commands::realesrgan_installed,
            commands::ensure_realesrgan,
            commands::copy_file,
            commands::generate_qr,
            commands::hash_files,
            commands::save_markdown,
            commands::open_folder,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app_handle, event| {
            // Ferramentas como capturar-site/rembg/depth escrevem em temp e nunca
            // limpam sozinhas (cada rodada é uma pasta nova). Ao fechar o app —
            // não a cada tela — apaga tudo de uma vez.
            if let tauri::RunEvent::Exit = event {
                let _ = std::fs::remove_dir_all(std::env::temp_dir().join("camps-utils"));
            }
        });
}
