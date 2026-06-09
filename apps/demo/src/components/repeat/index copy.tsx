// import { AutoField, ComponentConfig, Fields, WithId, WithPuckProps, createUsePuck } from "@puckeditor/core";
// import React, { useMemo, useState, useEffect } from "react";
// import isDeepEqual from "fast-deep-equal";
// import { ContainerShell } from "../container/useContainerShell";
// import { containerElements } from "../container/container-elements";
// import { leafElements } from "../container/leaf-elements";
// import { buildAttributeValueField } from "../container/build-attribute-value-fields";

// export type RepeatItem = Record<string, unknown>;
// export interface RepeatProps {
//   component: string;
//   items: RepeatItem[];
//   // Container-like properties (without slots)
//   element?: string;
//   attributes?: Array<{ key: string; valueType: string }>;
//   values?: Record<string, unknown>;
//   [key: string]: unknown; // Dynamic slot props
// }

// interface CustomFieldProps {
//   value: unknown;
//   onChange: (value: unknown) => void;
//   id: string;
// }

// const useCustomPuck = createUsePuck();
// const FALLBACK_CATEGORY = "Other Components";

// // --- Utility Hooks ---
// // (Remove this if you already import useDebounce from elsewhere in your app)
// function useDebounce<T>(value: T, delay: number): T {
//   const [debouncedValue, setDebouncedValue] = useState<T>(value);
//   useEffect(() => {
//     const timer = setTimeout(() => setDebouncedValue(value), delay);
//     return () => clearTimeout(timer);
//   }, [value, delay]);
//   return debouncedValue;
// }

// const getComponentLabel = (key: string, comp?: ComponentConfig) =>
//   (typeof comp?.label === "string" && comp.label.trim()) ? comp.label : key;

// const filterRepeatableFields = (fields: Fields = {}): Fields =>
//   Object.fromEntries(
//     Object.entries(fields).filter(([k, v]) => k !== "id" && k !== "editMode" && v.type !== "slot")
//   );

// /**
//  * Calculate a flat list of changed items by comparing with previous state
//  * using fast-deep-equal for accurate change detection
//  */
// const calculateChangedItems = (
//   currentItems: RepeatItem[],
//   previousItems: RepeatItem[] | undefined
// ): Record<string, boolean> => {
//   const changed: Record<string, boolean> = {};

//   if (!previousItems || previousItems.length === 0) {
//     // All items are new
//     currentItems.forEach((_, index) => {
//       changed[`items[${index}]`] = true;
//     });
//     return changed;
//   }

//   // Compare each item using deep equality
//   currentItems.forEach((item, index) => {
//     const prevItem = previousItems[index];
//     if (!isDeepEqual(item, prevItem)) {
//       changed[`items[${index}]`] = true;
//     }
//   });

//   // Mark removed items
//   if (currentItems.length < previousItems.length) {
//     for (let i = currentItems.length; i < previousItems.length; i++) {
//       changed[`items[${i}]`] = false; // Removed
//     }
//   }

//   return changed;
// };

// // --- 1. Optimized Registry Hook ---
// const useRepeatRegistry = () => {
//   const config = useCustomPuck((s) => s.config);

//   const groupedOptions = useMemo(() => {
//     const groups: Record<string, { key: string; label: string }[]> = {};
//     const catMap = new Map<string, string>();

//     Object.entries(config.categories || {}).forEach(([catKey, cat]) => {
//       (cat.components || []).forEach(compKey => catMap.set(compKey, cat.title || catKey));
//     });

//     Object.entries(config.components).forEach(([key, comp]) => {
//       if (key === "repeat") return;
//       const cat = catMap.get(key) || FALLBACK_CATEGORY;
//       if (!groups[cat]) groups[cat] = [];
//       groups[cat].push({ key, label: getComponentLabel(key, comp) });
//     });

//     return groups;
//   }, [config]);

//   return { components: config.components, groupedOptions };
// };

// // --- 2. Searchable Picker ---
// const ComponentPickerField = ({ value, onChange, id }: CustomFieldProps) => {
//   const { groupedOptions } = useRepeatRegistry();
//   const [searchQuery, setSearchQuery] = useState("");

//   const filteredGroups = useMemo(() => {
//     if (!searchQuery.trim()) return groupedOptions;

