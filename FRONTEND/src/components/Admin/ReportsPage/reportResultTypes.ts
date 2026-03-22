export type ReportFilterValues = Record<string, string | string[] | boolean>;

export type ReportResultColumn = {
  key: string;
  label: string;
};

export type ReportResultRow = Record<string, string | number>;
