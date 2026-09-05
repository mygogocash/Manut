import { PERMISSIONS } from "@nexora/contracts";
import type { PublishAnnounceInput } from "@nexora/contracts/modules/survey-forms/survey-forms.validation";
import type { Db } from "@nexora/db";
import * as companyDatesService from "../company-dates/company-dates.service";
import * as newsService from "../news/news.service";
import * as wallService from "../wall/wall.service";
import {
  buildAnnounceMessage,
  readAnnouncementDefaults,
  type AnnouncementDefaults,
} from "../survey/helpers";
import * as settingsRepo from "../survey/system-settings.repository";
import * as surveyRepo from "./survey-forms.repository";

const ANNOUNCE_SETTINGS_KEY = "survey.announcement_defaults";

async function ensureSurfaceLinked(opts: {
  repairLegacy: () => Promise<number>;
  countLinked: () => Promise<number>;
  create: () => Promise<void>;
}): Promise<void> {
  if ((await opts.repairLegacy()) > 0) return;
  if ((await opts.countLinked()) > 0) return;
  await opts.create();
}

export async function getAnnouncementDefaultsForForms(db: Db): Promise<AnnouncementDefaults> {
  const value = await settingsRepo.getSetting(db, ANNOUNCE_SETTINGS_KEY);
  return readAnnouncementDefaults(value);
}

export async function announcePublishedForm(
  db: Db,
  form: { id: string; title: string },
  userId: string,
  permissions: string[],
  announce: PublishAnnounceInput,
): Promise<string[]> {
  const defaults = await getAnnouncementDefaultsForForms(db);
  const message = buildAnnounceMessage(form.title, announce.message, defaults.messageTemplate);
  const posted: string[] = [];
  const respondLink = `/survey-forms/${form.id}/respond`;

  if (announce.wall && permissions.includes(PERMISSIONS.WALL_CREATE)) {
    try {
      await ensureSurfaceLinked({
        repairLegacy: () => surveyRepo.repairWallSurveyLinks(db, form.title, respondLink),
        countLinked: () => surveyRepo.countWallByLink(db, respondLink),
        create: async () => {
          const post = await wallService.createPost(db, userId, { content: message, type: "survey" });
          if (post?.id) await surveyRepo.setWallLink(db, post.id, respondLink);
        },
      });
      posted.push("Company Wall");
    } catch (err) {
      console.warn(JSON.stringify({ level: "warn", event: "survey_forms_announce_wall_failed", formId: form.id, err: String(err) }));
    }
  }

  if (announce.news && permissions.includes(PERMISSIONS.NEWS_CREATE)) {
    try {
      const newsTitle = `New survey: ${form.title}`;
      await ensureSurfaceLinked({
        repairLegacy: () => surveyRepo.repairNewsSurveyLinks(db, newsTitle, respondLink),
        countLinked: () => surveyRepo.countNewsByLink(db, respondLink),
        create: async () => {
          const news = await newsService.createNews(db, userId, {
            title: newsTitle,
            content: message,
            category: defaults.newsCategory,
            isPinned: false,
          });
          if (news?.id) await surveyRepo.setNewsLink(db, news.id, respondLink);
        },
      });
      posted.push("Company News");
    } catch (err) {
      console.warn(JSON.stringify({ level: "warn", event: "survey_forms_announce_news_failed", formId: form.id, err: String(err) }));
    }
  }

  if (announce.companyDate && announce.deadline && permissions.includes(PERMISSIONS.ADMIN_MANAGE)) {
    try {
      const dateTitle = `Survey closes: ${form.title}`;
      const deadline = announce.deadline.slice(0, 10);
      await ensureSurfaceLinked({
        repairLegacy: () => surveyRepo.repairCompanyDateSurveyLinks(db, dateTitle, respondLink),
        countLinked: () => surveyRepo.countCompanyDateByLink(db, respondLink),
        create: async () => {
          const date = await companyDatesService.create(db, userId, {
            title: dateTitle,
            date: deadline,
            type: "Survey",
          });
          if (date?.id) await surveyRepo.setCompanyDateLink(db, date.id, respondLink);
        },
      });
      posted.push("Company Dates");
    } catch (err) {
      console.warn(JSON.stringify({ level: "warn", event: "survey_forms_announce_date_failed", formId: form.id, err: String(err) }));
    }
  }

  return posted;
}
