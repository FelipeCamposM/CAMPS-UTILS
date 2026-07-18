export interface AppSettings {
  defaultOutputDir: string;
  autoSaveNextToPdf: boolean;
  openFolderAfterSave: boolean;
  maxFileSizeMb: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultOutputDir: "",
  autoSaveNextToPdf: false,
  openFolderAfterSave: false,
  maxFileSizeMb: 100,
};

export const MAX_FILE_SIZE_MB = 100;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
