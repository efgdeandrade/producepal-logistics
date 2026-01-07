import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { supabase } from "../../integrations/supabase/client";
import { toast } from "sonner";

const alertRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  trigger_type: z.enum(["threshold", "time_based", "event_based"]),
  trigger_config: z.object({
    entity: z.string().optional(),
    field: z.string().optional(),
    operator: z.string().optional(),
    value: z.string().optional(),
    duration_minutes: z.number().optional(),
    event_type: z.string().optional(),
  }),
  notification_channels: z.array(z.string()).min(1, "Select at least one channel"),
  is_active: z.boolean(),
});

type AlertRuleFormData = z.infer<typeof alertRuleSchema>;

interface AlertRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: {
    id: string;
    name: string;
    description: string | null;
    trigger_type: string;
    trigger_config: Record<string, any>;
    notification_channels: string[];
    is_active: boolean;
  } | null;
  onSuccess: () => void;
}

const triggerTypes = [
  { value: "threshold", label: "Threshold", description: "Trigger when a value exceeds a limit" },
  { value: "time_based", label: "Time Based", description: "Trigger after inactivity period" },
  { value: "event_based", label: "Event Based", description: "Trigger on specific events" },
];

const channels = [
  { id: "in_app", label: "In-App Notification" },
  { id: "email", label: "Email" },
  { id: "push", label: "Push Notification" },
];

const eventTypes = [
  { value: "order_created", label: "Order Created" },
  { value: "order_picked", label: "Order Picked" },
  { value: "delivery_completed", label: "Delivery Completed" },
  { value: "delivery_delayed", label: "Delivery Delayed" },
  { value: "cod_collected", label: "COD Collected" },
  { value: "shortage_reported", label: "Shortage Reported" },
];

export function AlertRuleDialog({
  open,
  onOpenChange,
  rule,
  onSuccess,
}: AlertRuleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AlertRuleFormData>({
    resolver: zodResolver(alertRuleSchema),
    defaultValues: {
      name: "",
      description: "",
      trigger_type: "threshold",
      trigger_config: {},
      notification_channels: ["in_app"],
      is_active: true,
    },
  });

  const triggerType = form.watch("trigger_type");

  useEffect(() => {
    if (rule) {
      form.reset({
        name: rule.name,
        description: rule.description || "",
        trigger_type: rule.trigger_type as "threshold" | "time_based" | "event_based",
        trigger_config: rule.trigger_config || {},
        notification_channels: rule.notification_channels,
        is_active: rule.is_active,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        trigger_type: "threshold",
        trigger_config: {},
        notification_channels: ["in_app"],
        is_active: true,
      });
    }
  }, [rule, form]);

  const onSubmit = async (data: AlertRuleFormData) => {
    setIsSubmitting(true);
    try {
      if (rule) {
        const { error } = await supabase
          .from("alert_rules")
          .update({
            name: data.name,
            description: data.description,
            trigger_type: data.trigger_type,
            trigger_config: data.trigger_config,
            notification_channels: data.notification_channels,
            is_active: data.is_active,
          })
          .eq("id", rule.id);

        if (error) throw error;
        toast.success("Alert rule updated");
      } else {
        const { error } = await supabase.from("alert_rules").insert({
          name: data.name,
          description: data.description,
          trigger_type: data.trigger_type,
          trigger_config: data.trigger_config,
          notification_channels: data.notification_channels,
          is_active: data.is_active,
        });

        if (error) throw error;
        toast.success("Alert rule created");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving alert rule:", error);
      toast.error("Failed to save alert rule");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit Alert Rule" : "Create Alert Rule"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="High COD Collection Alert" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe when this alert should trigger..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trigger_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trigger Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trigger type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {triggerTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {type.description}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {triggerType === "threshold" && (
              <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg bg-muted/30">
                <FormField
                  control={form.control}
                  name="trigger_config.entity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Entity</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="order">Order</SelectItem>
                          <SelectItem value="delivery">Delivery</SelectItem>
                          <SelectItem value="cod">COD Collection</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trigger_config.operator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Operator</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="greater_than">Greater than</SelectItem>
                          <SelectItem value="less_than">Less than</SelectItem>
                          <SelectItem value="equals">Equals</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trigger_config.value"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-xs">Value</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 1000" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {triggerType === "time_based" && (
              <FormField
                control={form.control}
                name="trigger_config.duration_minutes"
                render={({ field }) => (
                  <FormItem className="p-3 border rounded-lg bg-muted/30">
                    <FormLabel>Inactivity Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 120"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Alert when no activity for this duration
                    </FormDescription>
                  </FormItem>
                )}
              />
            )}

            {triggerType === "event_based" && (
              <FormField
                control={form.control}
                name="trigger_config.event_type"
                render={({ field }) => (
                  <FormItem className="p-3 border rounded-lg bg-muted/30">
                    <FormLabel>Event Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select event" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eventTypes.map((event) => (
                          <SelectItem key={event.value} value={event.value}>
                            {event.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notification_channels"
              render={() => (
                <FormItem>
                  <FormLabel>Notification Channels</FormLabel>
                  <div className="flex flex-wrap gap-4">
                    {channels.map((channel) => (
                      <FormField
                        key={channel.id}
                        control={form.control}
                        name="notification_channels"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(channel.id)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, channel.id]);
                                  } else {
                                    field.onChange(
                                      current.filter((v) => v !== channel.id)
                                    );
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal cursor-pointer">
                              {channel.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">
                    Active
                  </FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : rule ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
