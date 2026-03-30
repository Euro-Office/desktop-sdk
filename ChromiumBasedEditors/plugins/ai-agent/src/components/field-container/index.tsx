import { cn } from "@/lib/utils";

type FieldContainerProps = {
  children: React.ReactNode;
  header: string;
  error?: string;
  isHorizontal?: boolean;
  action?: React.ReactNode;
  className?: string;
};

const FieldContainer = ({
  children,
  header,
  error,
  isHorizontal,
  action,
  className,
}: FieldContainerProps) => {
  return (
    <div className={cn(className, "flex flex-col w-full gap-[2px]")}>
      {isHorizontal && action && (
        <div className="flex justify-end w-full">{action}</div>
      )}
      <div
        className={cn(
          "flex w-full",
          isHorizontal
            ? "flex-row items-center gap-[8px]"
            : "flex-col gap-[4px]"
        )}
      >
        {!isHorizontal ? (
          <div className="flex justify-between items-center w-full mb-[2px]">
            <p className="select-none text-[14px] leading-[20px] text-[var(--field-container-header-color)]">
              {header}
            </p>
            {action}
          </div>
        ) : (
          <p className="select-none text-[14px] leading-[20px] text-[var(--field-container-header-color)] w-full max-w-[160px] shrink-0">
            {header}
          </p>
        )}

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
    </div>
  );
};

export { FieldContainer };
