import { ApprovalRepository } from "../repositories/approval-repository.js";
import { TaskRepository } from "../repositories/task-repository.js";
import { TimeEntryRepository } from "../repositories/time-entry-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { ApprovalStatus, ApprovalType, TaskStatus, UserRole } from "../types/enums.js";
import { AppError } from "../utils/app-error.js";
import { toPlain, toPlainList } from "../utils/serializers.js";

export class ApprovalsService {
  constructor(
    private readonly approvalRepository: ApprovalRepository,
    private readonly taskRepository: TaskRepository,
    private readonly timeEntryRepository: TimeEntryRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async listApprovals(actor: { id: string; role: UserRole }) {
    if (actor.role === UserRole.EMPLOYEE) {
      const approvals = await this.approvalRepository.findByRequestedBy(actor.id);
      return toPlainList(approvals);
    }

    if (actor.role === UserRole.ADMIN) {
      const approvals = await this.approvalRepository.findAll();
      return toPlainList(approvals);
    }

    const team = await this.userRepository.findIdsByManagerId(actor.id);
    const approvals = await this.approvalRepository.findByRequestedByIds(
      team.map((member) => member.id),
    );
    return toPlainList(approvals);
  }

  async reviewApproval(
    actorId: string,
    approvalId: string,
    input: { status: ApprovalStatus; managerComment: string },
  ) {
    const approval = await this.approvalRepository.findById(approvalId);

    if (!approval) {
      throw new AppError(404, "Approval request not found");
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new AppError(409, "Approval request has already been reviewed");
    }

    if (input.status === ApprovalStatus.REJECTED && input.managerComment.trim().length === 0) {
      throw new AppError(400, "Manager comment is required when rejecting a request");
    }

    approval.status = input.status;
    approval.managerComment = input.managerComment;
    approval.reviewedBy = actorId;
    approval.reviewedAtUtc = new Date();
    await approval.save();

    if (approval.type === ApprovalType.TASK_COMPLETION) {
      const task = await this.taskRepository.findById(approval.taskId);
      if (task) {
        task.status =
          approval.status === ApprovalStatus.APPROVED ? TaskStatus.COMPLETED : TaskStatus.REJECTED;
        task.completedAtUtc = approval.status === ApprovalStatus.APPROVED ? new Date() : null;
        if (approval.status === ApprovalStatus.REJECTED) {
          task.rejectionReason = input.managerComment || "Rejected by manager";
        }
        await task.save();
      }
    }

    if (approval.type === ApprovalType.MANUAL_LOG && approval.timeEntryId) {
      const entry = await this.timeEntryRepository.findById(approval.timeEntryId);
      if (entry) {
        entry.isSubmittedForApproval = approval.status !== ApprovalStatus.REJECTED;
        await entry.save();
      }
    }

    if (approval.type === ApprovalType.DUE_DATE_CHANGE && approval.status === ApprovalStatus.APPROVED) {
      const task = await this.taskRepository.findById(approval.taskId);
      const requestedDueDateUtc = approval.payload.requestedDueDateUtc;

      if (task && typeof requestedDueDateUtc === "string") {
        task.dueDateUtc = new Date(requestedDueDateUtc);
        await task.save();
      }
    }

    return toPlain(approval);
  }
}
