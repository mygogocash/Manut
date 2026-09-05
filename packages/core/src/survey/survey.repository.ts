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

export type SurveyFormRow = typeof schema.surveys.$inferSelect & {
  createdBy: { id: string; name: string; email: string };
  questions: Array<typeof schema.surveyQuestions.$inferSelect>;
  _count: { responses: number; questions: number };
};

async function loadQuestions(db: DbLike, surveyId: string) {
  return db
    .select()
    .from(schema.surveyQuestions)
    .where(eq(schema.surveyQuestions.surveyId, surveyId))
    .orderBy(asc(schema.surveyQuestions.order));
}

async function hydrateSurvey(db: DbLike, row: typeof schema.surveys.$inferSelect): Promise<SurveyFormRow> {
  const [creator] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, row.createdById))
    .limit(1);
  const questions = await loadQuestions(db, row.id);
  const [[respCount], [qCount]] = await Promise.all([
    db.select({ n: count() }).from(schema.surveyResponses).where(eq(schema.surveyResponses.surveyId, row.id)),
    db.select({ n: count() }).from(schema.surveyQuestions).where(eq(schema.surveyQuestions.surveyId, row.id)),
  ]);
  return {
    ...row,
    createdBy: creator ?? { id: row.createdById, name: "", email: "" },
    questions,
    _count: { responses: Number(respCount?.n ?? 0), questions: Number(qCount?.n ?? 0) },
  };
}

export async function findSurveys(
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
  if (filters.status) parts.push(eq(schema.surveys.status, filters.status));
  if (filters.createdById) parts.push(eq(schema.surveys.createdById, filters.createdById));
  parts.push(filters.archived ? isNotNull(schema.surveys.archivedAt) : isNull(schema.surveys.archivedAt));
  const where = and(...parts);

  const [totalRow] = await db.select({ n: count() }).from(schema.surveys).where(where);
  const rows = await db
    .select()
    .from(schema.surveys)
    .where(where)
    .orderBy(asc(schema.surveys.status), desc(schema.surveys.createdAt))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((r) => hydrateSurvey(db, r)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findSurveyById(db: Db, id: string) {
  const [row] = await db.select().from(schema.surveys).where(eq(schema.surveys.id, id)).limit(1);
  if (!row) return null;
  return hydrateSurvey(db, row);
}

export async function findSurveyMeta(db: Db, id: string) {
  const [row] = await db
    .select({
      id: schema.surveys.id,
      createdById: schema.surveys.createdById,
      status: schema.surveys.status,
      archivedAt: schema.surveys.archivedAt,
      title: schema.surveys.title,
      isAnonymous: schema.surveys.isAnonymous,
    })
    .from(schema.surveys)
    .where(eq(schema.surveys.id, id))
    .limit(1);
  return row ?? null;
}

export async function countSurveyQuestions(db: Db, id: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.surveyQuestions)
    .where(eq(schema.surveyQuestions.surveyId, id));
  return Number(row?.n ?? 0);
}

export async function createSurvey(
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
  await db.insert(schema.surveys).values({
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
    await db.insert(schema.surveyQuestions).values(
      data.questions.map((q) => ({
        id: crypto.randomUUID(),
        surveyId: id,
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
  return findSurveyById(db, id);
}

export async function updateSurvey(
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
    .update(schema.surveys)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(schema.surveys.id, id));
  return findSurveyById(db, id);
}

export async function deleteSurvey(db: Db, id: string) {
  await db.delete(schema.surveys).where(eq(schema.surveys.id, id));
}

export async function replaceSurveyQuestions(
  db: Db,
  surveyId: string,
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
    await tx.delete(schema.surveyQuestions).where(eq(schema.surveyQuestions.surveyId, surveyId));
    if (questions.length > 0) {
      await tx.insert(schema.surveyQuestions).values(
        questions.map((q) => ({
          id: crypto.randomUUID(),
          surveyId,
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
    const [row] = await tx.select().from(schema.surveys).where(eq(schema.surveys.id, surveyId)).limit(1);
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

export async function findSurveyWithQuestions(db: Db, id: string) {
  const [row] = await db.select().from(schema.surveys).where(eq(schema.surveys.id, id)).limit(1);
  if (!row) return null;
  const questions = await loadQuestions(db, id);
  return { ...row, questions };
}

export async function findMyResponse(db: Db, surveyId: string, respondentId: string) {
  const [response] = await db
    .select()
    .from(schema.surveyResponses)
    .where(
      and(eq(schema.surveyResponses.surveyId, surveyId), eq(schema.surveyResponses.respondentId, respondentId)),
    )
    .limit(1);
  if (!response) return null;
  const answers = await db
    .select()
    .from(schema.surveyAnswers)
    .where(eq(schema.surveyAnswers.responseId, response.id));
  return { ...response, answers };
}

export async function findResponsesBySurveyIds(db: Db, surveyIds: string[], respondentId: string) {
  if (surveyIds.length === 0) return [];
  return db
    .select({ surveyId: schema.surveyResponses.surveyId })
    .from(schema.surveyResponses)
    .where(
      and(
        inArray(schema.surveyResponses.surveyId, surveyIds),
        eq(schema.surveyResponses.respondentId, respondentId),
      ),
    );
}

export async function createSurveyResponse(
  db: Db,
  data: {
    surveyId: string;
    respondentId: string | null;
    answers: Array<{ questionId: string; value: unknown }>;
  },
) {
  return db.transaction(async (tx) => {
    const responseId = crypto.randomUUID();
    await tx.insert(schema.surveyResponses).values({
      id: responseId,
      surveyId: data.surveyId,
      respondentId: data.respondentId,
    });
    if (data.answers.length > 0) {
      await tx.insert(schema.surveyAnswers).values(
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
      .from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.id, responseId))
      .limit(1);
    const answers = await tx
      .select()
      .from(schema.surveyAnswers)
      .where(eq(schema.surveyAnswers.responseId, responseId));
    return response ? { ...response, answers } : null;
  });
}

export async function listSurveyResponses(db: Db, surveyId: string, isAnonymous: boolean) {
  const responses = await db
    .select()
    .from(schema.surveyResponses)
    .where(eq(schema.surveyResponses.surveyId, surveyId))
    .orderBy(desc(schema.surveyResponses.submittedAt));

  if (responses.length === 0) return [];

  const responseIds = responses.map((r) => r.id);
  const answers = await db
    .select()
    .from(schema.surveyAnswers)
    .where(inArray(schema.surveyAnswers.responseId, responseIds));

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

export async function countSurveyResponses(db: Db, surveyId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.surveyResponses)
    .where(eq(schema.surveyResponses.surveyId, surveyId));
  return Number(row?.n ?? 0);
}

export async function listSurveyAnswersForAnalytics(db: Db, surveyId: string) {
  return db
    .select({
      questionId: schema.surveyAnswers.questionId,
      value: schema.surveyAnswers.value,
    })
    .from(schema.surveyAnswers)
    .innerJoin(schema.surveyQuestions, eq(schema.surveyQuestions.id, schema.surveyAnswers.questionId))
    .where(eq(schema.surveyQuestions.surveyId, surveyId));
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
