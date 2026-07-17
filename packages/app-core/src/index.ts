export { ApiClient } from "./api/api-client";
export type { ApiClientOptions, ApiRequestOptions } from "./api/api-client";
export { ApiError, errorStatus } from "./api/api-error";
export type {
  HttpExecutor,
  HttpMethod,
  ApiSuccess,
  Paginated,
  PaginationMeta,
  RequestAbortSignal,
  RequestCredentialsMode,
  SessionTransport,
  TransportRequest,
  TransportResponse,
} from "./api/api-types";
export {
  AuthController,
  authError,
  isTerminalAuthError,
} from "./auth/auth-controller";
export {
  isEmployeeOnly,
  postLoginPath,
  sanitizeReturnPath,
} from "./auth/return-path";
export { parseAuthLink } from "./auth/auth-link";
export type { AuthLinkParseResult, AuthLinkPurpose } from "./auth/auth-link";
export {
  AUTH_MIN_PASSWORD_LENGTH,
  authEmailSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from "./auth/auth-schemas";
export type {
  AuthEmailInput,
  AuthSchema,
  AuthSchemaResult,
  AuthValidationIssue,
  ChangePasswordFormInput,
  ResetPasswordFormInput,
} from "./auth/auth-schemas";
export type {
  AuthGateway,
  AuthLinkResponse,
  AuthLinkTokens,
  AuthRole,
  AuthSession,
  AuthState,
  AuthStatus,
  AuthUser,
  ChangePasswordInput,
  RecoverPasswordInput,
  SessionVerificationError,
} from "./auth/auth-types";
export { evaluateRouteAccess, resolveRoutePolicy } from "./rbac/route-policy";
export { ROUTE_OVERRIDES, ROUTE_REGISTRY } from "./rbac/route-registry";
export type {
  RouteAccessDecision,
  RouteAccessInput,
} from "./rbac/route-policy";
export type { RouteOverride, RoutePolicy } from "./rbac/route-registry";
export {
  getMyProfile,
  MY_PROFILE_QUERY_KEY,
  myProfileResponseSchema,
  myProfileSchema,
  profileEntitySchema,
  profileRoleSchema,
  updatedMyProfileResponseSchema,
  updatedMyProfileSchema,
  updateMyProfile,
  updateMyProfileInputSchema,
} from "./profile/profile";
export {
  DIRECTORY_DEPARTMENTS_QUERY_KEY,
  DIRECTORY_DETAIL_QUERY_ROOT,
  DIRECTORY_LIST_QUERY_ROOT,
  DIRECTORY_ORG_CHART_QUERY_KEY,
  departmentSchema,
  directoryDetailQueryKey,
  directoryEmployeeDetailSchema,
  directoryEmployeeSchema,
  directoryEntitySchema,
  directoryListAccessQueryKey,
  directoryListQueryKey,
  directoryManagerSchema,
  directoryParamsSchema,
  getDirectoryDepartments,
  getDirectoryEmployee,
  getDirectoryOrgChart,
  listDirectory,
  orgChartNodeSchema,
} from "./directory/directory";
export {
  createLeaveRequest,
  createLeaveRequestInputSchema,
  cancelLeaveRequest,
  canCancelLeaveRequest,
  getLeaveBalances,
  getLeaveRequests,
  getLeaveTypes,
  halfDayPeriodSchema,
  LEAVE_BALANCES_QUERY_KEY,
  LEAVE_REQUESTS_QUERY_ROOT,
  LEAVE_TYPES_QUERY_KEY,
  leaveBalanceSchema,
  leaveCategorySchema,
  leaveDateSchema,
  leaveDurationTypeSchema,
  leaveEntitySchema,
  leaveRequestListParamsSchema,
  leaveRequestSchema,
  leaveRequestsQueryKey,
  leaveRequestStatusSchema,
  leaveSourceSchema,
  leaveTypeRefSchema,
  leaveTypeSchema,
} from "./leave/leave";
export type {
  CreatedLeaveRequest,
  CreateLeaveRequestInput,
  HalfDayPeriod,
  LeaveBalance,
  LeaveCategory,
  LeaveDurationType,
  LeaveRequest,
  LeaveRequestList,
  LeaveRequestListParams,
  LeaveSource,
  LeaveType,
} from "./leave/leave";
export type {
  DirectoryAccessTier,
  Department,
  DirectoryDirectReport,
  DirectoryEmployee,
  DirectoryEmployeeDetail,
  DirectoryEntity,
  DirectoryList,
  DirectoryManager,
  DirectoryParams,
  OrgChartNode,
} from "./directory/directory";
export type {
  MyProfile,
  ProfileEntity,
  ProfileRole,
  UpdatedMyProfile,
  UpdateMyProfileInput,
} from "./profile/profile";
export {
  PERFORMANCE_APPRAISALS_QUERY_ROOT,
  PERFORMANCE_DETAIL_QUERY_ROOT,
  appraisalGoalSchema,
  appraisalListParamsSchema,
  appraisalSchema,
  appraisalStatusSchema,
  getAppraisal,
  goalStatusSchema,
  listAppraisals,
  performanceAppraisalsQueryKey,
  performanceDetailQueryKey,
} from "./performance/performance";
export type {
  Appraisal,
  AppraisalGoal,
  AppraisalList,
  AppraisalListParams,
  AppraisalStatus,
} from "./performance/performance";
export {
  DASHBOARD_STATS_QUERY_KEY,
  dashboardKpisSchema,
  dashboardPendingActionSchema,
  dashboardStatsSchema,
  getDashboardStats,
} from "./dashboard/dashboard";
export type {
  DashboardKpis,
  DashboardPendingAction,
  DashboardStats,
} from "./dashboard/dashboard";
export {
  DEFAULT_LOCAL_PREFERENCES,
  localPreferencesSchema,
  mergeLocalPreferences,
  parseLocalPreferences,
} from "./settings/preferences";
export type {
  LocalPreferences,
  LocalPreferencesInput,
} from "./settings/preferences";
export {
  addTravelAttachments,
  addTravelAttachmentsInputSchema,
  approveTravelRequest,
  canCancelTravelRequest,
  cancelTravelRequest,
  createTravelRequest,
  createTravelRequestInputSchema,
  getTravelRequests,
  rejectTravelRequest,
  rejectTravelRequestInputSchema,
  TRAVEL_REQUESTS_QUERY_ROOT,
  travelCategorySchema,
  travelDateSchema,
  travelRequestListParamsSchema,
  travelRequestSchema,
  travelRequestsQueryKey,
  travelRequestStatusSchema,
} from "./travel/travel";
export type {
  AddTravelAttachmentsInput,
  CreatedTravelRequest,
  CreateTravelRequestInput,
  RejectTravelRequestInput,
  TravelCategory,
  TravelRequest,
  TravelRequestList,
  TravelRequestListParams,
  TravelRequestStatus,
} from "./travel/travel";
export {
  addExpenseLine,
  addExpenseLineInputSchema,
  canSubmitExpenseReport,
  createExpenseReport,
  createExpenseReportInputSchema,
  EXPENSE_FORM_ENTITIES_QUERY_KEY,
  EXPENSE_REPORT_DETAIL_QUERY_ROOT,
  EXPENSE_REPORTS_QUERY_ROOT,
  expensePeriodSchema,
  expenseReportCategorySchema,
  expenseReportDetailQueryKey,
  expenseReportListParamsSchema,
  expenseReportSchema,
  expenseReportsQueryKey,
  expenseReportStatusSchema,
  getExpenseReport,
  listExpenseFormEntities,
  listExpenseReports,
  submitExpenseReport,
} from "./expenses/expenses";
export type {
  AddExpenseLineInput,
  CreateExpenseReportInput,
  ExpenseFormEntity,
  ExpenseLine,
  ExpenseReport,
  ExpenseReportCategory,
  ExpenseReportDetail,
  ExpenseReportList,
  ExpenseReportListParams,
  ExpenseReportStatus,
} from "./expenses/expenses";
export {
  ADMIN_USERS_QUERY_ROOT,
  adminUserListParamsSchema,
  adminUserSchema,
  adminUsersQueryKey,
  listAdminUsers,
} from "./admin/admin-users";
export type {
  AdminUser,
  AdminUserList,
  AdminUserListParams,
} from "./admin/admin-users";
export { ROLES_QUERY_KEY, listRoles, roleSchema } from "./admin/roles";
export type { Role } from "./admin/roles";
