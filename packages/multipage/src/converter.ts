import { Data } from "@measured/puck";

/**
 * Converts a collection of page Data into a single Data document for Puck.
 */
export function collectionToData(collection: Record<string, Data>): Data {
  const combinedZones: Record<string, any[]> = {};
  const pages = Object.keys(collection);

  pages.forEach((pageId) => {
    const pageData = collection[pageId];
    // The page's main content becomes a zone named after the pageId
    combinedZones[pageId] = pageData.content || [];

    // Copy over any existing zones from that page, prefixed with the pageId to avoid collisions
    if (pageData.zones) {
      Object.entries(pageData.zones).forEach(([zoneId, zoneItems]) => {
        combinedZones[`${pageId}:${zoneId}`] = zoneItems;
      });
    }
  });

  return {
    content: [], // root content is empty because we use DropZones
    root: {
      props: {
        pages, // Provide the list of pages to the root component
      } as any,
    },
    zones: combinedZones,
  };
}

/**
 * Reconstructs the page collection from the single Data document returned by Puck.
 */
export function dataToCollection(
  newData: Data,
  originalCollection: Record<string, Data>
): Record<string, Data> {
  const newCollection: Record<string, Data> = {};
  // Retrieve the list of pages. If it wasn't preserved, fallback to originalCollection keys
  const pages =
    (newData.root?.props as any)?.pages || Object.keys(originalCollection);

  pages.forEach((pageId: string) => {
    // Reconstruct each page's data
    const pageContent = newData.zones?.[pageId] || [];

    // Extract inner zones for this page
    const pageZones: Record<string, any[]> = {};
    if (newData.zones) {
      Object.entries(newData.zones).forEach(([zoneId, zoneItems]) => {
        if (zoneId.startsWith(`${pageId}:`)) {
          const originalZoneId = zoneId.substring(pageId.length + 1);
          pageZones[originalZoneId] = zoneItems;
        }
      });
    }

    newCollection[pageId] = {
      ...originalCollection[pageId], // preserve original root props
      content: pageContent,
      zones: pageZones,
    };
  });

  return newCollection;
}
