import { create } from "zustand";
import type { TAttachmentFile, TAttachmentImage } from "@/lib/types";

type UseAttachmentsStoreProps = {
  attachmentFiles: TAttachmentFile[];
  attachmentImages: TAttachmentImage[];

  addAttachmentFile: (file: TAttachmentFile) => void;
  deleteAttachmentFile: (path: string) => void;
  clearAttachmentFiles: () => void;

  addAttachmentImage: (image: TAttachmentImage) => void;
  deleteAttachmentImage: (name: string) => void;
  clearAttachmentImages: () => void;
};

const useAttachmentsStore = create<UseAttachmentsStoreProps>((set, get) => ({
  attachmentFiles: [],
  attachmentImages: [],

  addAttachmentFile: (file: TAttachmentFile) => {
    if (get().attachmentFiles.length >= 5) {
      return;
    }
    set({ attachmentFiles: [...get().attachmentFiles, file] });
  },
  deleteAttachmentFile: (path: string) => {
    set({
      attachmentFiles: get().attachmentFiles.filter((f) => f.path !== path),
    });
  },
  clearAttachmentFiles: () => {
    set({ attachmentFiles: [] });
  },

  addAttachmentImage: (image: TAttachmentImage) => {
    if (get().attachmentImages.length >= 5) {
      return;
    }
    set({ attachmentImages: [...get().attachmentImages, image] });
  },
  deleteAttachmentImage: (name: string) => {
    set({
      attachmentImages: get().attachmentImages.filter((i) => i.name !== name),
    });
  },
  clearAttachmentImages: () => {
    set({ attachmentImages: [] });
  },
}));

export default useAttachmentsStore;
