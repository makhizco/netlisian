import { Metadata } from "next";
import resolvePuckPath from "../../lib/resolve-puck-path";
import { ClientPuckPage } from "./client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ puck: string[] }>;
}): Promise<Metadata> {
  const { puck = [] } = await params;
  const { isEdit, path } = resolvePuckPath(puck);

  if (isEdit) {
    return {
      title: "Editing: " + path,
    };
  }

  return {
    title: "",
  };
}

export default function PuckPage() {
  return <ClientPuckPage />;
}
