import { AutoField, ComponentConfig, Config, Fields } from "@measured/puck";
import {
  BuilderConfig,
  BuilderComponentConfig,
} from "../../types/BuilderConfig";
import { getRootProps } from "../get-root-props";
import { builderRootConfig } from "./root-config";
import {
  generateDynamicFieldOptions,
  generateFieldOptions,
} from "./generate-field-options";

import { ErrorBoundary } from "../../components/error-boundary";
import { AppStore } from "../../store";

/* Generates builder soft config
 *  - Update root to include: name, fields, fieldSettings, for soft component
 *  - Update each component config to map the soft fields to component fields
 *  - Add resolvePermissions to lock non-editable components
 */
export const builderConfig = (
  config: Config,
  overrides: AppStore["overrides"],
  editingComponent?: string,
  showVersionFields: boolean = true,
  dependents?: Set<string>
): BuilderConfig => ({
  root: builderRootConfig(config, overrides, editingComponent, showVersionFields),
  components: Object.entries({
    ...config.components,
  }).reduce(
    (acc, [name, component]) => {
      const tempComponent: ComponentConfig<BuilderComponentConfig> = {
        ...component,
        permissions: {
          insert: editingComponent !== name && !dependents?.has(name)
        },
        async resolveFields(data, params) {
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

          const defaultFields: Fields<BuilderComponentConfig> =
            component.resolveFields
              ? await component.resolveFields(data, params)
              : component.fields || {};

          if (!fields._map) {
            const rootProps = getRootProps(params.appState);
            const fromOptions = generateDynamicFieldOptions(
              rootProps?._fields || [],
              rootProps?._fieldSettings || {}
            );
            const toOptionsFields = component.resolveFields && data.props?._map
              ? await component.resolveFields(
                { ...data, props: { ...data.props, _map: undefined } },
                params
              )
              : defaultFields;

            const toOptions = generateFieldOptions(toOptionsFields, [], "");

            fields._map = overrides.map
              ? {
                type: "custom",
                render: ({ value, onChange, id }) => {
                  // Need to update the to options whenever params change for map to pick up new possible props.

                  const toOptions = generateFieldOptions(defaultFields, []);
                  const rootProps = getRootProps(params.appState);

                  return overrides.map!({
                    rootProps,
                    value,
                    onChange,
                    id,
                    props: data.props || {},
                    fromOptions,
                    toOptions,
                  });
                },
              }
              : {
                type: "array",
                label: "Dynamic Field Map",
                arrayFields: {
                  from: {
                    type: "select",
                    label: "From",
                    options: [
                      { label: "Select a field", value: "" },
                      ...fromOptions.map(({ label, value }) => ({
                        label,
                        value,
                      })),
                    ],
                  },
                  to: {
                    type: "select",
                    label: "To",
                    options: [
                      { label: "Select a field", value: "" },
                      ...toOptions.map(({ label, value }) => ({
                        label,
                        value,
                      })),
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
        resolveData: ({ props }, { lastData }) => {
          const _map = props._map || [];

          const readOnlyFields = _map.flatMap((item) => item.to);

          if (_map.length) {
            return {
              props,
              readOnly: readOnlyFields.reduce(
                (acc, field) => ({ ...acc, [field!]: true }),
                {}
              ) as any,
            };
          }

          // Resetting the read-only props
          const prevMap = lastData?.props?._map;
          if (prevMap && prevMap.length === 1) {
            const lastField = prevMap[0].to;
            if (typeof lastField === "string") {
              return {
                props,
                readOnly: { [lastField]: false },
              };
            }
            if (Array.isArray(lastField)) {
              return {
                props,
                readOnly: lastField.reduce(
                  (acc, field) => ({ ...acc, [String(field)]: false }),
                  {}
                ) as any,
              };
            }
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
      return acc;
    },
    {} as Config["components"]
  ),
  categories: config.categories || {},
});
