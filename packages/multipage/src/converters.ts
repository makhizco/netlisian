import { Data } from "@puckeditor/core";
import { PageItem } from "./MultipageRoot";

/**
 * Converts a collection of individual page data objects into a single multipage Data object for Puck.
 */
export const collectionToPuckData = (
  collection: Record<string, Data>,
  pagesList: PageItem[]
): Data => {
  const combinedZones: Record<string, any[]> = {};

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
        pages: pagesList.map((page) => ({
          ...page,
          slot: collection[page.id]?.content || [],
        })),
        slots: pagesList.map(() => ({ slot: [] })), // keep this for backwards compat if it was used somewhere? Actually, wait, `pages: pagesList` now has `slot` inline, so we don't need `slots` but let's keep it if something depends on it.
      } as any,
    },
    zones: combinedZones,
  };
};

/**
 * Recursively find all component IDs within an array of items
 */
const extractComponentIds = (items: any[]): string[] => {
  const ids: string[] = [];
  if (!Array.isArray(items)) return ids;

  for (const item of items) {
    if (item?.props?.id) {
      ids.push(item.props.id);
    }
  }
  return ids;
};

/**
 * Converts a single multipage Data object back into a collection of individual page data objects.
 */
export const puckDataToCollection = (
  newData: Data,
  originalCollection: Record<string, Data>
): Record<string, Data> => {
  const changedPages: Record<string, Data> = {};

  // Extract pages from root props if available
  const pagesList: PageItem[] = (newData.root?.props as any)?.pages || [];

  pagesList.forEach((page, index) => {
    const pageId = page.id;
    // Reconstruct each page's data
    const pageContent = (page as any).slot || [];

    // Extract inner zones for this page recursively
    const pageZones: Record<string, any[]> = {};
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
