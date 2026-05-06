export const CUSTOM_ACTION_DIALOG_EVENTS = {
  windowReady: "onWindowReady",
  edit: "onEditAction",
  warning: "onWarningAction",
  profilesList: "onProfilesList",
  clickAdd: "onClickAdd",
  addOrEdit: "onAddEditAction",
} as const;

export const CUSTOM_ACTION_DELETE_DIALOG_EVENTS = {
  windowReady: "onWindowReady",
  setActionId: "onSetActionId",
  confirm: "onConfirmDelete",
  delete: "onDeleteAction",
} as const;
