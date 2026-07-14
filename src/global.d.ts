declare global {
  interface Window {
    pywebview?: any;
    saveExcelFile?: (workbook: any, filename: string, showToastFn?: Function) => Promise<void>;
  }
}

export {};
