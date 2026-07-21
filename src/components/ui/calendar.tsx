import * as React from "react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  startMonth = new Date(new Date().getFullYear() - 10, 0),
  endMonth = new Date(new Date().getFullYear() + 5, 11),
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      startMonth={startMonth}
      endMonth={endMonth}
      className={cn("p-3", className)}
      classNames={{
        root: "relative p-3",
        months: "flex flex-col gap-4 sm:flex-row sm:gap-5",
        month: "space-y-4",
        month_caption: "flex h-9 items-center justify-center px-9 pt-1 relative",
        caption_label:
          "inline-flex h-8 min-w-[86px] items-center justify-center gap-1 rounded-lg border border-border/70 bg-background px-2.5 text-xs font-semibold text-foreground shadow-sm",
        dropdowns: "flex items-center justify-center gap-2",
        dropdown_root: "relative inline-flex h-8 min-w-[86px] items-center",
        dropdown:
          "absolute inset-0 z-10 h-8 w-full cursor-pointer appearance-none opacity-0 outline-none",
        months_dropdown: "min-w-[96px]",
        years_dropdown: "min-w-[78px]",
        nav: "pointer-events-none absolute left-3 right-3 top-3 z-10 flex items-center justify-between",
        button_previous:
          "pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background p-0 opacity-70 transition hover:bg-secondary hover:opacity-100",
        button_next:
          "pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background p-0 opacity-70 transition hover:bg-secondary hover:opacity-100",
        chevron: "h-4 w-4",
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative data-[selected=true]:bg-accent first:data-[selected=true]:rounded-l-md last:data-[selected=true]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button:
          "inline-flex h-9 w-9 items-center justify-center rounded-md p-0 text-sm font-normal transition hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring",
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside: "day-outside text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "bg-accent text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
