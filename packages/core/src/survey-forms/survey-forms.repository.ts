import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";

type DbLike = Db | DbTransaction;

export type SurveyFormRecord = typeof schema.surveyForms.$inferSelect & {
  createdBy: { id: string; name: string; email: string };
  questions: Array<typeof schema.surveyFormQuestions.$inferSelect>;
  _count: { responses: number; questions: number };
};

async function loadQuestions(db: DbLike, surveyFormId: string) {
  return db
    .select()
    .from(schema.surveyFormQuestions)
    .where(eq(schema.surveyFormQuestions.surveyFormId, surveyFormId))
    .orderBy(asc(schema.surveyFormQuestions.order));
}

async function hydrateSurvey(db: DbLike, row: typeof schema.surveyForms.$inferSelect): Promise<SurveyFormRecord> {
  const [creator] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, row.createdById))
    .limit(1);
  const questions = await loadQuestions(db, row.id);
  const [[respCount], [qCount]] = await Promise.all([
    db.select({ n: count() }).from(schema.surveyFormResponses).where(eq(schema.surveyFormResponses.surveyFormId, row.id)),
    db.select({ n: count() }).from(schema.surveyFormQuestions).where(eq(schema.surveyFormQuestions.surveyFormId, row.id)),
  ]);
  return {
    ...row,
    createdBy: creator ?? { id: row.createdById, name: "", email: "" },
    questions,
    _count: { responses: Number(respCount?.n ?? 0), questions: Number(qCount?.n ?? 0) },
  };
}

export async function findSurveyForms(
  db: Db,
  filters: {
    status?: string;
    createdById?: string;
    archived?: boolean;
  },
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const parts: SQL[] = [];
  if (filters.status) parts.push(eq(schema.surveyForms.status, filters.status));
  if (filters.createdById) parts.push(eq(schema.surveyForms.createdById, filters.createdById));
  parts.push(filters.archived ? isNotNull(schema.surveyForms.archivedAt) : isNull(schema.surveyForms.archivedAt));
  const where = and(...parts);

  const [totalRow] = await db.select({ n: count() }).from(schema.surveyForms).where(where);
  const rows = await db
    .select()
    .from(schema.surveyForms)
    .where(where)
    .orderBy(asc(schema.surveyForms.status), desc(schema.surveyForms.createdAt))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((r) => hydrateSurvey(db, r)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findSurveyFormById(db: Db, id: string) {
  const [row] = await db.select().from(schema.surveyForms).where(eq(schema.surveyForms.id, id)).limit(1);
  if (!row) return null;
  return hydrateSurvey(db, row);
}

export async function findSurveyFormMeta(db: Db, id: string) {
  const [row] = await db
    .select({
      id: schema.surveyForms.id,
      createdById: schema.surveyForms.createdById,
      status: schema.surveyForms.status,
      archivedAt: schema.surveyForms.archivedAt,
      title: schema.surveyForms.title,
      isAnonymous: schema.surveyForms.isAnonymous,
    })
    .from(schema.surveyForms)
    .where(eq(schema.surveyForms.id, id))
    .limit(1);
  return row ?? null;
}

export async function countSurveyFormQuestions(db: Db, id: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.surveyFormQuestions)
    .where(eq(schema.surveyFormQuestions.surveyFormId, id));
  return Number(row?.n ?? 0);
}

export async function createSurveyForm(
  db: Db,
  data: {
    title: string;
    description?: string | null;
    isAnonymous: boolean;
    targetAll: boolean;
    targetEntityIds: string[];
    targetDepartments: string[];
    targetUserIds: string[];
    startDate?: string | null;
    endDate?: string | null;
    createdById: string;
    questions: Array<{
      order: number;
      type: string;
      prompt: string;
      helperText?: string | null;
      required: boolean;
      options: unknown;
      settings: unknown;
    }>;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.surveyForms).values({
    id,
    title: data.title,
    description: data.description ?? null,
    isAnonymous: data.isAnonymous,
    targetAll: data.targetAll,
    targetEntityIds: data.targetEntityIds,
    targetDepartments: data.targetDepartments,
    targetUserIds: data.targetUserIds,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    createdById: data.createdById,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });
  if (data.questions.length > 0) {
    await db.insert(schema.surveyFormQuestions).values(
      data.questions.map((q) => ({
        id: crypto.randomUUID(),
        surveyFormId: id,
        order: q.order,
        type: q.type,
        prompt: q.prompt,
        helperText: q.helperText ?? null,
        required: q.required,
        options: q.options,
        settings: q.settings,
      })),
    );
  }
  return findSurveyFormById(db, id);
}

export async function updateSurveyForm(
  db: Db,
  id: string,
  patch: Partial<{
    title: string;
    description: string | null;
    isAnonymous: boolean;
    targetAll: boolean;
    targetEntityIds: string[];
    targetDepartments: string[];
    targetUserIds: string[];
    startDate: string | null;
    endDate: string | null;
    status: string;
    publishedAt: string | null;
    closedAt: string | null;
    archivedAt: string | null;
  }>,
) {
  await db
    .update(schema.surveyForms)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(schema.surveyForms.id, id));
  return findSurveyFormById(db, id);
}

