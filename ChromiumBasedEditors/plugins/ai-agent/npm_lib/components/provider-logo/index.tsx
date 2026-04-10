import { getProviderImageSrc } from "../../lib/images";
import { cn } from "../../lib/utils";
import type { ProviderType } from "../../types";

type ProviderLogoProps = {
  providerType: ProviderType;
  className?: string;
};

export const ProviderLogo = ({
  providerType,
  className,
}: ProviderLogoProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center w-[32px] h-[32px] rounded-[var(--model-card-logo-border-radius)] border border-[var(--model-card-logo-border-color)] shrink-0",
        className
      )}
    >
      <img
        src={getProviderImageSrc(providerType)}
        alt="model logo"
        width={18}
        height={18}
      />
    </div>
  );
};
