import { ComponentData, Content, Data } from "@measured/puck";
import { PageItem } from "./MultipageRoot";

/**
 * Converts a collection of individual page data objects into a single multipage Data object for Puck.
 */
export const collectionToPuckData = (
  collection: Record<string, Data>,
  pagesList: PageItem[],
  { collectionName = "collection", pageName = "page" }: { collectionName?: string, pageName?: string } = {}
): Data => {
  const combinedZones: Record<string, Content> = {};

  pagesList.forEach((page) => {
    const pageData = collection[page.id];

    // Copy over any existing inner zones directly without prefixing, as component IDs are unique
    if (pageData?.zones) {
      Object.entries(pageData.zones).forEach(([zoneId, zoneItems]) => {
        combinedZones[zoneId] = zoneItems;
      });
    }
  });

  return {
    content: [],
    root: {
      props: {
        [collectionName]: pagesList.map((page) => ({
          ...page,
          [pageName]: collection[page.id]?.content || [],
        })),
      } as Record<string, unknown>,
    },
    zones: combinedZones,
  };
};

/**
 * Recursively find all component IDs within an array of items
 */
const extractComponentIds = (items: Content): string[] => {
  const ids: string[] = [];
  if (!Array.isArray(items)) return ids;

  for (const item of items) {
    if (item.props.id) {
      ids.push(item.props.id as string);
    }
  }
  return ids;
};

/**
 * Converts a single multipage Data object back into a collection of individual page data objects.
 */
export const puckDataToCollection = (
  newData: Data,
  originalCollection: Record<string, Data>,
  { collectionName = "collection", pageName = "page" }: { collectionName?: string, pageName?: string } = {}
): Record<string, Data> => {
  const changedPages: Record<string, Data> = {};

  // Extract pages from root props if available
  const pagesList: PageItem[] =
    ((newData.root?.props as Record<string, unknown>)?.[collectionName] as PageItem[]) || [];

  pagesList.forEach((page, index) => {
    const pageId = page.id;
    // Reconstruct each page's data from the inline slot prop
    const pageContent = (page as any)[pageName] || [];

    // Extract inner zones for this page recursively
    const pageZones: Record<string, Content> = {};
    const pendingIds = extractComponentIds(pageContent);
    const processedIds = new Set<string>();

    while (pendingIds.length > 0) {
      const id = pendingIds.shift()!;
      if (processedIds.has(id)) continue;
      processedIds.add(id);

      if (newData.zones) {
        Object.entries(newData.zones).forEach(([zoneId, zoneItems]) => {
          if (zoneId.startsWith(`${id}:`)) {
            pageZones[zoneId] = zoneItems;
            pendingIds.push(...extractComponentIds(zoneItems));
          }
        });
      }
    }

    const originalPage = originalCollection[pageId] || { root: {} };
    const reconstructedPage = {
      ...originalPage,
      content: pageContent,
      zones: pageZones,
    };

    // Compare with the original page to see if it changed
    if (JSON.stringify(reconstructedPage) !== JSON.stringify(originalPage)) {
      changedPages[pageId] = reconstructedPage;
    }
  });

  return changedPages;
};
