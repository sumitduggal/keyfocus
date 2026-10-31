export function SettingsLabel({ title, description }: { title: string; description: string }) {
  return <span><b>{title}</b><small>{description}</small></span>;
}
