import Link from "next/link";

export function EmptyState({
  message,
  actionHref,
  actionLabel,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white/60 px-6 py-10 text-center">
      <p className="text-sm text-stone-600">{message}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex text-sm font-medium text-teal-800 hover:underline"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
