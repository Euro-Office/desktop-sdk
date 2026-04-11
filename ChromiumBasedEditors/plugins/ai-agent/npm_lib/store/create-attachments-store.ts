import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { TAttachmentFile, TAttachmentImage } from "../types";

export interface AttachmentsStoreState {
  attachmentFiles: TAttachmentFile[];
  attachmentImages: TAttachmentImage[];
  addAttachmentFile: (file: TAttachmentFile) => void;
  deleteAttachmentFile: (path: string) => void;
  clearAttachmentFiles: () => void;
  addAttachmentImage: (image: TAttachmentImage) => void;
  deleteAttachmentImage: (name: string) => void;
  clearAttachmentImages: () => void;
}

export function createAttachmentsStore(): UseBoundStore<
  StoreApi<AttachmentsStoreState>
> {
  return create<AttachmentsStoreState>((set, get) => ({
    attachmentFiles: [],
    attachmentImages: [],

    addAttachmentFile: (file) => {
      if (get().attachmentFiles.length >= 5) return;
      set({
        attachmentFiles: [...get().attachmentFiles, file],
      });
    },

    deleteAttachmentFile: (path) => {
      set({
        attachmentFiles: get().attachmentFiles.filter((f) => f.path !== path),
      });
    },

    clearAttachmentFiles: () => set({ attachmentFiles: [] }),

    addAttachmentImage: (image) => {
      if (get().attachmentImages.length >= 5) return;
      set({
        attachmentImages: [...get().attachmentImages, image],
      });
    },

    deleteAttachmentImage: (name) => {
      set({
        attachmentImages: get().attachmentImages.filter((i) => i.name !== name),
      });
    },

    clearAttachmentImages: () => set({ attachmentImages: [] }),
  }));
}
