import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmailTemplate } from '@/hooks/useEmailTemplates';
import { TemplatePreview } from './TemplatePreview';

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplate | null;
  onSave: (template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

const TEMPLATE_VARIABLES = [
  { name: '{customer_name}', description: 'Customer name' },
  { name: '{order_number}', description: 'Order number' },
  { name: '{delivery_date}', description: 'Delivery date' },
  { name: '{po_number}', description: 'PO number if provided' },
  { name: '{items_table}', description: 'Order items table' },
  { name: '{total}', description: 'Order total' },
  { name: '{company_name}', description: 'Your company name' },
];

export function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  onSave,
}: TemplateEditorDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setSubject(template.subject_template);
      setBody(template.body_template);
      setIsActive(template.is_active);
    } else {
      setName('');
      setDescription('');
      setSubject('Order Confirmation - {order_number}');
      setBody(getDefaultBody());
      setIsActive(true);
    }
  }, [template]);

  const getDefaultBody = () => `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f5f5f5; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f5f5f5; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{company_name}</h1>
    </div>
    <div class="content">
      <p>Dear {customer_name},</p>
      <p>Thank you for your order! We have received your order <strong>#{order_number}</strong>.</p>
      <p><strong>Delivery Date:</strong> {delivery_date}</p>
      
      {items_table}
      
      <p><strong>Total: {total}</strong></p>
      
      <p>If you have any questions, please don't hesitate to contact us.</p>
    </div>
    <div class="footer">
      <p>Thank you for your business!</p>
    </div>
  </div>
</body>
</html>`;

  const insertVariable = (variable: string, target: 'subject' | 'body') => {
    if (target === 'subject') {
      setSubject(prev => prev + variable);
    } else {
      setBody(prev => prev + variable);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        subject_template: subject,
        body_template: body,
        is_active: isActive,
        is_default: template?.is_default || false,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit Template' : 'Create Template'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="editor" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="flex-1 overflow-auto space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Standard Confirmation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the template"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="is-active">Active</Label>
            </div>

            <div className="space-y-2">
              <Label>Available Variables</Label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <Badge
                    key={v.name}
                    variant="secondary"
                    className="cursor-pointer hover:bg-secondary/80"
                    title={v.description}
                    onClick={() => insertVariable(v.name, 'body')}
                  >
                    {v.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject with {variables}"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body (HTML) *</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="HTML email body"
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-auto mt-4">
            <TemplatePreview subject={subject} body={body} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !subject.trim()}>
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
