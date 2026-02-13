import { cn } from "@/lib/utils";

type FieldContainerProps = {
  children: React.ReactNode;
  header: string;
  error?: string;
};

const FieldContainer = ({ children, header, error }: FieldContainerProps) => {
  return (
    <div className={cn("flex flex-col gap-[4px]")}>
      <p
        className={cn(
          "select-none text-[14px] leading-[20px] text-[var(--field-container-header-color)]"
        )}
      >
        {header}
      </p>
      {children}
      {error && (
        <p className={cn("text-[var(--field-container-error-color)]")}>
          {error}
        </p>
      )}
    </div>
  );
};

export { FieldContainer };
