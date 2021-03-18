export enum DataType {
  NUMBER,
  STRING,
  DATE,
}
type SchemaItem<T> = { key: keyof T; type: DataType };
export type Schema<T extends {}> = SchemaItem<T>[];
