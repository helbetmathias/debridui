import { ImagePreview } from "@/features/preview/components/renderers/image-preview";
import { TextPreview } from "@/features/preview/components/renderers/text-preview";
import { VideoPreview } from "@/features/preview/components/renderers/video-preview";
import { FileType } from "@/types";
import { registerPreviewRenderer } from "./registry";

// Register image preview renderer
registerPreviewRenderer({
    id: "image",
    fileTypes: [FileType.IMAGE],
    component: ImagePreview,
    canPreview: (type) => type === FileType.IMAGE,
});

// Register video preview renderer
registerPreviewRenderer({
    id: "video",
    fileTypes: [FileType.VIDEO],
    component: VideoPreview,
    canPreview: (type) => type === FileType.VIDEO,
});

// Register text preview renderer
registerPreviewRenderer({
    id: "text",
    fileTypes: [FileType.TEXT],
    component: TextPreview,
    canPreview: (type) => type === FileType.TEXT,
});
