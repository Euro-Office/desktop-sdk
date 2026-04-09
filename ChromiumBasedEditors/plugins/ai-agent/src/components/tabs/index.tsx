import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import type { TabsProps } from "./Tabs.types";

const Tabs = ({
  items,
  defaultValue,
  value,
  onValueChange,
  className,
}: TabsProps) => {
  const { isRTL } = useDirection();

  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue || items[0]?.value}
      value={value}
      onValueChange={onValueChange}
      className={cn("w-full", className)}
    >
      <TabsPrimitive.List
        className={cn(
          "inline-flex h-[24px] items-center",
          isRTL ? "flex-row-reverse" : ""
        )}
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              "font-semibold text-[13px] leading-[20px] cursor-pointer px-[12px] h-[24px] border-[length:var(--tabs-border-width)] border-[color:var(--tabs-border-color)] border-solid -ml-px first:ml-0 transition-colors",
              "text-[var(--text-secondary)] bg-[var(--background-normal)]",
              "data-[state=active]:text-[var(--text-normal)] data-[state=active]:bg-[var(--highlight-button-hover)]",
              "first:rounded-l-[var(--tabs-border-radius)] last:rounded-r-[var(--tabs-border-radius)]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content
          key={item.value}
          value={item.value}
          className="mt-[24px]"
        >
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
};

export { Tabs };
