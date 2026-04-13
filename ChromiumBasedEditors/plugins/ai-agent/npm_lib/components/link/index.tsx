import { cn } from "../../lib/utils";

type LinkProps = React.ComponentProps<"a"> & {
  variant?: "default" | "primary";
};

const Link = ({
  className,
  children,
  variant = "default",
  ...props
}: LinkProps) => {
  return (
    <a
      className={cn(
        "underline cursor-pointer leading-[20px]",
        variant === "primary"
          ? "text-[var(--link-primary-color)]"
          : "text-[var(--link-color)]",
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
};

export { Link };
