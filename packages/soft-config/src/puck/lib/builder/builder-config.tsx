import { ComponentConfig, Config, Fields } from "@measured/puck";
import { BuilderConfig } from "../../types/BuilderConfig";
import { getRootProps } from "../get-root-props";
import { builderRootConfig } from "./root-config";
import {
  generateDynamicFieldOptions,
  generateFieldOptions,
} from "./generate-field-options";

import { ErrorBoundary } from "../../components/error-boundary";

/* Generates builder soft config
 *  - Update root to include: name, fields, fieldSettings, for soft component
 *  - Update each component config to map the soft fields to component fields
 */
export const builderConfig = (
  config: Config,
  editingComponent?: string
): BuilderConfig => ({
  root: builderRootConfig(config, editingComponent),
  components: Object.entries({
    ...config.components,
  }).reduce(
    (acc, [name, component]) => {
      if (!editingComponent || name !== editingComponent) {
        const tempComponent: ComponentConfig = {
          ...component,
          resolveFields(data, params) {
            let fields: Fields = {};

            if (!fields._slot) {
              const slotFields = Object.entries(params.fields).filter(
                ([_, field]) => field.type === "slot"
              );
              if (slotFields.length)
                fields._slot = {
                  type: "array",
                  label: "Enable Dropdown Slots",
                  getItemSummary(item, index) {
                    return item.slot || `Slot ${(index || 0) + 1}`;
                  },
                  arrayFields: {
                    slot: {
                      type: "select",
                      label: "Slot",
                      options: [
                        { label: "Select a slot", value: "" },
                        ...slotFields
                          .filter(
                            ([fieldName, field]) =>
                              field.type === "slot" &&
                              !(data.props?._slot || []).some(
                                (s: { slot: string }) => s.slot === fieldName
                              )
                          )
                          .map(([fieldName, field]) => ({
                            label: field.label || fieldName,
                            value: fieldName,
                          })),
                      ],
                    },
                    name: {
                      type: "text",
                      label: "Name",
                      placeholder: "Optional Slot Name",
                    },
                  },
                };
            }

            const defaultFields: Fields = component.resolveFields
              ? (component.resolveFields(data, params) as Fields<any>)
              : component.fields || {};

            if (!fields._map) {
              const rootProps = getRootProps(params.appState);

              fields._map = {
                type: "array",
                label: "Dynamic Field Map",
                arrayFields: {
                  from: {
                    type: "select",
                    label: "From",
                    options: [
                      { label: "Select a field", value: "" },
                      ...generateDynamicFieldOptions(
                        rootProps?._fields || [],
                        rootProps?._fieldSettings || {}
                      ),
                    ],
                  },
                  to: {
                    type: "select",
                    label: "To",
                    options: [
                      { label: "Select a field", value: "" },
                      ...generateFieldOptions(defaultFields, []),
                    ],
                  },
                } as any,
              };
            }

            fields = {
              ...fields,
              ...defaultFields,
            };

            return fields;
          },
          resolveData: ({ props }, {
            lastData
          }) => {
            const _map: { from: string; to: string }[] = props._map || [];

            const readOnlyFields = _map.flatMap((item) => item.to);

            if (_map.length) {
              return {
              props,
              readOnly: readOnlyFields.reduce(
                (acc, field) => ({ ...acc, [field]: true }),
                {}
              ) as any,
              };
            }
            
            const prevMap: { from: string; to: string }[] | undefined =
              lastData?.props?._map;
            if (prevMap && prevMap.length === 1) {
              const lastField = prevMap[0].to;
              return {
              props,
              readOnly: { [lastField]: false } as any,
              };
            }

            // Default: no readOnly fields
            return {
              props,
              readOnly: {} as any,
            };
          },
          render: (props) => {
            return <ErrorBoundary>{component.render(props)}</ErrorBoundary>;
          },
        };
        acc[name] = tempComponent;
      }
      return acc;
    },
    {} as Config["components"]
  ),
});
