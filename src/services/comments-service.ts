import { CommentRepository } from "../repositories/comment-repository.js";
import { AppError } from "../utils/app-error.js";
import { toPlain, toPlainList } from "../utils/serializers.js";

export class CommentsService {
  constructor(private readonly commentRepository: CommentRepository) {}

  async listComments(taskId: string) {
    const comments = await this.commentRepository.findByTaskId(taskId);
    return toPlainList(comments);
  }

  async createComment(
    taskId: string,
    authorId: string,
    input: { body: string; visibility: string },
  ) {
    const comment = await this.commentRepository.create({
      taskId,
      authorId,
      body: input.body,
      visibility: input.visibility,
    });

    return toPlain(comment);
  }

  async updateComment(commentId: string, authorId: string, input: { body: string }) {
    const existingComment = await this.commentRepository.findById(commentId);

    if (!existingComment) {
      throw new AppError(404, "Comment not found");
    }

    if (existingComment.authorId !== authorId) {
      throw new AppError(403, "You can only edit your own comments");
    }

    const updatedComment = await this.commentRepository.updateBody(commentId, input.body);

    if (!updatedComment) {
      throw new AppError(404, "Comment not found");
    }

    return toPlain(updatedComment);
  }
}