//     const lowerQuery = searchQuery.toLowerCase();
//     const filtered: Record<string, { key: string; label: string }[]> = {};

//     Object.entries(groupedOptions).forEach(([cat, opts]) => {
//       const matches = opts.filter((o) => o.label.toLowerCase().includes(lowerQuery));
//       if (matches.length > 0) filtered[cat] = matches;
//     });

//     return filtered;
//   }, [groupedOptions, searchQuery]);

//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
//       <input
//         type="text"
//         placeholder="Search components..."
//         value={searchQuery}
//         onChange={(e) => setSearchQuery(e.target.value)}
//         style={{
//           width: "100%", padding: "8px", borderRadius: "6px",
//           border: "1px solid #e4e4e7", background: "#f4f4f5",
//           fontSize: "13px", color: "#09090b"
//         }}
//       />
//       <select
//         id={id}
//         title="Select component"
//         value={value}
//         onChange={(e) => onChange(e.target.value)}
//         style={{
//           width: "100%", padding: "8px", borderRadius: "6px",
//           border: "1px solid #e4e4e7", background: "#fff",
//           fontSize: "14px", color: "#09090b", cursor: "pointer",
//         }}
//       >
//         <option value="" disabled>Select a component</option>
//         {Object.entries(filteredGroups).map(([category, options]) => (
//           <optgroup key={category} label={category}>
//             {options.map((opt) => (
//               <option key={opt.key} value={opt.key}>{opt.label}</option>
//             ))}
//           </optgroup>
//         ))}
//       </select>
//     </div>
//   );
// };

// // --- 3. Optimized Items Field ---
// const RepeatItemsField = ({ value, onChange, id }: CustomFieldProps) => {
//   const { components } = useRepeatRegistry();
//   const selectedKey = useCustomPuck((s) => s.selectedItem?.props?.component as string | undefined);
//   const appState = useCustomPuck((s) => s.appState);
//   const [repeatableFields, setRepeatableFields] = useState<Fields>({});
//   const [previousItems, setPreviousItems] = useState<RepeatItem[] | undefined>();
//   const selectedComponent = selectedKey ? components[selectedKey] : undefined;

//   // FIX: Just pass the object reference directly to useDebounce without stringifying
//   const firstItem = value?.[0];
//   const debouncedFirstItem = useDebounce(firstItem, 100);

//   useEffect(() => {
//     if (!selectedComponent) {
//       setRepeatableFields({});
//       return;
//     }

//     let isMounted = true;

//     const computeFields = async () => {
//       try {
//         // Calculate which items have changed using deep equality
//         const currentItems = (value as RepeatItem[]) || [];
//         const changedItems = calculateChangedItems(currentItems, previousItems);

//         // FIX: Reverted to the original working condition, just using the debounced item
//         if (selectedComponent.resolveFields && debouncedFirstItem) {
//           const resolved = await selectedComponent.resolveFields(
//             { props: debouncedFirstItem },
//             { appState, fields: (selectedComponent.fields || {}) as Fields, changed: changedItems } as any
//           );
//           if (isMounted) setRepeatableFields(filterRepeatableFields(resolved));
//         } else {
//           if (isMounted) setRepeatableFields(filterRepeatableFields(selectedComponent.fields as Fields));
//         }

//         // Store current items as previous for next comparison
//         if (isMounted) setPreviousItems(currentItems);
//       } catch (error) {
//         console.error("Failed to resolve fields:", error);
//         if (isMounted) setRepeatableFields(filterRepeatableFields(selectedComponent.fields as Fields));
//       }
//     };

//     computeFields();

//     return () => {
//       isMounted = false;
//     };
//   }, [selectedComponent, debouncedFirstItem]); // Depend safely on the debounced object

//   if (!selectedKey || !selectedComponent) {
//     return <div style={{ fontSize: "14px", color: "#71717a" }}>Select a component to configure items.</div>;
//   }

//   return (
//     <AutoField
//       id={id}
//       value={value || []}
//       onChange={onChange}
//       field={{
//         type: "array",
//         arrayFields: repeatableFields,
//         defaultItemProps: Object.fromEntries(
//           Object.entries(selectedComponent.defaultProps || {})
//         ),
//       }}
//     />
//   );
// };

