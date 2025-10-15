// import "./style.css";
import PuckEditor from "./editor";
import { Metadata } from "next";
import { Data } from "@measured/puck";
import resolvePuckPath from "../../lib/resolve-puck-path";

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

export default async function PuckPage({
  params,
}: {
  params: Promise<{ puck: string[] }>;
  searchParams?: Promise<{
    prompt?: string;
  }>;
}) {
  const { puck = [] } = await params;
  const { isEdit, path } = resolvePuckPath(puck);

  return <PuckEditor isEdit={isEdit} path={path} />;
}

export const dynamic = "force-dynamic";
