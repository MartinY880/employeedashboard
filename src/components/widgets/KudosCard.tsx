// ProConnect — KudosCard Widget
// Single kudos card: avatar, author, recipient, message, likes, timestamp

"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSounds } from "@/components/shared/SoundProvider";

interface KudosCardProps {
  id?: string;
  authorName: string;
  authorInitials: string;
  authorPhotoUrl?: string;
  recipientName: string;
  message: string;
  likes: number;
  createdAt: string;
}

export function KudosCard({
  authorName,
  authorInitials,
  authorPhotoUrl,
  recipientName,
  message,
  likes,
  createdAt,
}: KudosCardProps) {
  const { playPop } = useSounds();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(likes);
  const timeAgo = getRelativeTime(createdAt);

  const handleLike = () => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
    playPop();
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
          {authorPhotoUrl && (
            <AvatarImage src={authorPhotoUrl} alt={authorName} />
          )}
          <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-[10px] font-bold">
            {authorInitials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-sm">
            <span className="font-semibold text-gray-800">{authorName}</span>
            <span className="text-brand-grey"> → </span>
            <span className="font-semibold text-brand-blue">@{recipientName}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
            {message}
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-brand-grey">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 transition-colors group ${
                liked ? "text-red-500" : "hover:text-red-500"
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 transition-colors ${
                  liked ? "fill-red-500 text-red-500" : "group-hover:fill-red-500"
                }`}
              />
              {likeCount}
            </button>
            <span className="ml-auto">{timeAgo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
