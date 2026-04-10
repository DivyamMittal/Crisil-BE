import { CommentModel } from "../models/index.js";

export class CommentRepository {
  findByTaskId(taskId: string) {
    return CommentModel.find({ taskId }).sort({ createdAt: -1 });
  }

  findById(commentId: string) {
    return CommentModel.findById(commentId);
  }

  create(input: {
    taskId: string;
    authorId: string;
    body: string;
    visibility: string;
  }) {
    return CommentModel.create(input);
  }

  async updateBody(commentId: string, body: string) {
    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      return null;
    }

    comment.body = body;
    await comment.save();
    return comment;
  }
}
