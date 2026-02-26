// ProConnect — Embedded Iframe Page
// Hosts an external app in an iframe inside the authenticated portal shell

const DEFAULT_EMBED_URL = "https://dj.pros.mortgage/session/66f1f6b7-6bbc-46ec-9bf2-8e5324823da3?embed=true";

export default function EmbeddedPage() {
  const embedUrl = process.env.NEXT_PUBLIC_DJ_APP_URL || DEFAULT_EMBED_URL;

  return (
    <div className="max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-14 py-4 sm:py-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <iframe
          id="embedded-frame"
          title="Embedded App"
          src={embedUrl}
          className="w-full h-[78vh]"
          style={{ border: "none" }}
          allow="autoplay; encrypted-media"
        />
      </div>
    </div>
  );
}
