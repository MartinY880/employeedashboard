// ProConnect — Resources Page
// Company resources, quick links, and helpful tools

"use client";

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

interface ResourceLink {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  category: string;
  color: string;
}

const RESOURCES: ResourceLink[] = [
  {
    title: "Employee Handbook",
    description: "Company policies, procedures, and guidelines",
    icon: BookOpen,
    href: "#",
    category: "HR & Policies",
    color: "bg-blue-500",
  },
  {
    title: "Benefits Portal",
    description: "Health insurance, 401k, and employee benefits",
    icon: Heart,
    href: "#",
    category: "HR & Policies",
    color: "bg-pink-500",
  },
  {
    title: "Compliance Training",
    description: "Required annual compliance and regulatory courses",
    icon: Shield,
    href: "#",
    category: "Training",
    color: "bg-amber-500",
  },
  {
    title: "Learning Portal",
    description: "Professional development and skill-building courses",
    icon: GraduationCap,
    href: "#",
    category: "Training",
    color: "bg-green-500",
  },
  {
    title: "IT Help Desk",
    description: "Submit tickets for technical support and questions",
    icon: Headphones,
    href: "#",
    category: "Support",
    color: "bg-purple-500",
  },
  {
    title: "Document Templates",
    description: "Loan forms, disclosures, and processing templates",
    icon: FileText,
    href: "#",
    category: "Documents",
    color: "bg-brand-blue",
  },
  {
    title: "Compliance Resources",
    description: "RESPA, TILA, and regulatory reference materials",
    icon: Scale,
    href: "#",
    category: "Documents",
    color: "bg-teal-500",
  },
  {
    title: "Office Directory",
    description: "Branch locations, hours, and contact information",
    icon: Building2,
    href: "#",
    category: "Company",
    color: "bg-indigo-500",
  },
  {
    title: "Team Org Chart",
    description: "Interactive organizational chart",
    icon: Users2,
    href: "/directory",
    category: "Company",
    color: "bg-sky-500",
  },
];

const categories = [...new Set(RESOURCES.map((r) => r.category))];

export default function ResourcesPage() {
  const { playClick } = useSounds();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[1200px] mx-auto px-6 py-6 space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
        <p className="text-sm text-brand-grey mt-0.5">
          Quick links to company tools, training, and documents
        </p>
      </div>

      {/* Resource Grid by Category */}
      {categories.map((category, catIdx) => (
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
            {RESOURCES.filter((r) => r.category === category).map((resource, i) => {
              const Icon = resource.icon;
              return (
                <motion.a
                  key={resource.title}
                  href={resource.href}
                  onClick={() => playClick()}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: catIdx * 0.08 + i * 0.04 }}
                  className="group flex items-start gap-3.5 bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-brand-blue/30 transition-all"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${resource.color} text-white shrink-0 group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-brand-blue transition-colors">
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