export async function deleteSurveyForm(db: Db, id: string) {
  await db.delete(schema.surveyForms).where(eq(schema.surveyForms.id, id));
}

export async function replaceSurveyFormQuestions(
  db: Db,
  surveyFormId: string,
  questions: Array<{
    order: number;
    type: string;
    prompt: string;
    helperText?: string | null;
    required: boolean;
    options: unknown;
    settings: unknown;
  }>,
) {
  return db.transaction(async (tx) => {
    await tx.delete(schema.surveyFormQuestions).where(eq(schema.surveyFormQuestions.surveyFormId, surveyFormId));
    if (questions.length > 0) {
      await tx.insert(schema.surveyFormQuestions).values(
        questions.map((q) => ({
          id: crypto.randomUUID(),
          surveyFormId,
          order: q.order,
          type: q.type,
          prompt: q.prompt,
          helperText: q.helperText ?? null,
          required: q.required,
          options: q.options,
          settings: q.settings,
        })),
      );
    }
    const [row] = await tx.select().from(schema.surveyForms).where(eq(schema.surveyForms.id, surveyFormId)).limit(1);
    if (!row) return null;
    return hydrateSurvey(tx, row);
  });
}

export async function findUserTargeting(db: Db, userId: string) {
  const [row] = await db
    .select({
      id: schema.users.id,
      entityId: schema.users.entityId,
      department: schema.users.department,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function findSurveyFormWithQuestions(db: Db, id: string) {
  const [row] = await db.select().from(schema.surveyForms).where(eq(schema.surveyForms.id, id)).limit(1);
  if (!row) return null;
  const questions = await loadQuestions(db, id);
  return { ...row, questions };
}

export async function findMyResponse(db: Db, surveyFormId: string, respondentId: string) {
  const [response] = await db
    .select()
    .from(schema.surveyFormResponses)
    .where(
      and(eq(schema.surveyFormResponses.surveyFormId, surveyFormId), eq(schema.surveyFormResponses.respondentId, respondentId)),
    )
    .limit(1);
  if (!response) return null;
  const answers = await db
    .select()
    .from(schema.surveyFormAnswers)
    .where(eq(schema.surveyFormAnswers.responseId, response.id));
  return { ...response, answers };
}

export async function findResponsesBySurveyIds(db: Db, surveyIds: string[], respondentId: string) {
  if (surveyIds.length === 0) return [];
  return db
    .select({ surveyFormId: schema.surveyFormResponses.surveyFormId })
    .from(schema.surveyFormResponses)
    .where(
      and(
        inArray(schema.surveyFormResponses.surveyFormId, surveyIds),
        eq(schema.surveyFormResponses.respondentId, respondentId),
      ),
    );
}

export async function createSurveyFormResponse(
  db: Db,
  data: {
    surveyFormId: string;
    respondentId: string | null;
    answers: Array<{ questionId: string; value: unknown }>;
  },
) {
  return db.transaction(async (tx) => {
    const responseId = crypto.randomUUID();
    await tx.insert(schema.surveyFormResponses).values({
      id: responseId,
      surveyFormId: data.surveyFormId,
      respondentId: data.respondentId,
    });
    if (data.answers.length > 0) {
      await tx.insert(schema.surveyFormAnswers).values(
        data.answers.map((a) => ({
          id: crypto.randomUUID(),
          responseId,
          questionId: a.questionId,
          value: a.value,
        })),
      );
    }
    const [response] = await tx
      .select()
      .from(schema.surveyFormResponses)
      .where(eq(schema.surveyFormResponses.id, responseId))
      .limit(1);
    const answers = await tx
      .select()
      .from(schema.surveyFormAnswers)
      .where(eq(schema.surveyFormAnswers.responseId, responseId));
    return response ? { ...response, answers } : null;
  });
}

export async function listSurveyFormResponses(db: Db, surveyFormId: string, isAnonymous: boolean) {
  const responses = await db
    .select()
    .from(schema.surveyFormResponses)
    .where(eq(schema.surveyFormResponses.surveyFormId, surveyFormId))
    .orderBy(desc(schema.surveyFormResponses.submittedAt));

  if (responses.length === 0) return [];

  const responseIds = responses.map((r) => r.id);
  const answers = await db
    .select()
    .from(schema.surveyFormAnswers)
    .where(inArray(schema.surveyFormAnswers.responseId, responseIds));

  const answersByResponse = new Map<string, typeof answers>();
  for (const a of answers) {
    const list = answersByResponse.get(a.responseId) ?? [];
    list.push(a);
    answersByResponse.set(a.responseId, list);
  }

  let respondents = new Map<string, { id: string; name: string; email: string; department: string | null }>();
  if (!isAnonymous) {
    const respondentIds = [...new Set(responses.map((r) => r.respondentId).filter(Boolean))] as string[];
    if (respondentIds.length > 0) {
      const rows = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          department: schema.users.department,
        })
        .from(schema.users)
        .where(inArray(schema.users.id, respondentIds));
      respondents = new Map(rows.map((r) => [r.id, r]));
    }
  }

  return responses.map((r) => ({
    ...r,
    respondent: !isAnonymous && r.respondentId ? respondents.get(r.respondentId) ?? null : null,
    answers: answersByResponse.get(r.id) ?? [],
  }));
}

export async function countSurveyFormResponses(db: Db, surveyFormId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.surveyFormResponses)
    .where(eq(schema.surveyFormResponses.surveyFormId, surveyFormId));
  return Number(row?.n ?? 0);
}

