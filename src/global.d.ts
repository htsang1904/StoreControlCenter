import type { IStaticMethods } from "preline/preline";
declare global {
  interface Window {
    DataTable;
    HSStaticMethods: IStaticMethods;
  }
}

export {};
