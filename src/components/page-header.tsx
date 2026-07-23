import Link from "next/link";

export function PageHeader({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl text-stone-900">{title}</h1>
        {description && (
          <p className="mt-1 text-stone-600">{description}</p>
        )}
      </div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="inline-flex h-10 shrink-0 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
