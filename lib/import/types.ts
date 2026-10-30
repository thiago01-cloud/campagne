/** One row of the file: { header: value } — the equivalent of Map<String, dynamic> */
export type Row = Record<string, string>;

export type ImportedTable = {
  headers: string[]; // cleaned keys
  labels: string[]; // headers as written in the file
  rows: Row[]; // the equivalent of List<Map<String, dynamic>>
  lineNumbers: number[]; // original line number of each row
  warnings: string[];
};
