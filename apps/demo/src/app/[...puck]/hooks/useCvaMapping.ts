/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from "react";
import { twMerge } from "tailwind-merge";
import { Field } from "@puckeditor/core";

/** CVA configuration structure */
export interface CvaVariant {
  fieldId: string;
  classes: Record<string, string>;
}

export interface CvaConfig {
  base: string;
  variants: CvaVariant[];
}

/** Field option for CVA dialog */
export interface FieldOption {
  label: string;
  value: string;
  type: Field["type"] | "reference";
  options?: { label: string; value: string }[];
}

/**
 * Build a CVA transform function from config.
 * Takes array of input values and applies variant-based class logic.
 */
export const buildCvaTransform = (cfg: CvaConfig) => {
  return (inputs: unknown[]) => {
    const base = cfg.base || "";
    const variants = cfg.variants || [];
    const classes = [base];

    variants.forEach((v, i) => {
      if (!v.fieldId) return;
      const val = Array.isArray(inputs)
        ? inputs.at(i)
        : (inputs as Record<string, unknown> | undefined)?.[v.fieldId];
      const cls = v.classes?.[val as keyof typeof v.classes];
      if (cls) classes.push(cls);
    });

    return twMerge(classes.filter(Boolean).join(" "));
  };
};

/**
 * Extract eligible fields for CVA from root config.
 * Handles all field types and nested structures (arrays, objects, etc).
 */
export const getEligibleCvaFields = (
  fields: { name: string; type: string }[] = [],
  settings: Record<string, any> = {}
): FieldOption[] => {
  const options: FieldOption[] = [];

  const processField = (field: { name: string; type: string }, prefix = "") => {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    const fieldSettings = settings[field.name];

    if (field.type === "array" && fieldSettings?.subFields) {
      // Process sub-fields within array
      fieldSettings.subFields.forEach((subField: any) => {
        processField(subField, path + "[]");
      });
    } else if (field.type === "object" && fieldSettings?.subFields) {
      // Process sub-fields within object
      fieldSettings.subFields.forEach((subField: any) => {
        processField(subField, path);
      });
    } else if (
      // Include fields that can be used for conditioning (any type with a value)
      field.type !== "slot" &&
      field.type !== "array" &&
      field.type !== "object"
    ) {
      // Add the field itself and any options it has
      const subOptions = fieldSettings?.options || [];
      options.push({
        label: path,
        value: path,
        type: field.type as FieldOption["type"],
        options: subOptions.length > 0 ? subOptions : undefined,
      });
    }
  };

  fields.forEach((field) => {
    processField(field);
  });

  return options;
};

/**
 * Deduplicate options by value
 */
export const dedupeOptions = (options: FieldOption[]): FieldOption[] => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
};

/**
 * Hook for managing CVA configuration state
 */
export const useCvaConfig = (initialConfig: CvaConfig) => {
  const [localConfig, setLocalConfig] = useState<CvaConfig>(initialConfig);

  const handleBaseChange = useCallback((val: string) => {
    setLocalConfig((prev) => ({ ...prev, base: val }));
  }, []);

  const addVariant = useCallback(() => {
    setLocalConfig((prev) => ({
      ...prev,
      variants: [...prev.variants, { fieldId: "", classes: {} }],
    }));
  }, []);

  const removeVariant = useCallback((idx: number) => {
    setLocalConfig((prev) => {
      const next = [...prev.variants];
      next.splice(idx, 1);
      return { ...prev, variants: next };
    });
  }, []);

  const updateVariantField = useCallback((idx: number, fieldId: string) => {
    setLocalConfig((prev) => {
      const next = [...prev.variants];
      next[idx] = { fieldId, classes: {} };
      return { ...prev, variants: next };
    });
  }, []);

  const updateVariantClass = useCallback(
    (variantIdx: number, optionValue: string, classStr: string) => {
      setLocalConfig((prev) => {
        const next = [...prev.variants];
        const currentClasses = { ...next[variantIdx].classes };
        currentClasses[optionValue] = classStr;
        next[variantIdx].classes = currentClasses;
        return { ...prev, variants: next };
      });
    },
    []
  );

  return {
    config: localConfig,
    setConfig: setLocalConfig,
    handleBaseChange,
    addVariant,
    removeVariant,
    updateVariantField,
    updateVariantClass,
  };
};
