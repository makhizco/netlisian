import { Overrides } from "@netlisian/softconfig/puck";
import { map, hydrateMapTransform } from "./map-soft-fields";

export const softConfigOverrides: Overrides = {
    map,
    hydrateMapTransform
};
