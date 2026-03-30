import { cn } from "@/lib/utils";

type FieldContainerProps = {
  children: React.ReactNode;
  header: string;
  error?: string;
  isHorizontal?: boolean;
};

const FieldContainer = ({
  children,
  header,
  error,
  isHorizontal,
}: FieldContainerProps) => {
  return (
    <div
      className={cn(
        "flex w-full gap-[4px]",
        isHorizontal ? "flex-row items-center" : "flex-col"
      )}
    >
      <p
        className={cn(
          "select-none text-[14px] leading-[20px] text-[var(--field-container-header-color)]",
          isHorizontal ? "w-full max-w-[160px]" : ""
        )}
      >
        {header}
      </p>
      <div
        className={cn(
          "flex flex-col gap-[4px]",
          isHorizontal ? "grow" : "w-full"
        )}
      >
        {children}
        {error && (
          <p className={cn("text-[var(--field-container-error-color)]")}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export { FieldContainer };
