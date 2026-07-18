import {
  ApiError,
  benefitCatalogQueryKey,
  listBenefitCatalog,
  listMyBenefitEnrollments,
  myBenefitEnrollmentsQueryKey,
  type BenefitCatalogItem,
  type MyBenefitEnrollment,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  radii,
  spacing,
  StatusMessage,
} from "@manut/ui";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { benefitCategoryLabel } from "@/features/benefits/benefit-category-label";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadBenefits(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("benefits:read") ||
    hasPermission("benefits:enroll") ||
    hasPermission("benefits:manage")
  );
}

function formatMoney(value: string, currency: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function CatalogRow({ benefit }: { benefit: BenefitCatalogItem }) {
  return (
    <View
      style={{
        gap: spacing.xs,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {benefit.name} · {benefitCategoryLabel(benefit.category)}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {benefit.provider ?? "No provider listed"}
        {benefit.entityName ? ` · ${benefit.entityName}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {formatMoney(benefit.cost, benefit.currency)}
        {benefit.isActive ? "" : " · Inactive"}
        {` · ${benefit.enrollmentCount} enrolled`}
      </Text>
      {benefit.description ? (
        <Text selectable style={{ color: colors.textMuted }}>
          {benefit.description}
        </Text>
      ) : null}
    </View>
  );
}

function EnrollmentRow({ enrollment }: { enrollment: MyBenefitEnrollment }) {
  return (
    <View
      style={{
        gap: spacing.xs,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {enrollment.benefitName} · {enrollment.status}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {benefitCategoryLabel(enrollment.benefitCategory)}
        {enrollment.provider ? ` · ${enrollment.provider}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        Started {enrollment.startDate}
        {enrollment.endDate ? ` · Ends ${enrollment.endDate}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {formatMoney(enrollment.cost, enrollment.currency)}
      </Text>
    </View>
  );
}

export function BenefitsScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadBenefits(hasPermission);

  const catalogQuery = useQuery({
    queryKey: benefitCatalogQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listBenefitCatalog(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  const enrollmentsQuery = useQuery({
    queryKey: myBenefitEnrollmentsQueryKey(),
    queryFn: ({ signal }) => listMyBenefitEnrollments(api, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Card title="Benefits" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view benefits.
          </StatusMessage>
        </Card>
      </ScrollView>
    );
  }

  const loading = catalogQuery.isPending || enrollmentsQuery.isPending;
  const error = catalogQuery.isError
    ? catalogQuery.error
    : enrollmentsQuery.isError
      ? enrollmentsQuery.error
      : null;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        paddingBottom: spacing.xxl,
      }}
    >
      <Card title="Benefits" maxWidth={720}>
        <Text selectable style={{ color: colors.textMuted }}>
          Catalog and your enrollments. Enroll, unenroll, manage, and bulk
          import stay deferred for a later slice.
        </Text>
      </Card>

      {loading ? <LoadingState label="Loading benefits…" /> : null}

      {error ? (
        <Card title="Unable to load benefits" maxWidth={720}>
          <StatusMessage tone="error">
            {errorMessage(error, "We could not load benefits.")}
          </StatusMessage>
          <Button
            label="Retry"
            pendingLabel="Retrying…"
            onPress={() => {
              void catalogQuery.refetch();
              void enrollmentsQuery.refetch();
            }}
          />
        </Card>
      ) : null}

      {enrollmentsQuery.isSuccess ? (
        <Card title="My enrollments" maxWidth={720}>
          {enrollmentsQuery.data.length === 0 ? (
            <StatusMessage tone="info">
              You have no benefit enrollments yet.
            </StatusMessage>
          ) : (
            <View style={{ gap: spacing.md }}>
              {enrollmentsQuery.data.map((enrollment) => (
                <EnrollmentRow key={enrollment.id} enrollment={enrollment} />
              ))}
            </View>
          )}
        </Card>
      ) : null}

      {catalogQuery.isSuccess ? (
        <Card title="Catalog" maxWidth={720}>
          {catalogQuery.data.data.length === 0 ? (
            <StatusMessage tone="info">
              No benefits are available in the catalog.
            </StatusMessage>
          ) : (
            <View style={{ gap: spacing.md }}>
              {catalogQuery.data.data.map((benefit) => (
                <CatalogRow key={benefit.id} benefit={benefit} />
              ))}
            </View>
          )}
        </Card>
      ) : null}
    </ScrollView>
  );
}
