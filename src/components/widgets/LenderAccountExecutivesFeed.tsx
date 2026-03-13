// ProConnect — LenderAccountExecutivesFeed Widget
// Read-only grouped list of lender account executives with optional search filtering

"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Mail, Phone, Smartphone, Users } from "lucide-react";

interface LenderAccountExecutive {
  id: string;
  lenderId: string;
  accountExecutiveName: string;
  workPhoneNumber: string;
  phoneExtension?: string | null;
  mobilePhoneNumber?: string | null;
  email: string;
  lender: { id: string; name: string; logoUrl: string | null; active: boolean };
}

interface Props {
  search?: string;
}

export function LenderAccountExecutivesFeed({ search = "" }: Props) {
  const [records, setRecords] = useState<LenderAccountExecutive[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch("/api/lender-account-executives", { cache: "no-store" });
        const data = await res.json();
        if (!mounted) return;
        setRecords(Array.isArray(data.records) ? data.records : []);
      } catch {
        if (mounted) setRecords([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim();

    // Filter records by search query
    const filtered = q
      ? records.filter((r) =>
          [r.accountExecutiveName, r.lender?.name, r.email, r.workPhoneNumber, r.mobilePhoneNumber, r.phoneExtension]
            .filter(Boolean)
            .some((field) => field!.toLowerCase().includes(q))
        )
      : records;

    const map = new Map<string, { lenderName: string; logoUrl: string | null; aes: LenderAccountExecutive[] }>();
    for (const record of filtered) {
      const key = record.lenderId;
      const current = map.get(key);
      if (current) {
        current.aes.push(record);
      } else {
        map.set(key, {
          lenderName: record.lender?.name || "Unknown Lender",
          logoUrl: record.lender?.logoUrl || null,
          aes: [record],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.lenderName.localeCompare(b.lenderName));
  }, [records, search]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-8 text-center">
        <Users className="w-8 h-8 mx-auto mb-2 text-brand-blue/30" />
        <p className="text-sm text-brand-grey">
          {search.trim() ? "No contacts match your search." : "No account executive contacts available yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map(({ lenderName, logoUrl, aes }) => (
        <div
          key={lenderName}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            {logoUrl ? (
              <div className="h-5 w-5 rounded overflow-hidden flex-shrink-0 flex items-center justify-center bg-white dark:bg-gray-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={lenderName} className="h-full w-full object-contain" />
              </div>
            ) : (
              <Building2 className="w-3.5 h-3.5 text-brand-blue" />
            )}
            <span className="text-xs font-semibold text-brand-blue uppercase tracking-wide truncate">{lenderName}</span>
          </div>
          <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {aes.map((ae) => (
              <div key={ae.id} className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/70 px-3 py-2.5">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{ae.accountExecutiveName}</p>
                <div className="mt-1 flex flex-col gap-1 text-xs text-brand-grey">
                  {ae.workPhoneNumber ? (
                    <a
                      href={`tel:${ae.workPhoneNumber}${ae.phoneExtension ? `;ext=${ae.phoneExtension}` : ""}`}
                      className="inline-flex items-center gap-1.5 hover:text-brand-blue transition-colors"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{ae.workPhoneNumber}</span>
                      {ae.phoneExtension ? (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          Ext. {ae.phoneExtension}
                        </span>
                      ) : null}
                    </a>
                  ) : null}
                  {ae.mobilePhoneNumber ? (
                    <a
                      href={`tel:${ae.mobilePhoneNumber}`}
                      className="inline-flex items-center gap-1.5 hover:text-brand-blue transition-colors"
                    >
                      <Smartphone className="w-3 h-3" />
                      <span>{ae.mobilePhoneNumber}</span>
                    </a>
                  ) : null}
                  {ae.email ? (
                    <a href={`mailto:${ae.email}`} className="inline-flex items-center gap-1.5 hover:text-brand-blue transition-colors truncate">
                      <Mail className="w-3 h-3" />
                      {ae.email}
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
