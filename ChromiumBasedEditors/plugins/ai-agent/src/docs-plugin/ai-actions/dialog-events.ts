export const ACTION_DIALOG_EVENTS = {
  windowReady: "onWindowReady",
  edit: "onEditAction",
  warning: "onWarningAction",
  profilesList: "onProfilesList",
  clickAdd: "onClickAdd",
  addOrEdit: "onAddEditAction",
} as const;

export const DELETE_DIALOG_EVENTS = {
  windowReady: "onWindowReady",
  setActionId: "onSetActionId",
  confirm: "onConfirmDelete",
  delete: "onDeleteAction",
} as const;

export type ActionDialogEvent =
  (typeof ACTION_DIALOG_EVENTS)[keyof typeof ACTION_DIALOG_EVENTS];

export type DeleteDialogEvent =
  (typeof DELETE_DIALOG_EVENTS)[keyof typeof DELETE_DIALOG_EVENTS];
