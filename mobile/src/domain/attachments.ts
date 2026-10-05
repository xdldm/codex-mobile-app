// Composer attachment helpers: converting uploaded files into run input items
// and producing a usable message when the user sends attachments without text.

import type { RunInputItem, UploadedAttachment } from "./bridge";

export function attachmentInputItems(attachments: UploadedAttachment[]): RunInputItem[] {
  return attachments.map((attachment) => ({
    type: "attachment",
    name: attachment.name,
    path: attachment.path
  }));
}

export function messageForDraft(draft: string, attachmentCount: number) {
  if (draft.trim().length > 0 || attachmentCount === 0) {
    return draft;
  }

  return attachmentCount > 1
    ? "Please review the attached files."
    : "Please review the attached file.";
}
