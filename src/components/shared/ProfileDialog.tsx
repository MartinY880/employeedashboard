"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Phone, Smartphone, Printer, X, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type DirectoryNode } from "@/hooks/useDirectory";
import { NMLSIcon } from "@/components/shared/icons/NMLSIcon";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */



export function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getPhotoUrl(
  user: { id: string; displayName: string; photoUrl?: string },
  size = 120
) {
  return `/api/directory/photo?userId=${encodeURIComponent(user.id)}&name=${encodeURIComponent(user.displayName)}&size=${size}x${size}`;
}

// All departments share the same neutral badge color.
const DEPT_COLOR = "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";

export function getDeptColor(_dept: string | null) {
  return DEPT_COLOR;
}

// Display title for a directory card. Branch members with no title are the
// managing partners those branches were created around, so they get
// "Managing Partner" rather than the generic "Team Member" fallback.
export function getDisplayTitle(
  jobTitle: string | null | undefined,
  isBranchMember = false
) {
  if (jobTitle?.trim()) return jobTitle;
  return isBranchMember ? "Managing Partner" : "Team Member";
}

// Methods used for both directory page, mention chips, and directory search within dashboard.  

/* ------------------------------------------------------------------ */
/* ProfileDialog                                                       */
/* ------------------------------------------------------------------ */

