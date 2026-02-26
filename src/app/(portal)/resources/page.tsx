// ProConnect — Resources Page
// Company resources, quick links, and helpful tools

"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Headphones,
  Shield,
  ExternalLink,
  Building2,
  Scale,
  Users2,
  Heart,
} from "lucide-react";
import { useSounds } from "@/components/shared/SoundProvider";
import { Skeleton } from "@/components/ui/skeleton";

interface ResourceLink {
  id: string;
  title: string;
  description: string;
  href: string;
  category: string;
  sortOrder: number;
  active: boolean;
}

const ICON_BY_CATEGORY: Record<string, React.ComponentType<{ className?: string }>> = {
  "HR & Policies": Heart,
  Training: GraduationCap,
  Support: Headphones,
  Documents: FileText,
  Company: Building2,
  Compliance: Shield,
  Directory: Users2,
  Legal: Scale,
};

const COLOR_CLASSES = [
  "bg-brand-blue",
  "bg-purple-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-green-500",
  "bg-indigo-500",
  "bg-sky-500",
  "bg-pink-500",
];

function getIconForCategory(category: string) {
  return ICON_BY_CATEGORY[category] || BookOpen;
}

function getColorForCategory(category: string) {
  const sum = [...category].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLOR_CLASSES[sum % COLOR_CLASSES.length];
}

function isExternalUrl(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

export default function ResourcesPage() {
  const { playClick } = useSounds();
  const [resources, setResources] = useState<ResourceLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchResources() {
      try {
        const response = await fetch("/api/resources", { cache: "no-store" });
        const data = await response.json();
        setResources((data.resources || []) as ResourceLink[]);
      } catch {
        setResources([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchResources();
  }, []);

  const categories = useMemo(() => {
    const visible = resources
      .filter((resource) => resource.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return [...new Set(visible.map((resource) => resource.category))];
  }, [resources]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[1200px] mx-auto px-6 py-6 space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Resources</h1>
        <p className="text-sm text-brand-grey mt-0.5">
          Quick links to company tools, training, and documents
        </p>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[...Array(2)].map((_, idx) => (
            <div key={idx} className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(3)].map((__, cardIdx) => (
                  <Skeleton key={`${idx}-${cardIdx}`} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && categories.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-brand-grey">
          No resources are currently available.
        </div>
      )}

      {!isLoading && categories.map((category, catIdx) => (
        <motion.section
          key={category}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: catIdx * 0.08 }}
        >
          <h2 className="text-sm font-bold text-brand-blue uppercase tracking-wider mb-3">
            {category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {resources
              .filter((resource) => resource.active && resource.category === category)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((resource, i) => {
                const Icon = getIconForCategory(resource.category);
                const colorClass = getColorForCategory(resource.category);
                return (
                  <motion.a
                    key={resource.id}
                    href={resource.href}
                    target={isExternalUrl(resource.href) ? "_blank" : undefined}
                    rel={isExternalUrl(resource.href) ? "noopener noreferrer" : undefined}
                    onClick={() => playClick()}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: catIdx * 0.08 + i * 0.04 }}
                    className="group flex items-start gap-3.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:shadow-md hover:border-brand-blue/30 transition-all"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass} text-white shrink-0 group-hover:scale-105 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-brand-blue transition-colors">
                          {resource.title}
                        </span>
                        <ExternalLink className="w-3 h-3 text-brand-grey opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-brand-grey mt-0.5 leading-relaxed">
                        {resource.description}
                      </p>
                    </div>
                  </motion.a>
                );
              })}
          </div>
        </motion.section>
      ))}
    </motion.div>
  );
}
