"use client";
import {
  ComponentConfig,
  Config,
  Field,
  Fields,
  Label,
} from "@puckeditor/core";
import {
  BuilderConfig,
  BuilderComponentConfig,
} from "../../types/BuilderConfig";
import { getRootProps } from "../get-root-props";
import {
  generateDynamicFieldOptions,
  generateFieldOptions,
} from "./generate-field-options";
import {
  getArrayBasePath,
  getArrayItemSubPath,
  isArrayMappingPath,
} from "../array-field-utils";

import { ErrorBoundary } from "../../components/error-boundary";
import { AppStore, Status } from "../../store";
import type { CustomFields } from "../../types/SoftFields";

type BuilderSelectors = {
  getState: () => Status;
  getEditingComponent: () => string | null;
  getEditingDependents: () => Set<string>;
  getEditableComponentIds: () => Set<string>;
};

/* Generates builder soft config
 *  - Update each component config to map the soft fields to component fields
 *  - Add resolvePermissions to lock non-editable components
 */
export const buildBaseComponents = (
  config: Config,
  overrides: AppStore["overrides"],
  customFields: CustomFields,
  selectors: BuilderSelectors,
): Config["components"] => {
  const {
    getState,
    getEditingComponent,
    getEditingDependents,
    getEditableComponentIds,
  } = selectors;

  return Object.entries({
    ...config.components,
  }).reduce(
    (acc, [name, component]) => {
      const tempComponent: ComponentConfig<BuilderComponentConfig> = {
        ...component,
        async resolvePermissions(data, params) {
          const state = getState();
          if (
            state === "ready" ||
            state === "cancelling" ||
            state === "inspecting"
          ) {
            return component.resolvePermissions?.(data, params) ?? {};
          }
          const editingComponent = getEditingComponent();
          const dependents = getEditingDependents();
          return { insert: name !== editingComponent && !dependents.has(name) };
        },
        async resolveFields(data, params) {
          const state = getState();
          const baseFields = (
            component.resolveFields
              ? await component.resolveFields(data, params)
              : component.fields || {}
          ) as Record<string, Field>;

          if (state !== "building" && state !== "remodeling") {
            return baseFields as Fields;
          }

          if (!getEditableComponentIds().has(data.props.id)) {
            return {
              _placeholder: {
                type: "custom",
                render: () => (
                  <div
                    style={{
                      color: "#4b0082",
                      fontWeight: "bold",
                      padding: 8,
                      backgroundColor: "rgba(255,255,255,0.95)",
                      border: "2px solid #dc143c",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      borderRadius: 8,
                      fontSize: "0.85rem",
                      lineHeight: 1.4,
                      whiteSpace: "pre-wrap",
                      textAlign: "center",
                    }}
                  >
                    This component is outside of the selected editable component
                    list for{" "}
                    <strong style={{ color: "#dc143c" }}>{state}</strong>
                  </div>
                ),
              },
            };
          }

          let fields: Record<string, Field> = {};

          if (!fields._slot) {
            const slotFields = Object.entries(params.fields).filter(
              ([_, field]) => field.type === "slot",
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
                              (s: { slot: string }) => s.slot === fieldName,
                            ),
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

          const defaultFields = baseFields;

          if (!fields._map || params.changed._map) {
            const rootProps = getRootProps(params.appState);
            const fromOptions = generateDynamicFieldOptions(
              rootProps?._fields || [],
              rootProps?._fieldSettings || {},
              customFields,
            );
            const toOptionsFields = (
              component.resolveFields && data.props?._map
                ? await component.resolveFields(
                    { ...data, props: { ...data.props, _map: undefined } },
                    params,
                  )
                : defaultFields
            ) as Record<string, Field>;

            const toOptions = generateFieldOptions(toOptionsFields);

            fields._map = overrides.map
              ? {
                  type: "custom",
                  render: ({ value, onChange, id }) => {
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
              : (() => {
                  // Build default value sub-fields from target array's arrayFields
                  const mapEntries = data.props?._map || [];
                  const toPaths = mapEntries.flatMap((entry) =>
                    Array.isArray(entry.to)
                      ? entry.to
                      : entry.to
                        ? [entry.to]
                        : [],
                  );
                  const toPath = toPaths.find(
                    (path) =>
                      typeof path === "string" && isArrayMappingPath(path),
                  ) as string | undefined;
                  const arrayBaseName = toPath
                    ? getArrayBasePath(toPath)
                    : null;
                  const targetArrayField = arrayBaseName
                    ? defaultFields[arrayBaseName]
                    : null;
                  const mappedSubProps = new Set<string>();

                  if (arrayBaseName) {
                    toPaths.forEach((path) => {
                      if (typeof path !== "string") return;
                      if (getArrayBasePath(path) !== arrayBaseName) return;
                      const subProp = getArrayItemSubPath(path);
                      if (subProp) mappedSubProps.add(subProp);
                    });
                  }

                  // Build objectFields from the target array's arrayFields (primitive sub-fields only)
                  const defaultValueFields: Record<string, Field> = {};
                  if (
                    targetArrayField &&
                    targetArrayField.type === "array" &&
                    (targetArrayField as any).arrayFields
                  ) {
                    const arrayFields = (targetArrayField as any)
                      .arrayFields as Record<string, Field>;

                    Object.entries(arrayFields).forEach(([key, fld]) => {
                      // Skip the mapped field itself — it gets its value from the mapping
                      if (mappedSubProps.has(key)) return;
                      // Only include primitive fields
                      if (
                        fld.type === "array" ||
                        fld.type === "object" ||
                        fld.type === "slot"
                      )
                        return;
                      defaultValueFields[key] = {
                        ...fld,
                        label: fld.label || key,
                      };
                    });
                  }

                  const baseArrayFields: Record<string, Field> = {
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
                        ...toOptions.map(
                          ({
                            label,
                            value,
                          }: {
                            label: string;
                            value: string;
                          }) => ({
                            label,
                            value,
                          }),
                        ),
                      ],
                    },
                  };
                  if (
                    arrayBaseName &&
                    Object.keys(defaultValueFields).length > 0
                  ) {
                    baseArrayFields.unmappedArrayItemDefaultValues = {
                      type: "object",
                      label: "Default Item Values",
                      objectFields: defaultValueFields,
                    } as Field;
                  }

                  return {
                    type: "array" as const,
                    label: "Dynamic Field Map",
                    arrayFields: baseArrayFields,
                  };
                })();
          }

          fields = {
            ...fields,
            ...defaultFields,
          } as Record<string, Field>;

          return fields as Fields;
        },
        resolveData: ({ props }, { lastData }) => {
          // Migrate string default values to objects if needed (from old textarea UI)
          // and ensure they are objects for Puck's object field to avoid crashes.
          const _map = (props._map || []).map((item) => {
            const newItem = { ...item };
            if (typeof newItem.unmappedArrayItemDefaultValues === "string") {
              try {
                newItem.unmappedArrayItemDefaultValues = JSON.parse(
                  newItem.unmappedArrayItemDefaultValues,
                );
              } catch (e) {
                newItem.unmappedArrayItemDefaultValues = {};
              }
            } else if (!newItem.unmappedArrayItemDefaultValues) {
              newItem.unmappedArrayItemDefaultValues = {};
            }
            return newItem;
          });

          const readOnlyFields = _map.flatMap((item) => item.to);

          // Also mark parent array fields as read-only when any child
          // item property is mapped (e.g. items[].imageUrl → items)
          const readOnlyArrayBases = readOnlyFields
            .filter((field): field is string => typeof field === "string")
            .map(getArrayBasePath)
            .filter((base): base is string => base !== null);

          // Calculate new readOnly object
          const currentReadOnly = [
            ...readOnlyFields.map((f) => String(f)),
            ...readOnlyArrayBases,
          ].reduce(
            (acc, field) => ({ ...acc, [field]: true }),
            {} as Record<string, boolean>,
          );

          // To ensure we clear readOnly states that were removed, we need to set them to false
          const lastReadOnly = lastData?.readOnly || {};
          const nextReadOnly: Record<string, boolean> = { ...currentReadOnly };
          for (const key of Object.keys(lastReadOnly)) {
            if (!currentReadOnly[key]) {
              nextReadOnly[key] = false;
            }
          }

          return {
            props: { ...props, _map },
            readOnly: nextReadOnly,
          };
        },
        render: (props) => {
          return <ErrorBoundary>{component.render(props)}</ErrorBoundary>;
        },
      };

      acc[name] = tempComponent;
      return acc;
    },
    {} as Config["components"],
  );
};
