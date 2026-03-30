import { cn } from "@/lib/utils";

type LinkProps = React.ComponentProps<"a">;

const Link = ({ className, children, ...props }: LinkProps) => {
  return (
    <a
      className={cn(
        "text-[var(--link-color)] underline cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
};

export { Link };
