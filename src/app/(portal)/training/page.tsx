"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, User, Tag, Calendar } from "lucide-react";

interface TrainingVideo {
  id: string;
  title: string;
  description?: string | null;
  zoomUrl: string;
  thumbnailUrl?: string | null;
  presenter?: string | null;
  category: string;
  recordedAt?: string | null;
  featured: boolean;
}

export default function TrainingPage() {
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/training-videos")
      .then((r) => r.json())
      .then((data) => setVideos(data.videos ?? []))
      .catch(() => setVideos([]))
      .finally(() => setIsLoading(false));
  }, []);

  const featured = videos.filter((v) => v.featured);
  const rest = videos.filter((v) => !v.featured);

  return (
    <div className="max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-14 py-4 sm:py-6 space-y-6">
      {isLoading && (
        <div className="flex items-center justify-center h-48 text-gray-400">
          Loading training videos…
        </div>
      )}

      {!isLoading && videos.length === 0 && (
        <div className="flex items-center justify-center h-48 text-gray-400">
          No training videos available yet.
        </div>
      )}

      {featured.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Featured
          </h2>
          <div className="flex flex-wrap gap-4 justify-center max-w-[1412px] mx-auto">
            {featured.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          {featured.length > 0 && (
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              All Videos
            </h2>
          )}
          <div className="flex flex-wrap gap-4 justify-center max-w-[1412px] mx-auto">
            {rest.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function VideoCard({ video }: { video: TrainingVideo }) {
  return (
    <Link
      href={`/training/${video.id}`}
      className="group flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-brand-blue transition-all overflow-hidden"
      style={{ width: 222 }}
    >
      {/* Thumbnail */}
      <div
        className="relative bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0"
        style={{ width: 222, height: 144 }}
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <Play className="w-10 h-10 text-gray-300 dark:text-gray-600" />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-900/90 rounded-full p-3">
            <Play className="w-5 h-5 text-brand-blue fill-brand-blue" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div
        className="p-3 flex flex-col gap-1 overflow-hidden"
        style={{ width: 222, height: 144 }}
      >
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug line-clamp-2">
          {video.title}
        </h3>

        {video.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {video.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-auto text-xs text-gray-400">
          {video.presenter && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {video.presenter}
            </span>
          )}
          {video.category && video.category !== "General" && (
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {video.category}
            </span>
          )}
          {video.recordedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(video.recordedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
