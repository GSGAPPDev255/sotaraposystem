/**
 * Google Gemini 2.5 Pro client for invoice data extraction.
 */

const GEMINI_MODEL = 'gemini-2.5-pro';
const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface ExtractedInvoiceFields {
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;       // ISO date string YYYY-MM-DD
  po_number: string | null;
  description: string | null;        // max 75 chars
  net_amount: number | null;
  vat_amount: number | null;
  gross_amount: number | null;
  purchase_name: string | null;
  budget_code: string | null;
  account_number: string | null;
  supplier_ref: string | null;
  due_date: string | null;           // ISO date string YYYY-MM-DD
}

const EXTRACTION_PROMPT = `You are a finance assistant extracting structured data from invoice documents.

Extract the following fields and return ONLY valid JSON (no markdown, no explanation):

{
  "supplier_name": string or null,
  "invoice_number": string or null,
  "invoice_date": "YYYY-MM-DD" or null,
  "po_number": string or null,
  "description": string (max 75 characters, summarise if longer) or null,
  "net_amount": number or null,
  "vat_amount": number or null,
  "gross_amount": number or null,
  "purchase_name": string or null,
  "budget_code": string or null,
  "account_number": string or null,
  "supplier_ref": string or null,
  "due_date": "YYYY-MM-DD" or null
}

Rules:
- Amounts must be numeric values only (no currency symbols, no commas).
- Dates must be in YYYY-MM-DD format.
- description must not exceed 75 characters.
- Return null for any field that cannot be determined from the document.
- Return ONLY the JSON object, nothing else.`;

/**
 * Extract invoice fields from a file buffer using Gemini 2.5 Pro.
 * @param fileBytes  Raw file content as Uint8Array
 * @param mimeType   MIME type of the file
 */
export async function extractInvoiceFields(
  fileBytes: Uint8Array,
  mimeType: string,
): Promise<{ fields: ExtractedInvoiceFields; rawResponse: unknown; processingMs: number }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')!;
  const startTime = Date.now();

  // Convert unsupported types (Excel, Word) to base64 text extraction first
  const supportedImageTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  const effectiveMimeType = supportedImageTypes.includes(mimeType) ? mimeType : 'application/pdf';

  const base64Data = btoa(String.fromCharCode(...fileBytes));

  const payload = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: effectiveMimeType,
              data: base64Data,
            },
          },
          { text: EXTRACTION_PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      response_mime_type: 'application/json',
    },
  };

  const res = await fetch(`${GEMINI_BASE}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${body}`);
  }

  const rawResponse = await res.json();
  const processingMs = Date.now() - startTime;

  const text = rawResponse?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  let fields: ExtractedInvoiceFields;
  try {
    fields = JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${text}`);
  }

  // Truncate description if Gemini exceeded 75 chars
  if (fields.description && fields.description.length > 75) {
    fields.description = fields.description.substring(0, 75);
  }

  return { fields, rawResponse, processingMs };
}
