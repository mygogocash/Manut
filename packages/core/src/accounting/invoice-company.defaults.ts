/** Admin-editable company + bank block for generated invoices. */
export interface InvoiceCompany {
  name: string;
  addressLines: string[];
  taxId: string;
  email: string;
  tel: string;
  bankName: string;
  bankAccountType: string;
  bankBranch: string;
  bankAccountName: string;
  bankAccountNo: string;
  bankSwift: string;
  footerNote: string;
}

export const DEFAULT_INVOICE_COMPANY: InvoiceCompany = {
  name: "The Binary Holding (Thailand) Co., Ltd.",
  addressLines: [
    "T-Place Building, 7th Floor, Unit 702-703, 150 Soi Sukhumvit 55 (Thonglor)",
    "Klongtan Nua, Wattana, Bangkok 10110 (Head Office)",
  ],
  taxId: "0-1055-6703-813-4",
  email: "accounts@thebinaryholdings.com",
  tel: "+66-2-059-0383",
  bankName: "Bank of Ayudhya PCL (Krungsri)",
  bankAccountType: "Savings Account",
  bankBranch: "Thonglor",
  bankAccountName: "The Binary (Thailand) Co., Ltd.",
  bankAccountNo: "687-1-12394-9",
  bankSwift: "AYUDTHBK",
  footerNote:
    "Please reference the invoice number in your payment. Late payments are " +
    "subject to a 1.5% monthly interest charge. Thank you for your business.",
};

export const INVOICE_COMPANY_KEY = "accounting.invoice_company";
