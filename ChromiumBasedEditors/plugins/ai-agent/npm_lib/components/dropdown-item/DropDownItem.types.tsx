import type React from "react";

export type DropDownItemProps = {
  text: string;
  onClick: (e: Event) => void;

  icon?: string | React.ReactNode;
  iconSize?: number;
  iconColor?: string;

  trailingIcon?: string | React.ReactNode;
  trailingIconSize?: number;

  id?: string;
  isActive?: boolean;
  isSeparator?: boolean;

  withToggle?: boolean;
  toggleChecked?: boolean;
  onToggleChange?: (checked: boolean) => void;
  toggleDisabled?: boolean;

  subMenu?: DropDownItemProps[];
  subMenuClassName?: string;
  subMenuIcon?: string;
  subMenuIconSize?: number;

  checked?: boolean;

  tooltipText?: string;

  withSpace?: boolean;

  withAbout?: boolean;
  aboutContent?: React.ReactNode;
};
