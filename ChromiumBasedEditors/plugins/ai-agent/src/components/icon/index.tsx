import { ReactSVG } from "react-svg";
import { getImageSrc } from "@/lib/images";
import useThemeStore from "@/store/useThemeStore";

type IconProps = {
  name: string;
  size: number;
  width?: number;
  height?: number;
  isStroke?: boolean;
  color?: string;
  noColor?: boolean;
  className?: string;
  isTransform?: boolean;
};

const Icon = ({
  name,
  size,
  width,
  height,
  isStroke,
  color,
  noColor,
  className,
  isTransform,
}: IconProps) => {
  const w = width ?? size;
  const h = height ?? size;
  const { themeType, scale } = useThemeStore();
  const image = getImageSrc(name, themeType, scale);

  if (!image) {
    return null;
  }

  const handleBeforeInjection = (svg: SVGSVGElement) => {
    if (noColor) return;

    const fillColor = color || "var(--icon-button-color)";

    const paths = svg.querySelectorAll("path");
    paths.forEach((path) => {
      if (isStroke) {
        path.setAttribute("stroke", fillColor);
      } else {
        path.setAttribute("fill", fillColor);
      }
    });

    const circles = svg.querySelectorAll("circle");
    circles.forEach((circle) => {
      if (isStroke) {
        circle.setAttribute("stroke", fillColor);
      } else {
        circle.setAttribute("fill", fillColor);
      }
    });
  };

  if (image.isSvg) {
    return (
      <ReactSVG
        src={image.src}
        className={`flex items-center justify-center ${isTransform ? "rotate-90" : ""} ${className || ""}`}
        beforeInjection={handleBeforeInjection}
        style={{ width: w, height: h }}
      />
    );
  }

  return (
    <img
      src={image.src}
      alt={name}
      className={`${isTransform ? "rotate-90" : ""} ${className || ""}`}
      style={{ width: w, height: h }}
    />
  );
};

export { Icon };
