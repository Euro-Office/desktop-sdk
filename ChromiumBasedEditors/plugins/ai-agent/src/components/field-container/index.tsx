import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
import { cn } from "@/lib/utils";

type FieldContainerProps = {
  children: React.ReactNode;
  header: string;
  error?: string;
  isHorizontal?: boolean;
  reserveErrorSpace?: boolean;
  action?: React.ReactNode;
  className?: string;
  headerClassName?: string;
};

const ErrorBlock = ({ error }: { error: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <p className="text-[var(--field-container-error-color)] leading-[20px] truncate">
        {error}
      </p>
    </TooltipTrigger>
    <TooltipContent
      className="max-w-[350px] break-words"
      side="bottom"
      align="start"
    >
      {error}
    </TooltipContent>
  </Tooltip>
);

const FieldContainer = ({
  children,
  header,
  error,
  isHorizontal,
  reserveErrorSpace,
  action,
  className,
  headerClassName,
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
            <p
              className={cn(
                "select-none text-[14px] leading-[20px] text-[var(--field-container-header-color)]",
                headerClassName
              )}
            >
              {header}
            </p>
            {action}
          </div>
        ) : (
          <p
            className={cn(
              "select-none text-[14px] leading-[20px] text-[var(--field-container-header-color)] w-full max-w-[160px] shrink-0",
              headerClassName
            )}
          >
            {header}
          </p>
        )}

        <div
          className={cn("overflow-hidden", isHorizontal ? "grow" : "w-full")}
        >
          {children}
        </div>
      </div>
      {(reserveErrorSpace || error) && (
        <div
          className={cn(
            "overflow-hidden",
            reserveErrorSpace && "h-[20px]",
            isHorizontal && "pl-[168px]"
          )}
        >
          {error && <ErrorBlock error={error} />}
        </div>
      )}
    </div>
  );
};

export { FieldContainer };
