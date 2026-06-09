export const findZonesForArea = (zones: any, area: string) => {
  return Object.keys(zones || {}).filter(
    (zone) => zone.split(":")[0] === area
  );
};
