// ProConnect — KudosFeed Widget
// Scrollable list of kudos cards + input to send new kudos (right column tab)

"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { KudosCard } from "./KudosCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Loader2, Sparkles } from "lucide-react";
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
  const { kudos, isLoading, sendKudos } = useKudos();
  const { playNotify, playSuccess, playClick } = useSounds();
  const [message, setMessage] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const prevCountRef = useRef(kudos.length);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      await sendKudos(recipientEmail, message.trim(), recipientName);
      playSuccess();
      setMessage("");
      setRecipientEmail("");
      setRecipientName("");
      setShowCompose(false);
    } catch {
      // Show inline error feedback
      playNotify();
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-gray-100">
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
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
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Send Kudos to a Teammate
        </Button>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-xl border border-brand-blue/20 shadow-sm p-3 space-y-2.5"
        >
            <div className="text-[11px] font-semibold text-brand-blue uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              New Kudos
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
              />
            </div>

            {/* Message */}
            <Textarea
              ref={textareaRef}
              placeholder="What did they do that was awesome?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="text-xs min-h-[60px] resize-none"
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
                {isSending ? "Sending..." : "Send Kudos"}
              </Button>
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
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-brand-blue/30" />
          <p>No kudos yet. Be the first to recognize a teammate!</p>
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
              authorName={k.author?.displayName || "Unknown"}
              authorInitials={getInitials(k.author?.displayName || "?")}
              authorPhotoUrl={k.author?.photoUrl || `/api/directory/photo?userId=${encodeURIComponent(k.author?.id || "")}&name=${encodeURIComponent(k.author?.displayName || "?")}&size=48x48`}
              recipientName={k.recipient?.displayName || "Unknown"}
              message={k.content}
              likes={k.likes}
              createdAt={k.createdAt}
            />
          </motion.div>
        ))
      )}
    </div>
  );
}