export function ProfileDialog({
  user,
  open,
  onClose,
  branchMemberIds,
}: {
  user: DirectoryNode | null;
  open: boolean;
  onClose: () => void;
  // IDs of users assigned to a branch (managing partners). When present and a
  // user has no title, they're shown as "Managing Partner" instead of "Team Member".
  branchMemberIds?: Set<string>;
}) {
  const [photoZoom, setPhotoZoom] = useState(false);
  const [expandedReports, setExpandedReports] = useState(false);

  useEffect(() => {
    if (!open) {
      setPhotoZoom(false);
      setExpandedReports(false);
    }
  }, [open, user]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Employee Profile</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center text-center pt-2 pb-4">
          <button
            type="button"
            onClick={() => setPhotoZoom(true)}
            className="relative group cursor-zoom-in mb-4 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
          >
            <Avatar className="h-20 w-20">
              <AvatarImage
                src={getPhotoUrl(user, 648)}
                alt={user.displayName}
                loading="lazy"
                decoding="async"
              />
              <AvatarFallback className="bg-brand-blue text-white text-xl font-bold">
                {getInitials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/10 transition-colors" />
          </button>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {user.displayName}
          </h3>
          {user.jobTitle && (
            <p className="text-sm text-brand-grey mt-0.5">{user.jobTitle}</p>
          )}
          {user.department && (
            <Badge
              className={`mt-2 text-xs font-medium ${getDeptColor(user.department)}`}
              variant="secondary"
            >
              {user.department}
            </Badge>
          )}
        </div>

        <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
          {user.mail && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-brand-blue shrink-0" />
              <a
                href={`mailto:${user.mail}`}
                className="text-brand-blue hover:underline truncate"
              >
                {user.mail}
              </a>
            </div>
          )}
          {user.officeLocation && (
            <div className="flex items-center gap-3 text-sm">
              <NMLSIcon className="w-4 h-4 text-brand-grey shrink-0" />
              <span className="text-gray-700 dark:text-gray-300">{user.officeLocation}</span>
            </div>
          )}
          {user.businessPhone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-brand-blue shrink-0" />
              <a href={`tel:${user.businessPhone.replace(/[^+\d]/g, "")}`} className="text-brand-blue hover:underline">{user.businessPhone}</a>
            </div>
          )}
          {user.mobilePhone && (
            <div className="flex items-center gap-3 text-sm">
              <Smartphone className="w-4 h-4 text-brand-blue shrink-0" />
              <a href={`tel:${user.mobilePhone.replace(/[^+\d]/g, "")}`} className="text-brand-blue hover:underline">{user.mobilePhone}</a>
            </div>
          )}
          {user.faxNumber && (
            <div className="flex items-center gap-3 text-sm">
              <Printer className="w-4 h-4 text-brand-blue shrink-0" />
              <a href={`tel:${user.faxNumber.replace(/[^+\d]/g, "")}`} className="text-brand-blue hover:underline">{user.faxNumber}</a>
            </div>
          )}
        </div>

        {user.directReports && user.directReports.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-2">
            <p className="text-xs font-semibold text-brand-grey uppercase tracking-wider mb-2">
              Direct Reports ({user.directReports.length})
            </p>
            <div className={`space-y-1.5 ${expandedReports ? "max-h-[40vh] overflow-y-auto pr-1" : ""}`}>
              {user.directReports
                .slice(0, expandedReports ? undefined : 5)
                .map((dr) => (
                  <div key={dr.id} className="flex items-center gap-2 text-sm py-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-[9px] font-semibold">
                        {getInitials(dr.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-gray-700 dark:text-gray-300 truncate">
                      {dr.displayName}
                    </span>
                    <span className="text-xs text-brand-grey ml-auto shrink-0">
                      {getDisplayTitle(dr.jobTitle, branchMemberIds?.has(dr.id))}
                    </span>
                  </div>
                ))}
            </div>
            {user.directReports.length > 5 && (
              <button
                type="button"
                onClick={() => setExpandedReports(!expandedReports)}
                className="mt-3 text-xs font-medium text-brand-blue hover:underline"
              >
                {expandedReports
                  ? "Show less"
                  : `View all ${user.directReports.length} direct reports`}
              </button>
            )}
          </div>
        )}

        {/* Full-size photo overlay — rendered INSIDE DialogContent so Radix's
            modal pointer-lock doesn't swallow the clicks (a body-portaled
            sibling gets pointer-events:none while the dialog is open). */}
        <AnimatePresence>
          {photoZoom && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-zoom-out"
              onClick={() => setPhotoZoom(false)}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={getPhotoUrl(user, 648)}
                  alt={user.displayName}
                  className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-2xl object-cover shadow-2xl ring-4 ring-white/20"
                />
                <button
                  type="button"
                  onClick={() => setPhotoZoom(false)}
                  className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* MentionChip                                                         */
/* Clickable @name chip that fetches user data and opens PersonLightbox */
/* ------------------------------------------------------------------ */

export function MentionChip({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<DirectoryNode | null>(null);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
      if (user) return;
      try {
        const res = await fetch(`/api/directory?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          setUser(data.user ?? null);
        }
      } catch {
        // silent
      }
    },
    [userId, user]
  );

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="text-brand-blue font-medium hover:underline cursor-pointer"
      >
        @{displayName}
      </button>
      <PersonLightbox
        user={user}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* PersonLightbox                                                      */
/* Full-screen overlay card — used by DirectorySearchBar + MentionChip */
/* ------------------------------------------------------------------ */

export function PersonLightbox({
  user,
  open,
  onClose,
  branchMemberIds,
}: {
  user: DirectoryNode | null;
  open: boolean;
  onClose: () => void;
  branchMemberIds?: Set<string>;
}) {
  const [photoZoom, setPhotoZoom] = useState(false);

  useEffect(() => {
    if (!open) setPhotoZoom(false);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header band */}
            <div className="bg-brand-blue px-6 pt-6 pb-10 relative">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Avatar overlap */}
            <div className="relative -mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setPhotoZoom(true)}
                className="relative group cursor-zoom-in rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                <Avatar className="h-16 w-16 ring-4 ring-white dark:ring-gray-900 shadow-lg">
                  {user && (
                    <AvatarImage
                      src={getPhotoUrl(user, 648)}
                      alt={user.displayName}
                    />
                  )}
                  <AvatarFallback className="bg-brand-blue text-white text-lg font-bold">
                    {user ? getInitials(user.displayName) : "…"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>
            </div>

            {/* Info */}
            <div className="px-6 pt-3 pb-6 text-center">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {user?.displayName ?? "Loading…"}
              </h2>
              <p className="text-sm text-brand-grey mt-0.5">
                {getDisplayTitle(user?.jobTitle, user ? branchMemberIds?.has(user.id) : false)}
              </p>

              {user && (
                <div className="mt-5 space-y-3 text-left">
                  {user.mail && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-brand-blue shrink-0" />
                      <a
                        href={`mailto:${user.mail}`}
                        className="text-brand-blue hover:underline truncate"
                      >
                        {user.mail}
                      </a>
                    </div>
                  )}
                  {user.officeLocation && (
                    <div className="flex items-center gap-3 text-sm">
                      <NMLSIcon className="w-4 h-4 text-brand-grey shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{user.officeLocation}</span>
                    </div>
                  )}
                  {user.businessPhone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-brand-blue shrink-0" />
                      <a href={`tel:${user.businessPhone.replace(/[^+\d]/g, "")}`} className="text-brand-blue hover:underline truncate">{user.businessPhone}</a>
                    </div>
                  )}
                  {user.mobilePhone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Smartphone className="w-4 h-4 text-brand-blue shrink-0" />
                      <a href={`tel:${user.mobilePhone.replace(/[^+\d]/g, "")}`} className="text-brand-blue hover:underline truncate">{user.mobilePhone}</a>
                    </div>
                  )}
                  {user.faxNumber && (
                    <div className="flex items-center gap-3 text-sm">
                      <Printer className="w-4 h-4 text-brand-blue shrink-0" />
                      <a href={`tel:${user.faxNumber.replace(/[^+\d]/g, "")}`} className="text-brand-blue hover:underline truncate">{user.faxNumber}</a>
                    </div>
                  )}
                  {user.directReports && user.directReports.length > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <Users className="w-4 h-4 text-brand-grey shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {user.directReports.length} direct report{user.directReports.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Full-size photo overlay */}
      {photoZoom && user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setPhotoZoom(false)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <img
              src={getPhotoUrl(user, 648)}
              alt={user.displayName}
              className="w-64 h-64 rounded-full object-cover ring-4 ring-white/20 shadow-2xl"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
