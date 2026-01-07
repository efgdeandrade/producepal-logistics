import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Clock, Calendar } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const scheduleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  frequency: z.enum(["daily", "weekly", "monthly", "custom"]),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  customCron: z.string().optional(),
  deliveryMethod: z.enum(["email", "download", "webhook"]),
  recipients: z.array(z.string().email()).min(1, "At least one recipient required"),
  isActive: z.boolean(),
  timezone: z.string(),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

interface ReportScheduleFormProps {
  initialData?: Partial<ScheduleFormData>;
  onSubmit: (data: ScheduleFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const TIMEZONES = [
  { value: "America/Curacao", label: "Curaçao (AST)" },
  { value: "America/New_York", label: "New York (EST)" },
  { value: "America/Chicago", label: "Chicago (CST)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET)" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function ReportScheduleForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: ReportScheduleFormProps) {
  const [newRecipient, setNewRecipient] = useState("");

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      name: "",
      frequency: "daily",
      time: "08:00",
      deliveryMethod: "email",
      recipients: [],
      isActive: true,
      timezone: "America/Curacao",
      ...initialData,
    },
  });

  const frequency = form.watch("frequency");
  const recipients = form.watch("recipients");

  const addRecipient = () => {
    if (newRecipient && newRecipient.includes("@")) {
      const current = form.getValues("recipients");
      if (!current.includes(newRecipient)) {
        form.setValue("recipients", [...current, newRecipient]);
      }
      setNewRecipient("");
    }
  };

  const removeRecipient = (email: string) => {
    const current = form.getValues("recipients");
    form.setValue(
      "recipients",
      current.filter((r) => r !== email)
    );
  };

  const getNextRunTimes = (): string[] => {
    // Simple preview of next run times (in production, calculate based on cron)
    const now = new Date();
    const times: string[] = [];
    const time = form.getValues("time");
    const [hours, minutes] = time.split(":").map(Number);

    for (let i = 0; i < 5; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i + 1);
      date.setHours(hours, minutes, 0, 0);
      times.push(date.toLocaleString());
    }

    return times;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Schedule Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Schedule Name</FormLabel>
              <FormControl>
                <Input placeholder="Daily Sales Report" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Frequency */}
        <FormField
          control={form.control}
          name="frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frequency</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom (Cron)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Time */}
        <FormField
          control={form.control}
          name="time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input type="time" {...field} className="w-32" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Day of Week (for weekly) */}
        {frequency === "weekly" && (
          <FormField
            control={form.control}
            name="dayOfWeek"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Day of Week</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(Number(v))}
                  defaultValue={String(field.value ?? 1)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Day of Month (for monthly) */}
        {frequency === "monthly" && (
          <FormField
            control={form.control}
            name="dayOfMonth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Day of Month</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    className="w-20"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Custom Cron */}
        {frequency === "custom" && (
          <FormField
            control={form.control}
            name="customCron"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cron Expression</FormLabel>
                <FormControl>
                  <Input placeholder="0 8 * * 1-5" {...field} />
                </FormControl>
                <FormDescription>
                  Format: minute hour day-of-month month day-of-week
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Timezone */}
        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timezone</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Delivery Method */}
        <FormField
          control={form.control}
          name="deliveryMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delivery Method</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select delivery method" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="download">Download Link</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Recipients */}
        <FormField
          control={form.control}
          name="recipients"
          render={() => (
            <FormItem>
              <FormLabel>Recipients</FormLabel>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={newRecipient}
                    onChange={(e) => setNewRecipient(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRecipient())}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addRecipient}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recipients.map((email) => (
                    <Badge key={email} variant="secondary">
                      {email}
                      <button
                        type="button"
                        onClick={() => removeRecipient(email)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Active Toggle */}
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active</FormLabel>
                <FormDescription>Enable or disable this scheduled report</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Next Run Preview */}
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4" />
            Next 5 Scheduled Runs
          </div>
          <ul className="text-sm text-muted-foreground space-y-1">
            {getNextRunTimes().map((time, idx) => (
              <li key={idx}>{time}</li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Schedule"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
