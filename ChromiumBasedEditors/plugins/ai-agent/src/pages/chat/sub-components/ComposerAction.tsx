import { ComposerActionAttachment } from "./ComposerActionAttachments";
import { ComposerActionPrompts } from "./ComposerActionPrompts";
import { SelectModel } from "./ComposerActionSelectModel";
import { ComposerActionSend } from "./ComposerActionSend";
import { ServersSettings } from "./ComposerActionServers";

const ComposerAction = () => {
  return (
    <div className="relative flex flex-col">
      <div className="relative flex items-center justify-between h-[24px]">
        <div className="flex items-center gap-[12px] flex-row">
          <ComposerActionAttachment />
          <ComposerActionPrompts />
          <ServersSettings />
        </div>

        <div className="flex items-center gap-[12px] flex-row">
          <SelectModel />
          <ComposerActionSend />
        </div>
      </div>
    </div>
  );
};

export { ComposerAction };
