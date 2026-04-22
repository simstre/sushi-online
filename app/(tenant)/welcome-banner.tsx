import { Info } from "lucide-react";

type Props = {
  title?: string | null;
  body?: string | null;
};

/**
 * Thin notice banner, rendered between banner image and menu when the restaurant
 * has set a welcome message. Null-safe: renders nothing if both fields are empty.
 */
export function WelcomeBanner({ title, body }: Props) {
  if (!title && !body) return null;
  return (
    <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 md:mt-6">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {body && <p className={title ? "mt-0.5 text-amber-800" : ""}>{body}</p>}
      </div>
    </div>
  );
}
