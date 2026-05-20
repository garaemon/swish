type Props = { status: string }

const STYLES: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
};

export function StatusBadge({ status }: Props): React.JSX.Element {
  const badgeClassName = STYLES[status] ?? STYLES.pending;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClassName}`}>
      {status}
    </span>
  );
}
