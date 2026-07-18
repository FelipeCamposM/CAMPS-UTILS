import { useState } from "react";
import { useSettings } from "./hooks/useSettings";
import { useHistory } from "./hooks/useHistory";
import { Sidebar } from "./components/Sidebar";
import { Home } from "./components/Home";
import { HistoryView } from "./components/HistoryView";
import { SettingsModal } from "./components/SettingsModal";
import { getTool } from "./tools/registry";

export function App() {
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const { settings, updateSettings } = useSettings();
  const { history, addEntry, deleteEntry, clearHistory } = useHistory();

  const activeTool = activeToolId ? getTool(activeToolId) : null;
  const ToolComponent = activeTool?.component ?? null;

  function goHome() {
    setActiveToolId(null);
    setShowHistory(false);
  }

  function openTool(id: string) {
    setActiveToolId(id);
    setShowHistory(false);
  }

  function openHistory() {
    setActiveToolId(null);
    setShowHistory(true);
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar
        activeToolId={activeToolId}
        showHistory={showHistory}
        onHome={goHome}
        onSelectTool={openTool}
        onOpenHistory={openHistory}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 px-6 py-6 max-w-3xl w-full mx-auto">
          {showHistory ? (
            <HistoryView
              history={history}
              selectedId={selectedHistoryId}
              onSelect={setSelectedHistoryId}
              onDelete={deleteEntry}
              onClear={clearHistory}
            />
          ) : ToolComponent ? (
            <div className="space-y-4">
              <div>
                <h1 className="text-text-primary text-lg font-semibold">{activeTool?.name}</h1>
                <p className="text-text-muted text-xs">{activeTool?.description}</p>
              </div>
              <ToolComponent settings={settings} addHistory={addEntry} />
            </div>
          ) : (
            <Home onSelect={openTool} />
          )}
        </main>
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
