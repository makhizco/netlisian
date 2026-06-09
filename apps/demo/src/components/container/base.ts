export type Attribute = {
  key: string;
  valueType: "string" | "number" | "boolean" | "key-value" | "object" | "function";
}

export type AttributeValue = {
  [key: string]: string | number | boolean | { [key: string]: string } | undefined;
}

export type Base = {
  attributes?: Attribute[];
  values?: AttributeValue;
}
