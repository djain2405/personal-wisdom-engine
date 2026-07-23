"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export function CoachMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "coach-md text-[15px] leading-relaxed text-stone-800",
        className,
      )}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <p className="mb-2 font-display text-lg font-semibold text-stone-900">
              {children}
            </p>
          ),
          h2: ({ children }) => (
            <p className="mb-2 mt-4 font-semibold text-teal-900 first:mt-0">
              {children}
            </p>
          ),
          h3: ({ children }) => (
            <p className="mb-1.5 mt-3 text-sm font-semibold uppercase tracking-wide text-stone-500 first:mt-0">
              {children}
            </p>
          ),
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-stone-900">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-stone-700">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-teal-700/40 pl-3 text-stone-600">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-stone-200" />,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-teal-800 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
