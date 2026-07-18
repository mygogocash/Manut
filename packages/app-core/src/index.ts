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
export {
  LEAVE_APPROVAL_STEPS_QUERY_KEY,
  leaveApprovalStepSchema,
  leaveApproverTypeLabel,
  listLeaveApprovalSteps,
} from "./leave/leave-approval-steps";
export type {
  LeaveApprovalStep,
  LeaveApproverType,
} from "./leave/leave-approval-steps";
export {
  LEAVE_POLICIES_QUERY_KEY,
  leaveCategoryLabel,
  leavePoliciesQueryKey,
  leavePolicyListParamsSchema,
  leavePolicySchema,
  listLeavePolicies,
} from "./leave/leave-policies";
export type {
  LeavePolicy,
  LeavePolicyListParams,
} from "./leave/leave-policies";
export {
  LEAVE_CALENDAR_QUERY_ROOT,
  leaveCalendarEntrySchema,
  leaveCalendarParamsSchema,
  leaveCalendarQueryKey,
  listLeaveCalendar,
} from "./leave/leave-calendar";
export type {
  LeaveCalendarEntry,
  LeaveCalendarParams,
} from "./leave/leave-calendar";
export {
  LEAVE_TEAM_REQUESTS_QUERY_ROOT,
  approveLeaveRequest,
  canActOnLeaveRequest,
  leaveTeamRequestListParamsSchema,
  leaveTeamRequestSchema,
  leaveTeamRequestsQueryKey,
  listLeaveTeamRequests,
  rejectLeaveRequest,
  rejectLeaveRequestInputSchema,
} from "./leave/leave-team";
export type {
  ActedLeaveRequest,
  LeaveTeamRequest,
  LeaveTeamRequestList,
  LeaveTeamRequestListParams,
  RejectLeaveRequestInput,
} from "./leave/leave-team";
export {
  HOLIDAYS_QUERY_ROOT,
  holidayListParamsSchema,
  holidaysQueryKey,
  listHolidays,
  publicHolidaySchema,
} from "./holidays/holidays";
export type {
  HolidayList,
  HolidayListParams,
  PublicHoliday,
} from "./holidays/holidays";
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
  dashboardDepartmentSchema,
  dashboardExpenseSummarySchema,
  dashboardKpisSchema,
  dashboardPendingActionSchema,
  dashboardProjectStatusSchema,
  dashboardStatsSchema,
  getDashboardStats,
} from "./dashboard/dashboard";
export type {
  DashboardDepartment,
  DashboardExpenseSummary,
  DashboardKpis,
  DashboardPendingAction,
  DashboardProjectStatus,
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
  disconnectGoogle,
  getIntegrationsStatus,
  INTEGRATIONS_STATUS_QUERY_KEY,
  integrationsStatusSchema,
  oauthReturnMessage,
  startGoogleOauth,
} from "./integrations/integrations";
export type {
  GoogleConnectionStatus,
  IntegrationsStatus,
} from "./integrations/integrations";
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
  EXPENSE_APPROVAL_STEPS_QUERY_KEY,
  expenseApprovalStepSchema,
  expenseApproverTypeLabel,
  listExpenseApprovalSteps,
} from "./expenses/expense-approval-steps";
export type {
  ExpenseApprovalStep,
  ExpenseApproverType,
} from "./expenses/expense-approval-steps";
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
export {
  ATTENDANCE_TODAY_QUERY_KEY,
  attendanceRecordSchema,
  attendanceStatusSchema,
  attendanceWorkModeSchema,
  checkInAttendance,
  checkInAttendanceInputSchema,
  checkOutAttendance,
  checkOutAttendanceInputSchema,
  ESOP_GRANTS_QUERY_ROOT,
  esopGrantListParamsSchema,
  esopGrantSchema,
  esopGrantStatusSchema,
  esopGrantTypeSchema,
  esopGrantsQueryKey,
  esopValueTypeSchema,
  getAttendanceToday,
  listEsopGrants,
  listOnboardingRuns,
  ONBOARDING_RUNS_QUERY_ROOT,
  onboardingRunListParamsSchema,
  onboardingRunSchema,
  onboardingRunsQueryKey,
} from "./hrms/hrms";
export type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceWorkMode,
  CheckInAttendanceInput,
  CheckOutAttendanceInput,
  EsopGrant,
  EsopGrantList,
  EsopGrantListParams,
  EsopGrantStatus,
  EsopGrantType,
  EsopValueType,
  OnboardingRun,
  OnboardingRunList,
  OnboardingRunListParams,
} from "./hrms/hrms";
export {
  getVisa,
  getVisaDownloadUrl,
  listVisas,
  VISA_DETAIL_QUERY_ROOT,
  VISAS_QUERY_ROOT,
  visaDetailQueryKey,
  visaDocumentCategorySchema,
  visaDownloadParamsSchema,
  visaHolderTypeSchema,
  visaListParamsSchema,
  visaRecordDetailSchema,
  visaRecordSchema,
  visaStatusSchema,
  visasQueryKey,
} from "./visa/visa";
export type {
  VisaDocumentCategory,
  VisaDownload,
  VisaDownloadParams,
  VisaHolderType,
  VisaList,
  VisaListParams,
  VisaRecord,
  VisaRecordDetail,
  VisaStatus,
} from "./visa/visa";
export {
  canDeleteCashAdvanceDraft,
  canSubmitCashAdvance,
  CASH_ADVANCES_QUERY_ROOT,
  cashAdvanceListParamsSchema,
  cashAdvancePayoutModeSchema,
  cashAdvanceRequestSchema,
  cashAdvancesQueryKey,
  cashAdvanceStatusSchema,
  createCashAdvance,
  createCashAdvanceInputSchema,
  createCashAdvanceItemInputSchema,
  deleteCashAdvance,
  listCashAdvances,
  submitCashAdvance,
} from "./cash-advance/cash-advance";
export type {
  CashAdvanceList,
  CashAdvanceListParams,
  CashAdvancePayoutMode,
  CashAdvanceRequest,
  CashAdvanceStatus,
  CreateCashAdvanceInput,
} from "./cash-advance/cash-advance";
export {
  CASH_ADVANCE_APPROVAL_STEPS_QUERY_KEY,
  cashAdvanceApprovalStepSchema,
  cashAdvanceApproverTypeLabel,
  listCashAdvanceApprovalSteps,
} from "./cash-advance/cash-advance-approval-steps";
export type {
  CashAdvanceApprovalStep,
  CashAdvanceApproverType,
} from "./cash-advance/cash-advance-approval-steps";
export {
  listPayrollRuns,
  PAYROLL_RUNS_QUERY_ROOT,
  payrollPeriodSchema,
  payrollRunListParamsSchema,
  payrollRunSchema,
  payrollRunsQueryKey,
  payrollRunStatusSchema,
} from "./payroll/payroll";
export type {
  PayrollRun,
  PayrollRunList,
  PayrollRunListParams,
  PayrollRunStatus,
} from "./payroll/payroll";
export {
  BENEFIT_CATALOG_QUERY_ROOT,
  benefitCatalogListParamsSchema,
  benefitCatalogQueryKey,
  benefitCatalogItemSchema,
  benefitCategorySchema,
  listBenefitCatalog,
  listMyBenefitEnrollments,
  MY_BENEFIT_ENROLLMENTS_QUERY_ROOT,
  myBenefitEnrollmentSchema,
  myBenefitEnrollmentsQueryKey,
} from "./benefits/benefits";
export type {
  BenefitCatalogItem,
  BenefitCatalogList,
  BenefitCatalogListParams,
  BenefitCategory,
  MyBenefitEnrollment,
} from "./benefits/benefits";
export {
  LEARNING_MODULES_QUERY_ROOT,
  learningModuleListParamsSchema,
  learningModuleSchema,
  learningModulesQueryKey,
  listLearningModules,
} from "./learning/learning";
export type {
  LearningModule,
  LearningModuleList,
  LearningModuleListParams,
} from "./learning/learning";
export {
  listOfficeAssets,
  listOfficeRooms,
  listOffices,
  OFFICE_ASSETS_QUERY_ROOT,
  OFFICE_ROOMS_QUERY_ROOT,
  OFFICES_QUERY_ROOT,
  officeAssetListParamsSchema,
  officeAssetSchema,
  officeAssetsQueryKey,
  officeRoomSchema,
  officeRoomsQueryKey,
  officeSchema,
  officesQueryKey,
} from "./office/office";
export type {
  Office,
  OfficeAsset,
  OfficeAssetList,
  OfficeAssetListParams,
  OfficeList,
  OfficeRoom,
  OfficeRoomList,
} from "./office/office";
export {
  CAREER_JOBS_QUERY_ROOT,
  careerJobListParamsSchema,
  careerJobSchema,
  careerJobsQueryKey,
  listCareerJobs,
} from "./careers/careers";
export type {
  CareerJob,
  CareerJobList,
  CareerJobListParams,
} from "./careers/careers";
export {
  APPLICATIONS_QUERY_ROOT,
  applicationListParamsSchema,
  applicationSchema,
  applicationsQueryKey,
  listApplications,
} from "./applications/applications";
export type {
  Application,
  ApplicationList,
  ApplicationListParams,
} from "./applications/applications";
