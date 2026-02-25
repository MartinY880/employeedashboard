// ProConnect — Props Feed Widget (Gamified)
// Badge-style praise feed + compose form with badge picker

"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { KudosCard, PRAISE_BADGES, type PraiseBadgeKey } from "./KudosCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Loader2, Zap } from "lucide-react";
import { useKudos } from "@/hooks/useKudos";
import { useSounds } from "@/components/shared/SoundProvider";
import { PeoplePicker } from "@/components/shared/PeoplePicker";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function KudosFeed() {
  const { kudos, isLoading, sendKudos, toggleReaction } = useKudos();
  const { playNotify, playSuccess, playClick, playPop } = useSounds();
  const [message, setMessage] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [selectedBadge, setSelectedBadge] = useState<PraiseBadgeKey>("mvp");
  const [isSending, setIsSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const prevCountRef = useRef(kudos.length);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch current user email to exclude from recipient picker
  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.email) setCurrentUserEmail(data.email); })
      .catch(() => {});
  }, []);

  // Play sound when new kudos arrive (after initial load)
  useEffect(() => {
    if (prevCountRef.current > 0 && kudos.length > prevCountRef.current) {
      playNotify();
    }
    prevCountRef.current = kudos.length;
  }, [kudos.length, playNotify]);

  const handleSend = async () => {
    if (!message.trim() || !recipientEmail) return;
    setIsSending(true);
    try {
      await sendKudos(recipientEmail, message.trim(), recipientName, selectedBadge);
      playSuccess();
      setMessage("");
      setRecipientEmail("");
      setRecipientName("");
      setSelectedBadge("mvp");
      setShowCompose(false);
    } catch {
      playNotify();
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
            <Skeleton className="h-10 w-full" />
            <div className="p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
              <Skeleton className="h-3 w-full ml-9" />
              <Skeleton className="h-3 w-1/2 ml-9" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compose Toggle */}
      {!showCompose ? (
        <Button
          onClick={() => {
            setShowCompose(true);
            playClick();
          }}
          className="w-full bg-brand-blue/5 hover:bg-brand-blue/10 text-brand-blue border border-brand-blue/20 text-xs font-medium"
          variant="ghost"
        >
          <Zap className="w-3.5 h-3.5 mr-1.5" />
          Award Props to a Teammate
        </Button>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-xl border border-brand-blue/20 shadow-sm overflow-hidden"
        >
          <div className="bg-brand-blue px-3.5 py-2">
            <div className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3 h-3" />
              Award Props
            </div>
          </div>

          <div className="p-3 space-y-2.5">
            {/* Badge Picker */}
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
                Choose Award
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {PRAISE_BADGES.map((b) => {
                  const isSelected = selectedBadge === b.key;
                  return (
                    <motion.button
                      key={b.key}
                      onClick={() => {
                        setSelectedBadge(b.key as PraiseBadgeKey);
                        playPop();
                      }}
                      whileTap={{ scale: 0.95 }}
                     className={`h-11 w-full flex items-center justify-center gap-1.5 px-2 rounded-lg text-xs font-semibold text-center transition-all ${
                        isSelected
                          ? `bg-gradient-to-r ${b.gradient} text-white shadow-sm ring-2 ring-offset-1 ring-brand-blue/30`
                          : `${b.bg} ${b.border} border hover:shadow-sm`
                      }`}
                    >
                      <span className="h-4 w-4 inline-flex items-center justify-center">
                        <span className={`text-sm leading-none ${b.emojiScale}`}>{b.emoji}</span>
                      </span>
                      <span className={`text-[10px] font-bold leading-tight whitespace-nowrap ${isSelected ? "text-white" : "text-gray-700"}`}>
                        {b.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Recipient Picker */}
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                To
              </label>
              <PeoplePicker
                value={recipientEmail}
                selectedName={recipientName}
                onChange={(email, name) => {
                  setRecipientEmail(email);
                  setRecipientName(name || "");
                }}
                onClear={() => {
                  setRecipientEmail("");
                  setRecipientName("");
                }}
                placeholder="Search colleague @mtgpros.com..."
                excludeEmail={currentUserEmail}
              />
            </div>

            {/* Message */}
            <Textarea
              ref={textareaRef}
              placeholder="Why do they deserve this award? 🎉"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="text-xs min-h-[56px] resize-none"
              rows={2}
            />

            {/* Actions */}
            <div className="flex items-center gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-brand-grey"
                onClick={() => {
                  setShowCompose(false);
                  setMessage("");
                  setRecipientEmail("");
                  setRecipientName("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-brand-blue hover:bg-brand-blue/90 text-white text-xs"
                disabled={isSending || !message.trim() || !recipientEmail}
                onClick={handleSend}
              >
                {isSending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1" />
                )}
                {isSending ? "Awarding..." : "Send Award"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Feed */}
      {kudos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8 text-sm text-brand-grey"
        >
          <span className="text-3xl block mb-2">🏆</span>
          <p>No awards yet. Be the first to recognize a teammate!</p>
        </motion.div>
      ) : (
        kudos.map((k, i) => (
          <motion.div
            key={k.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
          >
            <KudosCard
              id={k.id}
              authorName={k.author?.displayName || "Unknown"}
              authorInitials={getInitials(k.author?.displayName || "?")}
              authorPhotoUrl={k.author?.photoUrl || `/api/directory/photo?userId=${encodeURIComponent(k.author?.id || "")}&name=${encodeURIComponent(k.author?.displayName || "?")}&size=48x48`}
              recipientName={k.recipient?.displayName || "Unknown"}
              message={k.content}
              likes={k.likes}
              reactions={k.reactions}
              myReactions={k.myReactions}
              onReact={async (reaction) => {
                await toggleReaction(k.id, reaction);
              }}
              createdAt={k.createdAt}
              badge={k.badge}
            />
          </motion.div>
        ))
      )}
    </div>
  );
}
