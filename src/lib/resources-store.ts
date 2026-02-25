import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";

export type ResourceKind = "link" | "document";

export interface ResourceDocumentMeta {
  storageName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface ResourceItem {
  id: string;
  title: string;
  description: string;
  href: string;
  category: string;
  sortOrder: number;
  active: boolean;
  kind?: ResourceKind;
  document?: ResourceDocumentMeta | null;
}

const DATA_DIR = join(process.cwd(), "src", "data");
const FILES_DIR = join(process.cwd(), "uploads", "resources");
const RESOURCES_FILE = join(DATA_DIR, "resources.json");

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/vnd.ms-excel",
]);

export const ALLOWED_DOCUMENT_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "csv"]);

export const DEFAULT_RESOURCES: ResourceItem[] = [
  {
    id: "res-1",
    title: "Employee Handbook",
    description: "Company policies, procedures, and guidelines",
    href: "#",
    category: "HR & Policies",
    sortOrder: 0,
    active: true,
    kind: "link",
  },
  {
    id: "res-2",
    title: "Benefits Portal",
    description: "Health insurance, 401k, and employee benefits",
    href: "#",
    category: "HR & Policies",
    sortOrder: 1,
    active: true,
    kind: "link",
  },
  {
    id: "res-3",
    title: "Compliance Training",
    description: "Required annual compliance and regulatory courses",
    href: "#",
    category: "Training",
    sortOrder: 2,
    active: true,
    kind: "link",
  },
  {
    id: "res-4",
    title: "Learning Portal",
    description: "Professional development and skill-building courses",
    href: "#",
    category: "Training",
    sortOrder: 3,
    active: true,
    kind: "link",
  },
  {
    id: "res-5",
    title: "IT Help Desk",
    description: "Submit tickets for technical support and questions",
    href: "#",
    category: "Support",
    sortOrder: 4,
    active: true,
    kind: "link",
  },
  {
    id: "res-6",
    title: "Document Templates",
    description: "Loan forms, disclosures, and processing templates",
    href: "#",
    category: "Documents",
    sortOrder: 5,
    active: true,
    kind: "link",
  },
  {
    id: "res-7",
    title: "Compliance Resources",
    description: "RESPA, TILA, and regulatory reference materials",
    href: "#",
    category: "Documents",
    sortOrder: 6,
    active: true,
    kind: "link",
  },
  {
    id: "res-8",
    title: "Office Directory",
    description: "Branch locations, hours, and contact information",
    href: "#",
    category: "Company",
    sortOrder: 7,
    active: true,
    kind: "link",
  },
  {
    id: "res-9",
    title: "Team Org Chart",
    description: "Interactive organizational chart",
    href: "/directory",
    category: "Company",
    sortOrder: 8,
    active: true,
    kind: "link",
  },
];

function normalizeResources(resources: ResourceItem[]): ResourceItem[] {
  return [...resources]
    .map((resource) => ({
      ...resource,
      kind: resource.kind ?? "link",
      document: resource.document ?? null,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function loadResources(): Promise<ResourceItem[]> {
  try {
    const raw = await readFile(RESOURCES_FILE, "utf-8");
    const parsed = JSON.parse(raw) as ResourceItem[];
    return normalizeResources(parsed);
  } catch {
    return normalizeResources(DEFAULT_RESOURCES);
  }
}

export async function saveResources(resources: ResourceItem[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(RESOURCES_FILE, JSON.stringify(normalizeResources(resources), null, 2), "utf-8");
}

export async function ensureResourceFilesDir(): Promise<void> {
  await mkdir(FILES_DIR, { recursive: true });
}

export function getResourceFilesDir() {
  return FILES_DIR;
}

export async function deleteStoredDocument(storageName: string): Promise<void> {
  try {
    await unlink(join(FILES_DIR, storageName));
  } catch {
    // Ignore missing files
  }
}

export function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function isAllowedDocument(fileName: string, mimeType: string): boolean {
  const extension = getFileExtension(fileName);
  if (!ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) return false;
  if (!mimeType) return true;
  return ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType);
}

export function inferMimeTypeFromFileName(fileName: string): string {
  const extension = getFileExtension(fileName);
  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "csv":
      return "text/csv";
    default:
      return "application/octet-stream";
  }
}

export function canInlineMimeType(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType === "text/csv" || mimeType === "application/vnd.ms-excel";
}
