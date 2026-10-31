export function PanelHeading({ glyph, title, closeLabel, onClose }: {
  glyph: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="feature-aside-heading">
      <span aria-hidden="true">{glyph}</span>
      <b>{title}</b>
      <button type="button" aria-label={closeLabel} onClick={onClose}>×</button>
    </div>
  );
}
