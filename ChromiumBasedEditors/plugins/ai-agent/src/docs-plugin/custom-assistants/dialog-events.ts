export const CUSTOM_ASSISTANT_DIALOG_EVENTS = {
  windowReady: "onWindowReady",
  edit: "onEditAssistant",
  warning: "onWarningAssistant",
  profilesList: "onProfilesList",
  clickAdd: "onClickAdd",
  addOrEdit: "onAddEditAssistant",
} as const;

export const CUSTOM_ASSISTANT_DELETE_DIALOG_EVENTS = {
  windowReady: "onWindowReady",
  setAssistantId: "onSetAssistantId",
  confirm: "onConfirmDelete",
  delete: "onDeleteAssistant",
} as const;
