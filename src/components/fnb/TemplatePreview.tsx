import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TemplatePreviewProps {
  subject: string;
  body: string;
}

const SAMPLE_DATA = {
  '{customer_name}': 'ABC Restaurant',
  '{order_number}': 'ORD-2024-001234',
  '{delivery_date}': 'January 20, 2024',
  '{po_number}': 'PO-789456',
  '{total}': 'ƒ 1,250.00',
  '{company_name}': 'Fresh Foods Distribution',
  '{items_table}': `<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <thead>
      <tr style="background: #f5f5f5;">
        <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Product</th>
        <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Qty</th>
        <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Price</th>
        <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border: 1px solid #ddd; padding: 10px;">Fresh Tomatoes</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">10 kg</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">ƒ 45.00</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">ƒ 450.00</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 10px;">Mixed Lettuce</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">5 cases</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">ƒ 80.00</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">ƒ 400.00</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 10px;">Chicken Breast</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">8 kg</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">ƒ 50.00</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">ƒ 400.00</td>
      </tr>
    </tbody>
  </table>`,
};

function replaceVariables(text: string): string {
  let result = text;
  Object.entries(SAMPLE_DATA).forEach(([variable, value]) => {
    result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
  });
  return result;
}

export function TemplatePreview({ subject, body }: TemplatePreviewProps) {
  const renderedSubject = replaceVariables(subject);
  const renderedBody = replaceVariables(body);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Subject Preview
            <Badge variant="outline" className="text-xs">Sample Data</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium">{renderedSubject}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Body Preview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div 
            className="border rounded-md bg-white"
            style={{ minHeight: '400px' }}
          >
            <iframe
              srcDoc={renderedBody}
              className="w-full h-[400px] border-0"
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
