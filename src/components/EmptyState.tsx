type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="empty" role="status">
      <p className="empty-title">{title}</p>
      <p>{body}</p>
    </div>
  );
}