// // --- 4. Renderer ---
// const RepeatRenderer = React.memo(({ component: selectedKey, items, puck, id, element = "div", attributes, values }: WithId<WithPuckProps<RepeatProps>>) => {
//   const { components } = useRepeatRegistry();

//   if (!selectedKey || !items?.length) return <div style={{ fontSize: "14px", color: "#71717a" }}>Select a valid component to render items.</div>;

//   const selectedComponent = components?.[selectedKey];
//   if (!selectedComponent?.render) return <div style={{ fontSize: "14px", color: "#71717a" }}>Select a valid component to render items.</div>;

//   const childFields = (selectedComponent.fields || {}) as Fields;
//   const hasSlots = Object.values(childFields).some((fieldConfig) => fieldConfig.type === "slot");

//   if (hasSlots) {
//     return (
//       <div style={{ fontSize: "14px", color: "#ef4444", background: "#fef2f2", padding: "1rem", border: "1px dashed #ef4444", borderRadius: "0.375rem" }}>
//         <strong>Configuration Error:</strong> Components with slots enabled are not allowed in the Repeat component. Please select a simpler component.
//       </div>
//     );
//   }

//   return (
//     <ContainerShell
//       element={element}
//       attributes={attributes}
//       values={values}
//       dragRef={puck.dragRef}
//     >
//       {items.map((item: RepeatItem, index: number) => {
//         const itemId = item.id || `${id}-${selectedKey}-${index}`;
//         const mergedProps: WithId<WithPuckProps<RepeatProps>> = {
//           ...(selectedComponent.defaultProps || {}),
//           ...item,
//           puck,
//           id: itemId,
//         } as any; // Cast needed for Puck's prop merging
//         return <React.Fragment key={itemId}>{selectedComponent.render(mergedProps)}</React.Fragment>;
//       })}
//     </ContainerShell>
//   );
// });

// export const Repeat: ComponentConfig<RepeatProps> = {
//   label: "Repeat",
//   defaultProps: { component: "", items: [], element: "div", attributes: [], values: {} },
//   inline: true,
//   fields: {
//     element: {
//       type: "select",
//       label: "Container Element",
//       options: [...containerElements, ...leafElements]
//         .sort((a, b) => a.localeCompare(b))
//         .map((el) => ({
//           label: el.toUpperCase(),
//           value: el,
//         })),
//     },
//     attributes: {
//       type: "array",
//       defaultItemProps: {
//         key: "className",
//         valueType: "string",
//       },
//       getItemSummary(item) {
//         return `${item.key}: ${item.valueType}`;
//       },
//       arrayFields: {
//         key: { type: "text", label: "Attribute Name" },
//         valueType: {
//           type: "select",
//           label: "Attribute Type",
//           options: [
//             { label: "Text", value: "string" },
//             { label: "Number", value: "number" },
//             { label: "Boolean", value: "boolean" },
//             { label: "Key/Value", value: "key-value" },
//           ],
//         },
//       },
//     },
//     values: {
//       type: "object",
//       label: "Attribute Values",
//       objectFields: {},
//     },
//     component: {
//       type: "custom", label: "Repeated Component",
//       render: ({ value, onChange, id }) => <ComponentPickerField value={value || ""} onChange={onChange} id={id} />,
//     },
//     items: {
//       type: "custom", label: "Items",
//       render: ({ value, onChange, id }) => <RepeatItemsField value={value || []} onChange={onChange} id={id} />,
//     }
//   },
//   resolveFields: ({ props }, { fields, changed }) => {
//     if (changed.attributes || changed.values || !fields.values) {
//       fields.values = {
//         type: "object",
//         label: "Attribute Values",
//         objectFields: (props.attributes ?? []).reduce(
//           (
//             acc: Record<string, import("@puckeditor/core").Field>,
//             { key, valueType }: { key: string; valueType: string }
//           ) => {
//             if (!key) return acc;
//             const field = buildAttributeValueField(key, valueType);
//             if (field !== undefined) {
//               acc[key] = field as import("@puckeditor/core").Field;
//             }
//             return acc;
//           },
//           {}
//         ),
//       };
//       return fields;
//     }
//     return fields;
//   },
//   render: (props) => <RepeatRenderer {...props} />,
// };
