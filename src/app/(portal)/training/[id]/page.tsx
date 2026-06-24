"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface TrainingVideo {
  id: string;
  title: string;
  description?: string | null;
  zoomUrl: string;
  presenter?: string | null;
  category: string;
  recordedAt?: string | null;
}

export default function TrainingVideoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [video, setVideo] = useState<TrainingVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/training-videos/${id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => { if (data) setVideo(data.video); })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [id]);

  return (
    <div className="max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-14 py-4 sm:py-6 space-y-3">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Training
      </button>

      {isLoading && (
        <div className="flex items-center justify-center h-[75vh] bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400">
          Loading…
        </div>
      )}

      {notFound && (
        <div className="flex items-center justify-center h-[75vh] bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400">
          Video not found.
        </div>
      )}

      {video && (
        <>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <iframe
              key={video.id}
              title={video.title}
              src={video.zoomUrl}
              className="w-full h-[75vh]"
              style={{ border: "none" }}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          </div>

          <div className="px-1">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {video.title}
            </h1>
            {(video.presenter || video.recordedAt) && (
              <p className="text-sm text-gray-500 mt-0.5">
                {video.presenter && <span>{video.presenter}</span>}
                {video.presenter && video.recordedAt && <span> · </span>}
                {video.recordedAt && (
                  <span>
                    {new Date(video.recordedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </p>
            )}
            {video.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {video.description}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
