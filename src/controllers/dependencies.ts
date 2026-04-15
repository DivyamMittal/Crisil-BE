import {
  ActivityRepository,
  ApprovalRepository,
  CommentRepository,
  HolidayRepository,
  ProjectRepository,
  TaskRepository,
  TeamRepository,
  TimeEntryRepository,
  UserRepository,
} from "../repositories/index.js";
import {
  ActivitiesService,
  AnalyticsService,
  ApprovalsService,
  AuthService,
  CalendarService,
  CommentsService,
  ProjectsService,
  TasksService,
  TeamsService,
  TimeTrackingService,
  UsersService,
} from "../services/index.js";
import { signAccessToken } from "../middleware/auth.js";

const userRepository = new UserRepository();
const projectRepository = new ProjectRepository();
const activityRepository = new ActivityRepository();
const taskRepository = new TaskRepository();
const timeEntryRepository = new TimeEntryRepository();
const approvalRepository = new ApprovalRepository();
const commentRepository = new CommentRepository();
const holidayRepository = new HolidayRepository();
const teamRepository = new TeamRepository();

export const authService = new AuthService(userRepository, { sign: signAccessToken });
export const usersService = new UsersService(userRepository);
export const projectsService = new ProjectsService(
  projectRepository,
  activityRepository,
  taskRepository,
);
export const activitiesService = new ActivitiesService(
  activityRepository,
  projectRepository,
  taskRepository,
);
export const tasksService = new TasksService(
  taskRepository,
  userRepository,
  timeEntryRepository,
  commentRepository,
  projectRepository,
  activityRepository,
  approvalRepository,
  teamRepository,
);
export const teamsService = new TeamsService(teamRepository, userRepository);
export const approvalsService = new ApprovalsService(
  approvalRepository,
  taskRepository,
  timeEntryRepository,
  userRepository,
);
export const commentsService = new CommentsService(commentRepository);
export const calendarService = new CalendarService(holidayRepository);
export const timeTrackingService = new TimeTrackingService(timeEntryRepository, userRepository);
export const analyticsService = new AnalyticsService(
  timeEntryRepository,
  approvalRepository,
  userRepository,
  taskRepository,
  projectRepository,
  activityRepository,
);
