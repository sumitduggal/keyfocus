import { useState } from "react";

export function DeleteListControl({ label, dialogLabel, description, onDelete }: {
  label: string;
  dialogLabel: string;
  description: string;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return <button type="button" className="todo-delete-list" onClick={() => setConfirming(true)}>{label}</button>;
  }
  return (
    <div className="todo-confirm" role="alertdialog" aria-label={dialogLabel}>
      <p>{description}</p>
      <div>
        <button type="button" className="todo-danger" onClick={onDelete}>{label}</button>
        <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
      </div>
    </div>
  );
}
