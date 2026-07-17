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
  listDirectory,
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
} from "./directory/directory";
export type {
  MyProfile,
  ProfileEntity,
  ProfileRole,
  UpdatedMyProfile,
  UpdateMyProfileInput,
} from "./profile/profile";
