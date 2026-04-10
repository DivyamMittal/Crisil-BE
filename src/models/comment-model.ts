import mongoose, { Schema, type Model } from "mongoose";

import { CommentVisibility } from "../types/enums.js";
import { timestamps } from "./common.js";

export interface CommentRecord {
  taskId: string;
  authorId: string;
  body: string;
  visibility: CommentVisibility;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<CommentRecord>(
  {
    taskId: { type: String, required: true, index: true },
    authorId: { type: String, required: true },
    body: { type: String, required: true },
    visibility: { type: String, enum: Object.values(CommentVisibility), required: true },
  },
  { timestamps },
);

export const CommentModel: Model<CommentRecord> =
  (mongoose.models.Comment as Model<CommentRecord>) ||
  mongoose.model<CommentRecord>("Comment", commentSchema);
