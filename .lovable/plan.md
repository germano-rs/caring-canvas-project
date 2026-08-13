# Plan - Refactor Spreadsheet Configuration to Table View with Modals

Refactor the current card-based spreadsheet configuration screen into a table-based view with support for visualizing, editing (via modal), synchronizing, and deleting configurations.

## User Review Required

> [!IMPORTANT]
> The "Visualize" button will open a read-only view of the configuration, while "Edit" will allow modifications. Both will use a dialog (modal) for a cleaner UI.

## Proposed Changes

### Configuration UI (`src/routes/config.tsx`)

- Replace the vertical grid of `SpreadsheetConfigCard` with a responsive Shadcn `Table`.
- Add columns: Name, URL (truncated), Last Sync, Status (Active/Jobs), and Actions.
- Implement a `ConfigDialog` component (using `Dialog` from shadcn/ui) that handles both "View" and "Edit" modes.
- Move the logic currently inside `SpreadsheetConfigCard` into the `ConfigDialog`.
- Add a "Sync" button directly in the table row for quick access.
- Retain the "History" and "Geocoding Test" sections below the table.

### Components

- Update `src/routes/config.tsx` to include the table and dialog logic.

## Technical Details

- **State Management**: Use `useState` to track the currently selected configuration for the modal and the modal's open state.
- **Table Structure**:
  - `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`.
- **Actions**:
  - `Eye` (Visualize): Opens Dialog in read-only mode.
  - `Edit` (Edit): Opens Dialog with editable inputs.
  - `RefreshCw` (Sync): Triggers `handleSync`.
  - `Trash2` (Delete): Triggers `deleteMutation`.
- **Validation**: Ensure required columns (CEP, Rua, Bairro, Longitude, Latitude, Data) are clearly marked in the edit modal.

## Success Criteria

- User sees a clean table of registered spreadsheets.
- Clicking "Editar" or "Visualizar" opens a modal with details.
- "Sincronizar" button works directly from the table row.
- "Excluir" button prompts/removes the entry.