export async function listSurveyFormAnswersForAnalytics(db: Db, surveyFormId: string) {
  return db
    .select({
      questionId: schema.surveyFormAnswers.questionId,
      value: schema.surveyFormAnswers.value,
    })
    .from(schema.surveyFormAnswers)
    .innerJoin(schema.surveyFormQuestions, eq(schema.surveyFormQuestions.id, schema.surveyFormAnswers.questionId))
    .where(eq(schema.surveyFormQuestions.surveyFormId, surveyFormId));
}

export async function findUserEmail(db: Db, userId: string) {
  const [row] = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row?.email ?? null;
}

export async function findUserName(db: Db, userId: string) {
  const [row] = await db
    .select({ name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row?.name ?? null;
}

export async function findNotificationEmails(db: Db, ownerId: string) {
  const rows = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .innerJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(
      and(
        eq(schema.users.isActive, true),
        or(
          eq(schema.users.id, ownerId),
          inArray(schema.roles.name, ["Admin", "HR Manager", "HR"]),
        ),
      ),
    );
  return [...new Set(rows.map((r) => r.email))];
}

export async function repairWallSurveyLinks(db: Db, title: string, linkUrl: string) {
  const result = await db
    .update(schema.wallPosts)
    .set({ linkUrl, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.wallPosts.type, "survey"),
        isNull(schema.wallPosts.linkUrl),
        ilike(schema.wallPosts.content, `%${title}%`),
      ),
    )
    .returning({ id: schema.wallPosts.id });
  return result.length;
}

export async function countWallByLink(db: Db, linkUrl: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.wallPosts)
    .where(eq(schema.wallPosts.linkUrl, linkUrl));
  return Number(row?.n ?? 0);
}

export async function setWallLink(db: Db, postId: string, linkUrl: string) {
  await db
    .update(schema.wallPosts)
    .set({ linkUrl, updatedAt: new Date().toISOString() })
    .where(eq(schema.wallPosts.id, postId));
}

export async function repairNewsSurveyLinks(db: Db, title: string, linkUrl: string) {
  const result = await db
    .update(schema.companyNews)
    .set({ linkUrl, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.companyNews.title, title), isNull(schema.companyNews.linkUrl)))
    .returning({ id: schema.companyNews.id });
  return result.length;
}

export async function countNewsByLink(db: Db, linkUrl: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.companyNews)
    .where(eq(schema.companyNews.linkUrl, linkUrl));
  return Number(row?.n ?? 0);
}

export async function setNewsLink(db: Db, newsId: string, linkUrl: string) {
  await db
    .update(schema.companyNews)
    .set({ linkUrl, updatedAt: new Date().toISOString() })
    .where(eq(schema.companyNews.id, newsId));
}

export async function repairCompanyDateSurveyLinks(db: Db, title: string, linkUrl: string) {
  const result = await db
    .update(schema.companyDates)
    .set({ linkUrl })
    .where(and(eq(schema.companyDates.title, title), isNull(schema.companyDates.linkUrl)))
    .returning({ id: schema.companyDates.id });
  return result.length;
}

export async function countCompanyDateByLink(db: Db, linkUrl: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.companyDates)
    .where(eq(schema.companyDates.linkUrl, linkUrl));
  return Number(row?.n ?? 0);
}

export async function setCompanyDateLink(db: Db, dateId: string, linkUrl: string) {
  await db.update(schema.companyDates).set({ linkUrl }).where(eq(schema.companyDates.id, dateId));
}
