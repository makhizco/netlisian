"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { useDemoData } from "@/src/lib/use-demo-data";
import config from "@/src/config";
import resolvePuckPath from "@/src/lib/resolve-puck-path";
import { useEffect, useState } from "react";
import RenderPage from "./render";
import PuckEditor from "./editor";

const PageLoader = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-[90vh] flex-col items-center justify-center gap-3 p-4 text-slate-900"
  >
    <Loader2 className="animate-spin" size={24} />
  </div>
);

export const ClientPuckPage = () => {
  const [isClient, setIsClient] = useState(false);
  const params = useParams<{ puck: string[] }>();
  const pathname = usePathname();
  const { path, isEdit } = resolvePuckPath(params.puck || []);

  const {
    data,
    resolvedData,
    styles,
    softComponents,
    saveData,
    saveSoftComponents,
  } = useDemoData({ path, isEdit });

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <PageLoader />;
  }

  if (!isEdit && !Object.keys(data || {}).length) {
    return (
      <div className="flex min-h-[90vh] flex-col items-center justify-center gap-4 p-4 text-slate-900">
        <h2 className="text-xl font-semibold">Page not found</h2>
        <Link
          href={`${pathname}/edit`}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={18} />
          Create this page
        </Link>
      </div>
    );
  }

  return !isEdit ? (
    <RenderPage
      config={config}
      data={{ ...data, ...resolvedData }}
      styles={styles}
    />
  ) : (
    <PuckEditor
      data={data}
      saveData={saveData}
      saveSoftComponents={saveSoftComponents}
      softComponents={softComponents}
    />
  );
};
