import { CommandPalette } from "../components/CommandPalette";
import { FeaturePanel } from "../components/FeaturePanel";
import { Mainframe } from "../components/Mainframe";
import { ReminderBanner } from "../components/ReminderBanner";
import { SettingsPanel } from "../components/SettingsPanel";
import type { WorkspaceView } from "./WorkspaceApp";

export function ActiveFrame({ workspace }: { workspace: WorkspaceView }) {
  const {
    activeFrame,
    noteBodies,
    todoLists,
    habitLists,
    todoViews,
    frameScope,
    registerFrame,
    onHabitsChange,
    onDeleteActiveFrame,
    onTodoViewChange,
    onTitleChange,
    onTodoChange,
    onNoteChange,
  } = workspace;

  return (
    <div
      ref={frameScope}
      className={
        activeFrame.feature === "notes" ? "main-frame-position note-position" : "main-frame-position"
      }
    >
      <Mainframe
        frame={activeFrame}
        active
        noteBody={noteBodies[activeFrame.id]}
        todoItems={todoLists[activeFrame.id]}
        habitItems={habitLists[activeFrame.id]}
        onHabitsChange={onHabitsChange}
        onDelete={onDeleteActiveFrame}
        todoView={todoViews[activeFrame.id] ?? { filter: "all", sort: "manual" }}
        onTodoViewChange={onTodoViewChange}
        onTitleChange={onTitleChange}
        onTodoChange={onTodoChange}
        onNoteChange={onNoteChange}
        frameRef={(node) => registerFrame(activeFrame.id, node)}
      />
    </div>
  );
}

export function WorkspaceCommandPalette({ workspace }: { workspace: WorkspaceView }) {
  const {
    barHost,
    menuOpen,
    searchMode,
    query,
    visibleCommands,
    searchResults,
    featureMenu,
    trashMenu,
    trashRows,
    showTrashRow,
    featureMenuEntries,
    menuFocusIndex,
    activeMenuId,
    actionInputRef,
    reduceMotion,
    onRestoreTrash,
    onOpenTrash,
    onCommandPaletteQueryChange,
    onCommandPaletteFocus,
    onCommandKeyDown,
    onChooseCommand,
    onRunCommand,
    onShowFrame,
  } = workspace;

  return (
    <CommandPalette
      barHost={barHost}
      menuOpen={menuOpen}
      searchMode={searchMode}
      query={query}
      visibleCommands={visibleCommands}
      searchResults={searchResults.map((frame) => ({
        id: frame.id,
        feature: frame.feature,
        title: frame.title,
      }))}
      featureMenu={featureMenu}
      trashMenu={trashMenu}
      trashRows={trashRows}
      showTrashRow={showTrashRow}
      trashCount={trashRows.length}
      onRestoreTrash={onRestoreTrash}
      onOpenTrash={onOpenTrash}
      featureEntries={featureMenuEntries.map((frame) => ({
        id: frame.id,
        feature: frame.feature,
        title: frame.title,
      }))}
      menuFocusIndex={menuFocusIndex}
      activeMenuId={activeMenuId}
      actionInputRef={actionInputRef}
      reduceMotion={reduceMotion}
      onQueryChange={onCommandPaletteQueryChange}
      onFocus={onCommandPaletteFocus}
      onKeyDown={onCommandKeyDown}
      onRunCommand={onChooseCommand}
      onCreateFeature={onRunCommand}
      onSelectResult={onShowFrame}
    />
  );
}

export function WorkspaceOverlays({ workspace }: { workspace: WorkspaceView }) {
  const {
    settingsOpen,
    theme,
    settings,
    workspaceView,
    settingsAnchorY,
    featurePanel,
    featureEntries,
    featureAnchorY,
    entryFocusIndex,
    featureAsideRef,
    undo,
    overdueBannerOpen,
    overdueLists,
    onToggleTheme,
    onWorkspaceViewChange,
    onSettingsChange,
    onSettingsClose,
    registerEntry,
    getEntry,
    onFeaturePanelClose,
    onFeaturePanelCreate,
    onFeaturePanelEntryClick,
    onUndo,
    onShowFrame,
    onDismissOverdue,
  } = workspace;

  return (
    <>
      {settingsOpen && (
        <SettingsPanel
          theme={theme}
          settings={settings}
          workspaceView={workspaceView}
          anchorY={settingsAnchorY}
          onToggleTheme={onToggleTheme}
          onWorkspaceViewChange={onWorkspaceViewChange}
          onChange={onSettingsChange}
          onClose={onSettingsClose}
        />
      )}

      {featurePanel && (
        <FeaturePanel
          featurePanel={featurePanel}
          featureEntries={featureEntries}
          featureAnchorY={featureAnchorY}
          entryFocusIndex={entryFocusIndex}
          featureAsideRef={featureAsideRef}
          registerEntry={registerEntry}
          getEntry={getEntry}
          onClose={onFeaturePanelClose}
          onCreate={() => onFeaturePanelCreate(featurePanel)}
          onEntryClick={onFeaturePanelEntryClick}
        />
      )}

      <ReminderBanner />

      {undo && (
        <div className="undo-toast" role="status">
          <span>{undo.message}</span>
          <button type="button" onClick={onUndo}>
            Undo
          </button>
        </div>
      )}

      {overdueBannerOpen && overdueLists.length > 0 && (
        <div className="overdue-banner" role="status">
          <span>Overdue:</span>
          {overdueLists.map(({ frame, count }) => (
            <button key={frame.id} type="button" onClick={() => onShowFrame(frame.id)}>
              {frame.title} · {count}
            </button>
          ))}
          <button type="button" className="overdue-dismiss" onClick={onDismissOverdue}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
