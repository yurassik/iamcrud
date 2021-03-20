export enum DataType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  DATE = 'DATE',
}
type SchemaItem<T> = { key: keyof T; type: DataType };
export type Schema<T extends {}> = SchemaItem<T>[];
