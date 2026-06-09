"use client";

import React, { useState, useEffect } from "react";
import { Puck, Config, Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";

interface LiveEditorProps {
  config: Config;
  initialData: Data;
}

export default function LiveEditor({ config, initialData }: LiveEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"visual" | "source">("visual");
  const [data, setData] = useState<Data>(initialData);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-[500px] bg-gray-50 border rounded-lg animate-pulse" />
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden my-6 flex flex-col h-[600px]">
      <div className="bg-gray-100 border-b px-4 py-2 flex gap-4 text-sm font-medium text-gray-700">
        <button
          onClick={() => setView("visual")}
          className={`hover:text-black ${view === "visual" ? "text-black border-b-2 border-black -mb-2.5 pb-2" : "text-gray-500"}`}
        >
          Visual Editor
        </button>
        <button
          onClick={() => setView("source")}
          className={`hover:text-black ${view === "source" ? "text-black border-b-2 border-black -mb-2.5 pb-2" : "text-gray-500"}`}
        >
          Config JSON
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-white relative">
        {view === "visual" ? (
          <Puck config={config} data={data} onChange={setData} />
        ) : (
          <pre className="p-4 text-xs font-mono bg-gray-50 h-full overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
