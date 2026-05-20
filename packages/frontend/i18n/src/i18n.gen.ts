// @ts-nocheck
/* eslint-disable */
import { createElement, useMemo, type ComponentType, type JSX } from "react";
import { useTranslation, Trans, type TransProps } from "react-i18next";
type TypedTransProps<Value, Components, Context extends string | undefined = undefined> = Omit<TransProps<string, never, never, Context>, "values" | "ns" | "i18nKey"> & ({} extends Value ? {} : {
    values: Value;
}) & {
    components: Components;
};
function createProxy(initValue: (key: string) => any) {
    function define(key: string) {
        const value = initValue(key);
        Object.defineProperty(container, key, { value, configurable: true });
        return value;
    }
    const container = {
        __proto__: new Proxy({ __proto__: null }, {
            get(_, key) {
                if (typeof key === "symbol")
                    return undefined;
                return define(key);
            },
        }),
    };
    return new Proxy(container, {
        getPrototypeOf: () => null,
        setPrototypeOf: (_, v) => v === null,
        getOwnPropertyDescriptor: (_, key) => {
            if (typeof key === "symbol")
                return undefined;
            if (!(key in container))
                define(key);
            return Object.getOwnPropertyDescriptor(container, key);
        },
    });
}
export function useAFFiNEI18N(): {
    /**
      * `Back to my Content`
      */
    ["404.back"](): string;
    /**
      * `Sorry, you do not have access or this content does not exist...`
      */
    ["404.hint"](): string;
    /**
      * `Sign in to another account`
      */
    ["404.signOut"](): string;
    /**
      * `Manut Cloud`
      */
    ["AFFiNE Cloud"](): string;
    /**
      * `Admin`
      */
    Admin(): string;
    /**
      * `All docs`
      */
    ["All pages"](): string;
    /**
      * `Allocating Seat`
      */
    ["Allocating Seat"](): string;
    /**
      * `App version`
      */
    ["App Version"](): string;
    /**
      * `Available offline`
      */
    ["Available Offline"](): string;
    /**
      * `Bold`
      */
    Bold(): string;
    /**
      * `Cancel`
      */
    Cancel(): string;
    /**
      * `Click to replace photo`
      */
    ["Click to replace photo"](): string;
    /**
      * `Collaborator`
      */
    Collaborator(): string;
    /**
      * `Collections`
      */
    Collections(): string;
    /**
      * `Colors`
      */
    Colors(): string;
    /**
      * `Complete`
      */
    Complete(): string;
    /**
      * `Confirm`
      */
    Confirm(): string;
    /**
      * `Continue`
      */
    Continue(): string;
    /**
      * `Convert to `
      */
    ["Convert to "](): string;
    /**
      * `Copied link to clipboard`
      */
    ["Copied link to clipboard"](): string;
    /**
      * `Copied to clipboard`
      */
    ["Copied to clipboard"](): string;
    /**
      * `Copy`
      */
    Copy(): string;
    /**
      * `Create`
      */
    Create(): string;
    /**
      * `Created`
      */
    Created(): string;
    /**
      * `Customise`
      */
    Customize(): string;
    /**
      * `Database file already loaded`
      */
    DB_FILE_ALREADY_LOADED(): string;
    /**
      * `Invalid database file`
      */
    DB_FILE_INVALID(): string;
    /**
      * `Database file migration failed`
      */
    DB_FILE_MIGRATION_FAILED(): string;
    /**
      * `Database file path invalid`
      */
    DB_FILE_PATH_INVALID(): string;
    /**
      * `Date`
      */
    Date(): string;
    /**
      * `Delete`
      */
    Delete(): string;
    /**
      * `Deleted`
      */
    Deleted(): string;
    /**
      * `Deleted User`
      */
    ["Deleted User"](): string;
    /**
      * `Disable`
      */
    Disable(): string;
    /**
      * `Disable public sharing`
      */
    ["Disable Public Sharing"](): string;
    /**
      * `Disable snapshot`
      */
    ["Disable Snapshot"](): string;
    /**
      * `Divider`
      */
    Divider(): string;
    /**
      * `Edgeless`
      */
    Edgeless(): string;
    /**
      * `Edit`
      */
    Edit(): string;
    /**
      * `Editor version`
      */
    ["Editor Version"](): string;
    /**
      * `Enable`
      */
    Enable(): string;
    /**
      * `Enable Manut Cloud`
      */
    ["Enable AFFiNE Cloud"](): string;
    /**
      * `If enabled, the data in this workspace will be backed up and synchronised via Manut Cloud.`
      */
    ["Enable AFFiNE Cloud Description"](): string;
    /**
      * `The following functions rely on Manut Cloud. All data is stored on the current device. You can enable Manut Cloud for this workspace to keep data in sync with the cloud.`
      */
    ["Enable cloud hint"](): string;
    /**
      * `Export failed`
      */
    ["Export failed"](): string;
    /**
      * `Export success`
      */
    ["Export success"](): string;
    /**
      * `Export to HTML`
      */
    ["Export to HTML"](): string;
    /**
      * `Export to Markdown`
      */
    ["Export to Markdown"](): string;
    /**
      * `Export to PNG`
      */
    ["Export to PNG"](): string;
    /**
      * `File already exists`
      */
    FILE_ALREADY_EXISTS(): string;
    /**
      * `Favourite`
      */
    Favorite(): string;
    /**
      * `Favourited`
      */
    Favorited(): string;
    /**
      * `Favourites`
      */
    Favorites(): string;
    /**
      * `Feedback`
      */
    Feedback(): string;
    /**
      * `Found 0 results`
      */
    ["Find 0 result"](): string;
    /**
      * `Full Backup`
      */
    ["Full Backup"](): string;
    /**
      * `Export a complete workspace backup`
      */
    ["Full Backup Description"](): string;
    /**
      * `Sync all cloud data and export a complete workspace backup`
      */
    ["Full Backup Hint"](): string;
    /**
      * `Go back`
      */
    ["Go Back"](): string;
    /**
      * `Go forward`
      */
    ["Go Forward"](): string;
    /**
      * `Got it`
      */
    ["Got it"](): string;
    /**
      * `Heading {{number}}`
      */
    Heading(options: {
        readonly number: string;
    }): string;
    /**
      * `Image`
      */
    Image(): string;
    /**
      * `Import`
      */
    Import(): string;
    /**
      * `Info`
      */
    Info(): string;
    /**
      * `Invitation sent`
      */
    ["Invitation sent"](): string;
    /**
      * `Invited members have been notified with email to join this Workspace.`
      */
    ["Invitation sent hint"](): string;
    /**
      * `Invite`
      */
    Invite(): string;
    /**
      * `Invite members`
      */
    ["Invite Members"](): string;
    /**
      * `Invited members will collaborate with you in current workspace`
      */
    ["Invite Members Message"](): string;
    /**
      * `Joined workspace`
      */
    ["Joined Workspace"](): string;
    /**
      * `Leave`
      */
    Leave(): string;
    /**
      * `Hyperlink (with selected text)`
      */
    Link(): string;
    /**
      * `Loading...`
      */
    Loading(): string;
    /**
      * `Local`
      */
    Local(): string;
    /**
      * `Member`
      */
    Member(): string;
    /**
      * `Members`
      */
    Members(): string;
    /**
      * `Manage members here, invite new member by email.`
      */
    ["Members hint"](): string;
    /**
      * `Need More Seats`
      */
    ["Need-More-Seats"](): string;
    /**
      * `New doc`
      */
    ["New Page"](): string;
    /**
      * `Owner`
      */
    Owner(): string;
    /**
      * `Page`
      */
    Page(): string;
    /**
      * `Pen`
      */
    Pen(): string;
    /**
      * `Pending`
      */
    Pending(): string;
    /**
      * `Publish`
      */
    Publish(): string;
    /**
      * `Published to web`
      */
    ["Published to Web"](): string;
    /**
      * `Quick Export`
      */
    ["Quick Export"](): string;
    /**
      * `Skip cloud synchronization and quickly export current data(some attachments or docs may be missing)`
      */
    ["Quick Export Description"](): string;
    /**
      * `Quick search`
      */
    ["Quick Search"](): string;
    /**
      * `Search`
      */
    ["Quick search"](): string;
    /**
      * `Recent`
      */
    Recent(): string;
    /**
      * `Remove from workspace`
      */
    ["Remove from workspace"](): string;
    /**
      * `Remove photo`
      */
    ["Remove photo"](): string;
    /**
      * `Remove special filter`
      */
    ["Remove special filter"](): string;
    /**
      * `Removed successfully`
      */
    ["Removed successfully"](): string;
    /**
      * `Rename`
      */
    Rename(): string;
    /**
      * `Retry`
      */
    Retry(): string;
    /**
      * `Save`
      */
    Save(): string;
    /**
      * `Select`
      */
    Select(): string;
    /**
      * `Sign in`
      */
    ["Sign in"](): string;
    /**
      * `Sign in and enable`
      */
    ["Sign in and Enable"](): string;
    /**
      * `Sign out`
      */
    ["Sign out"](): string;
    /**
      * `Snapshot`
      */
    Snapshot(): string;
    /**
      * `Storage`
      */
    Storage(): string;
    /**
      * `Storage and export`
      */
    ["Storage and Export"](): string;
    /**
      * `Successfully deleted`
      */
    ["Successfully deleted"](): string;
    /**
      * `Successfully joined!`
      */
    ["Successfully joined!"](): string;
    /**
      * `Switch`
      */
    Switch(): string;
    /**
      * `Sync`
      */
    Sync(): string;
    /**
      * `Synced with Manut Cloud`
      */
    ["Synced with AFFiNE Cloud"](): string;
    /**
      * `Tags`
      */
    Tags(): string;
    /**
      * `Template`
      */
    Template(): string;
    /**
      * `Text`
      */
    Text(): string;
    /**
      * `Theme`
      */
    Theme(): string;
    /**
      * `Title`
      */
    Title(): string;
    /**
      * `Trash`
      */
    Trash(): string;
    /**
      * `Unknown error`
      */
    UNKNOWN_ERROR(): string;
    /**
      * `Under Review`
      */
    ["Under-Review"](): string;
    /**
      * `Undo`
      */
    Undo(): string;
    /**
      * `Unknown User`
      */
    ["Unknown User"](): string;
    /**
      * `Unpin`
      */
    Unpin(): string;
    /**
      * `Untitled`
      */
    Untitled(): string;
    /**
      * `Update workspace name success`
      */
    ["Update workspace name success"](): string;
    /**
      * `Updated`
      */
    Updated(): string;
    /**
      * `Upload`
      */
    Upload(): string;
    /**
      * `Users`
      */
    Users(): string;
    /**
      * `Version`
      */
    Version(): string;
    /**
      * `Visit workspace`
      */
    ["Visit Workspace"](): string;
    /**
      * `Workspace name`
      */
    ["Workspace Name"](): string;
    /**
      * `Workspace Owner`
      */
    ["Workspace Owner"](): string;
    /**
      * `Workspace profile`
      */
    ["Workspace Profile"](): string;
    /**
      * `Workspace settings`
      */
    ["Workspace Settings"](): string;
    /**
      * `{{name}}'s settings`
      */
    ["Workspace Settings with name"](options: {
        readonly name: string;
    }): string;
    /**
      * `{{name}} is saved locally`
      */
    ["Workspace saved locally"](options: {
        readonly name: string;
    }): string;
    /**
      * `Zoom in`
      */
    ["Zoom in"](): string;
    /**
      * `Zoom out`
      */
    ["Zoom out"](): string;
    /**
      * `all`
      */
    all(): string;
    /**
      * `Automatically check for new updates periodically.`
      */
    ["com.affine.aboutAFFiNE.autoCheckUpdate.description"](): string;
    /**
      * `Check for updates automatically`
      */
    ["com.affine.aboutAFFiNE.autoCheckUpdate.title"](): string;
    /**
      * `Automatically download updates (to this device).`
      */
    ["com.affine.aboutAFFiNE.autoDownloadUpdate.description"](): string;
    /**
      * `Download updates automatically`
      */
    ["com.affine.aboutAFFiNE.autoDownloadUpdate.title"](): string;
    /**
      * `View the Manut changelog.`
      */
    ["com.affine.aboutAFFiNE.changelog.description"](): string;
    /**
      * `Discover what's new`
      */
    ["com.affine.aboutAFFiNE.changelog.title"](): string;
    /**
      * `Check for update`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.button.check"](): string;
    /**
      * `Download update`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.button.download"](): string;
    /**
      * `Restart to update`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.button.restart"](): string;
    /**
      * `Retry`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.button.retry"](): string;
    /**
      * `New version is ready`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.description"](): string;
    /**
      * `Manually check for updates.`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.check"](): string;
    /**
      * `Checking for updates...`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.checking"](): string;
    /**
      * `Downloading the latest version...`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.downloading"](): string;
    /**
      * `Unable to connect to the update server.`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.error"](): string;
    /**
      * `You've got the latest version of Manut.`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.latest"](): string;
    /**
      * `Restart to apply update.`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.restart"](): string;
    /**
      * `New update available ({{version}})`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.subtitle.update-available"](options: {
        readonly version: string;
    }): string;
    /**
      * `Check for updates`
      */
    ["com.affine.aboutAFFiNE.checkUpdate.title"](): string;
    /**
      * `Communities`
      */
    ["com.affine.aboutAFFiNE.community.title"](): string;
    /**
      * `Manut community`
      */
    ["com.affine.aboutAFFiNE.contact.community"](): string;
    /**
      * `Contact us`
      */
    ["com.affine.aboutAFFiNE.contact.title"](): string;
    /**
      * `Official website`
      */
    ["com.affine.aboutAFFiNE.contact.website"](): string;
    /**
      * `Privacy`
      */
    ["com.affine.aboutAFFiNE.legal.privacy"](): string;
    /**
      * `Legal Info`
      */
    ["com.affine.aboutAFFiNE.legal.title"](): string;
    /**
      * `Terms of use`
      */
    ["com.affine.aboutAFFiNE.legal.tos"](): string;
    /**
      * `Information about Manut`
      */
    ["com.affine.aboutAFFiNE.subtitle"](): string;
    /**
      * `About Manut`
      */
    ["com.affine.aboutAFFiNE.title"](): string;
    /**
      * `App version`
      */
    ["com.affine.aboutAFFiNE.version.app"](): string;
    /**
      * `Editor version`
      */
    ["com.affine.aboutAFFiNE.version.editor.title"](): string;
    /**
      * `Version`
      */
    ["com.affine.aboutAFFiNE.version.title"](): string;
    /**
      * `Get started`
      */
    ["com.affine.ai-onboarding.edgeless.get-started"](): string;
    /**
      * `Lets you think bigger, create faster, work smarter and save time for every project.`
      */
    ["com.affine.ai-onboarding.edgeless.message"](): string;
    /**
      * `Upgrade to unlimited usage`
      */
    ["com.affine.ai-onboarding.edgeless.purchase"](): string;
    /**
      * `Right-clicking to select content AI`
      */
    ["com.affine.ai-onboarding.edgeless.title"](): string;
    /**
      * `Lets you think bigger, create faster, work smarter and save time for every project.`
      */
    ["com.affine.ai-onboarding.general.1.description"](): string;
    /**
      * `Meet Manut AI`
      */
    ["com.affine.ai-onboarding.general.1.title"](): string;
    /**
      * `Answer questions, draft docs, visualize ideas - Manut AI can save you time at every possible step. Powered by GPT's most powerful model.`
      */
    ["com.affine.ai-onboarding.general.2.description"](): string;
    /**
      * `Chat with Manut AI`
      */
    ["com.affine.ai-onboarding.general.2.title"](): string;
    /**
      * `Get insightful answer to any question, instantly.`
      */
    ["com.affine.ai-onboarding.general.3.description"](): string;
    /**
      * `Edit inline with Manut AI`
      */
    ["com.affine.ai-onboarding.general.3.title"](): string;
    /**
      * `Expand thinking. Untangle complexity. Breakdown and visualise your content with crafted mindmap and presentable slides with one click.`
      */
    ["com.affine.ai-onboarding.general.4.description"](): string;
    /**
      * `Make mind-map and presents with AI`
      */
    ["com.affine.ai-onboarding.general.4.title"](): string;
    /**
      * `Manut AI is ready`
      */
    ["com.affine.ai-onboarding.general.5.title"](): string;
    /**
      * `Get started`
      */
    ["com.affine.ai-onboarding.general.get-started"](): string;
    /**
      * `Next`
      */
    ["com.affine.ai-onboarding.general.next"](): string;
    /**
      * `Back`
      */
    ["com.affine.ai-onboarding.general.prev"](): string;
    /**
      * `Get unlimited usage`
      */
    ["com.affine.ai-onboarding.general.purchase"](): string;
    /**
      * `Remind me later`
      */
    ["com.affine.ai-onboarding.general.skip"](): string;
    /**
      * `Try for free`
      */
    ["com.affine.ai-onboarding.general.try-for-free"](): string;
    /**
      * `Dismiss`
      */
    ["com.affine.ai-onboarding.local.action-dismiss"](): string;
    /**
      * `Get started`
      */
    ["com.affine.ai-onboarding.local.action-get-started"](): string;
    /**
      * `Learn more`
      */
    ["com.affine.ai-onboarding.local.action-learn-more"](): string;
    /**
      * `Lets you think bigger, create faster, work smarter and save time for every project.`
      */
    ["com.affine.ai-onboarding.local.message"](): string;
    /**
      * `Meet Manut AI`
      */
    ["com.affine.ai-onboarding.local.title"](): string;
    /**
      * `New`
      */
    ["com.affine.ai-scroll-tip.tag"](): string;
    /**
      * `Meet Manut AI`
      */
    ["com.affine.ai-scroll-tip.title"](): string;
    /**
      * `View`
      */
    ["com.affine.ai-scroll-tip.view"](): string;
    /**
      * `Please switch to edgeless mode`
      */
    ["com.affine.ai.action.edgeless-only.dialog-title"](): string;
    /**
      * `Embedding {{done}}/{{total}}`
      */
    ["com.affine.ai.chat-panel.embedding-progress"](options: Readonly<{
        done: string;
        total: string;
    }>): string;
    /**
      * `Manut AI is loading history...`
      */
    ["com.affine.ai.chat-panel.loading-history"](): string;
    /**
      * `Do you want to delete this AI conversation history? Once deleted, it cannot be recovered.`
      */
    ["com.affine.ai.chat-panel.session.delete.confirm.message"](): string;
    /**
      * `Delete this history?`
      */
    ["com.affine.ai.chat-panel.session.delete.confirm.title"](): string;
    /**
      * `Failed to delete history`
      */
    ["com.affine.ai.chat-panel.session.delete.toast.failed"](): string;
    /**
      * `History deleted`
      */
    ["com.affine.ai.chat-panel.session.delete.toast.success"](): string;
    /**
      * `Manut AI`
      */
    ["com.affine.ai.chat-panel.title"](): string;
    /**
      * `Start a new chat by typing below or pick a suggestion.`
      */
    ["com.affine.ai.chat.empty-history.description"](): string;
    /**
      * `No chats yet`
      */
    ["com.affine.ai.chat.empty-history.title"](): string;
    /**
      * `Pick a mode below — Read-only by default, Edit to let AI change docs, Full agent for autonomous changes.`
      */
    ["com.affine.ai.intelligence.empty-state.mode-hint"](): string;
    /**
      * `AI made changes`
      */
    ["com.affine.ai.intelligence.tool-call.changes-made"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.ai.login-required.dialog-cancel"](): string;
    /**
      * `Sign in`
      */
    ["com.affine.ai.login-required.dialog-confirm"](): string;
    /**
      * `To use Manut AI, please sign in to your Manut Cloud account.`
      */
    ["com.affine.ai.login-required.dialog-content"](): string;
    /**
      * `Sign in to continue`
      */
    ["com.affine.ai.login-required.dialog-title"](): string;
    /**
      * `Beta — model output may vary. Provided by {{provider}}.`
      */
    ["com.affine.ai.model.beta-tooltip"](options: {
        readonly provider: string;
    }): string;
    /**
      * `Edit current doc`
      */
    ["com.affine.ai.preference.mode.edit-doc.label"](): string;
    /**
      * `AI can modify this doc — edit blocks and sections.`
      */
    ["com.affine.ai.preference.mode.edit-doc.sublabel"](): string;
    /**
      * `Full agent`
      */
    ["com.affine.ai.preference.mode.full-agent.label"](): string;
    /**
      * `AI can edit docs, create new docs, and update data views.`
      */
    ["com.affine.ai.preference.mode.full-agent.sublabel"](): string;
    /**
      * `Mode`
      */
    ["com.affine.ai.preference.mode.label"](): string;
    /**
      * `Read-only`
      */
    ["com.affine.ai.preference.mode.read-only.label"](): string;
    /**
      * `AI can read and answer, but won't change anything.`
      */
    ["com.affine.ai.preference.mode.read-only.sublabel"](): string;
    /**
      * `Search workspace docs`
      */
    ["com.affine.ai.preference.search-workspace.label"](): string;
    /**
      * `Let AI read your docs to answer questions about them.`
      */
    ["com.affine.ai.preference.search-workspace.sublabel"](): string;
    /**
      * `Failed to insert template, please try again.`
      */
    ["com.affine.ai.template-insert.failed"](): string;
    /**
      * `List view options`
      */
    ["com.affine.all-docs.display.list-view"](): string;
    /**
      * `Body`
      */
    ["com.affine.all-docs.display.list-view.body"](): string;
    /**
      * `Icon`
      */
    ["com.affine.all-docs.display.list-view.icon"](): string;
    /**
      * `Display Properties`
      */
    ["com.affine.all-docs.display.properties"](): string;
    /**
      * `Checked`
      */
    ["com.affine.all-docs.group.is-checked"](): string;
    /**
      * `Journal`
      */
    ["com.affine.all-docs.group.is-journal"](): string;
    /**
      * `Unchecked`
      */
    ["com.affine.all-docs.group.is-not-checked"](): string;
    /**
      * `Not Journal`
      */
    ["com.affine.all-docs.group.is-not-journal"](): string;
    /**
      * `Not Template`
      */
    ["com.affine.all-docs.group.is-not-template"](): string;
    /**
      * `Template`
      */
    ["com.affine.all-docs.group.is-template"](): string;
    /**
      * `Never updated`
      */
    ["com.affine.all-docs.group.updated-at.never-updated"](): string;
    /**
      * `All`
      */
    ["com.affine.all-docs.pinned-collection.all"](): string;
    /**
      * `Edit collection rules`
      */
    ["com.affine.all-docs.pinned-collection.edit"](): string;
    /**
      * `Delete permanently`
      */
    ["com.affine.all-docs.quick-action.delete-permanently"](): string;
    /**
      * `Favorite`
      */
    ["com.affine.all-docs.quick-action.favorite"](): string;
    /**
      * `Restore`
      */
    ["com.affine.all-docs.quick-action.restore"](): string;
    /**
      * `Select checkbox`
      */
    ["com.affine.all-docs.quick-action.select"](): string;
    /**
      * `Open in split view`
      */
    ["com.affine.all-docs.quick-action.split"](): string;
    /**
      * `Open in new tab`
      */
    ["com.affine.all-docs.quick-action.tab"](): string;
    /**
      * `Move to trash`
      */
    ["com.affine.all-docs.quick-action.trash"](): string;
    /**
      * `Quick actions`
      */
    ["com.affine.all-docs.quick-actions"](): string;
    /**
      * `All docs`
      */
    ["com.affine.all-pages.header"](): string;
    /**
      * `Learn more`
      */
    ["com.affine.app-sidebar.learn-more"](): string;
    /**
      * `Star us`
      */
    ["com.affine.app-sidebar.star-us"](): string;
    /**
      * `Download update`
      */
    ["com.affine.appUpdater.downloadUpdate"](): string;
    /**
      * `Downloading`
      */
    ["com.affine.appUpdater.downloading"](): string;
    /**
      * `Restart to install update`
      */
    ["com.affine.appUpdater.installUpdate"](): string;
    /**
      * `Open download page`
      */
    ["com.affine.appUpdater.openDownloadPage"](): string;
    /**
      * `Update available`
      */
    ["com.affine.appUpdater.updateAvailable"](): string;
    /**
      * `Discover what's new!`
      */
    ["com.affine.appUpdater.whatsNew"](): string;
    /**
      * `Customise the appearance of the client.`
      */
    ["com.affine.appearanceSettings.clientBorder.description"](): string;
    /**
      * `Client border style`
      */
    ["com.affine.appearanceSettings.clientBorder.title"](): string;
    /**
      * `Choose your colour mode`
      */
    ["com.affine.appearanceSettings.color.description"](): string;
    /**
      * `Colour mode`
      */
    ["com.affine.appearanceSettings.color.title"](): string;
    /**
      * `Edit all Manut theme variables here`
      */
    ["com.affine.appearanceSettings.customize-theme.description"](): string;
    /**
      * `Open Theme Editor`
      */
    ["com.affine.appearanceSettings.customize-theme.open"](): string;
    /**
      * `Reset all`
      */
    ["com.affine.appearanceSettings.customize-theme.reset"](): string;
    /**
      * `Customize Theme`
      */
    ["com.affine.appearanceSettings.customize-theme.title"](): string;
    /**
      * `Choose your font style`
      */
    ["com.affine.appearanceSettings.font.description"](): string;
    /**
      * `Font style`
      */
    ["com.affine.appearanceSettings.font.title"](): string;
    /**
      * `Mono`
      */
    ["com.affine.appearanceSettings.fontStyle.mono"](): string;
    /**
      * `Sans`
      */
    ["com.affine.appearanceSettings.fontStyle.sans"](): string;
    /**
      * `Serif`
      */
    ["com.affine.appearanceSettings.fontStyle.serif"](): string;
    /**
      * `When disabled, images are rendered using nearest-neighbor scaling for crisp pixels.`
      */
    ["com.affine.appearanceSettings.images.antialiasing.description"](): string;
    /**
      * `Smooth image rendering`
      */
    ["com.affine.appearanceSettings.images.antialiasing.title"](): string;
    /**
      * `Images`
      */
    ["com.affine.appearanceSettings.images.title"](): string;
    /**
      * `Select the language for the interface.`
      */
    ["com.affine.appearanceSettings.language.description"](): string;
    /**
      * `Display language`
      */
    ["com.affine.appearanceSettings.language.title"](): string;
    /**
      * `Display the menubar app in the tray for quick access to Manut or meeting recordings.`
      */
    ["com.affine.appearanceSettings.menubar.description"](): string;
    /**
      * `Menubar`
      */
    ["com.affine.appearanceSettings.menubar.title"](): string;
    /**
      * `Enable menubar app`
      */
    ["com.affine.appearanceSettings.menubar.toggle"](): string;
    /**
      * `Close Manut to the system tray.`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.closeToTray.description"](): string;
    /**
      * `Close to tray`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.closeToTray.toggle"](): string;
    /**
      * `Minimize Manut to the system tray.`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.minimizeToTray.description"](): string;
    /**
      * `Minimize to tray`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.minimizeToTray.toggle"](): string;
    /**
      * `Open Manut when left‑clicking the tray icon.`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.openOnLeftClick.description"](): string;
    /**
      * `Quick open from tray icon`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.openOnLeftClick.toggle"](): string;
    /**
      * `Start Manut minimized to the system tray.`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.startMinimized.description"](): string;
    /**
      * `Start minimized`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.startMinimized.toggle"](): string;
    /**
      * `Window behavior`
      */
    ["com.affine.appearanceSettings.menubar.windowBehavior.title"](): string;
    /**
      * `Use background noise effect on the sidebar.`
      */
    ["com.affine.appearanceSettings.noisyBackground.description"](): string;
    /**
      * `Noise background on the sidebar`
      */
    ["com.affine.appearanceSettings.noisyBackground.title"](): string;
    /**
      * `Control whether to show the structure of linked docs in the sidebar.`
      */
    ["com.affine.appearanceSettings.showLinkedDocInSidebar.description"](): string;
    /**
      * `Show linked doc in sidebar`
      */
    ["com.affine.appearanceSettings.showLinkedDocInSidebar.title"](): string;
    /**
      * `Sidebar`
      */
    ["com.affine.appearanceSettings.sidebar.title"](): string;
    /**
      * `Customize your Manut appearance`
      */
    ["com.affine.appearanceSettings.subtitle"](): string;
    /**
      * `Theme`
      */
    ["com.affine.appearanceSettings.theme.title"](): string;
    /**
      * `Appearance settings`
      */
    ["com.affine.appearanceSettings.title"](): string;
    /**
      * `Use transparency effect on the sidebar.`
      */
    ["com.affine.appearanceSettings.translucentUI.description"](): string;
    /**
      * `Translucent UI on the sidebar`
      */
    ["com.affine.appearanceSettings.translucentUI.title"](): string;
    /**
      * `file type not supported.`
      */
    ["com.affine.attachment.preview.error.subtitle"](): string;
    /**
      * `Unable to preview this file`
      */
    ["com.affine.attachment.preview.error.title"](): string;
    /**
      * `Notes`
      */
    ["com.affine.audio.notes"](): string;
    /**
      * `Unable to retrieve AI results for others`
      */
    ["com.affine.audio.transcribe.non-owner.confirm.title"](): string;
    /**
      * `Transcribing`
      */
    ["com.affine.audio.transcribing"](): string;
    /**
      * `Transcript`
      */
    ["com.affine.audio.transcript.label"](): string;
    /**
      * `Transcript not available yet.`
      */
    ["com.affine.audio.transcript.unavailable"](): string;
    /**
      * `Your current email is {{email}}. We'll send a confirmation link there first so you can securely switch to a new email address.`
      */
    ["com.affine.auth.change.email.message"](options: {
        readonly email: string;
    }): string;
    /**
      * `Please enter your new email address below. We will send a verification link to this email address to complete the process.`
      */
    ["com.affine.auth.change.email.page.subtitle"](): string;
    /**
      * `Congratulations! You have successfully updated the email address associated with your Manut Cloud account.`
      */
    ["com.affine.auth.change.email.page.success.subtitle"](): string;
    /**
      * `Email address updated!`
      */
    ["com.affine.auth.change.email.page.success.title"](): string;
    /**
      * `Change email address`
      */
    ["com.affine.auth.change.email.page.title"](): string;
    /**
      * `Forgot password`
      */
    ["com.affine.auth.forget"](): string;
    /**
      * `Later`
      */
    ["com.affine.auth.later"](): string;
    /**
      * `Open Manut`
      */
    ["com.affine.auth.open.affine"](): string;
    /**
      * `Continue with Browser`
      */
    ["com.affine.auth.open.affine.continue-with-browser"](): string;
    /**
      * `Edit settings`
      */
    ["com.affine.auth.open.affine.doc.edit-settings"](): string;
    /**
      * `Requires Manut desktop app version 0.18 or later.`
      */
    ["com.affine.auth.open.affine.doc.footer-text"](): string;
    /**
      * `Open here instead`
      */
    ["com.affine.auth.open.affine.doc.open-here"](): string;
    /**
      * `Download app`
      */
    ["com.affine.auth.open.affine.download-app"](): string;
    /**
      * `Download Latest Client`
      */
    ["com.affine.auth.open.affine.download-latest-client"](): string;
    /**
      * `Still have problems?`
      */
    ["com.affine.auth.open.affine.still-have-problems"](): string;
    /**
      * `Try again`
      */
    ["com.affine.auth.open.affine.try-again"](): string;
    /**
      * `Please set a password of {{min}}-{{max}} characters with both letters and numbers to continue signing up with `
      */
    ["com.affine.auth.page.sent.email.subtitle"](options: Readonly<{
        min: string;
        max: string;
    }>): string;
    /**
      * `Welcome to Manut Cloud, you are almost there!`
      */
    ["com.affine.auth.page.sent.email.title"](): string;
    /**
      * `Password`
      */
    ["com.affine.auth.password"](): string;
    /**
      * `Invalid password`
      */
    ["com.affine.auth.password.error"](): string;
    /**
      * `Set password failed`
      */
    ["com.affine.auth.password.set-failed"](): string;
    /**
      * `Reset password`
      */
    ["com.affine.auth.reset.password"](): string;
    /**
      * `You will receive an email with a link to reset your password. Please check your inbox.`
      */
    ["com.affine.auth.reset.password.message"](): string;
    /**
      * `Password reset successful`
      */
    ["com.affine.auth.reset.password.page.success"](): string;
    /**
      * `Reset your Manut Cloud password`
      */
    ["com.affine.auth.reset.password.page.title"](): string;
    /**
      * `Send reset link`
      */
    ["com.affine.auth.send.reset.password.link"](): string;
    /**
      * `Send set link`
      */
    ["com.affine.auth.send.set.password.link"](): string;
    /**
      * `Send verification link`
      */
    ["com.affine.auth.send.verify.email.hint"](): string;
    /**
      * `Sent`
      */
    ["com.affine.auth.sent"](): string;
    /**
      * `The verification link failed to be sent, please try again later.`
      */
    ["com.affine.auth.sent.change.email.fail"](): string;
    /**
      * `Verification link has been sent.`
      */
    ["com.affine.auth.sent.change.email.hint"](): string;
    /**
      * `Reset password link has been sent.`
      */
    ["com.affine.auth.sent.change.password.hint"](): string;
    /**
      * `Your password has been updated! You can sign in Manut Cloud with new password!`
      */
    ["com.affine.auth.sent.reset.password.success.message"](): string;
    /**
      * `Set password link has been sent.`
      */
    ["com.affine.auth.sent.set.password.hint"](): string;
    /**
      * `Your password has saved! You can sign in Manut Cloud with email and password!`
      */
    ["com.affine.auth.sent.set.password.success.message"](): string;
    /**
      * `Verification link has been sent.`
      */
    ["com.affine.auth.sent.verify.email.hint"](): string;
    /**
      * `Save Email`
      */
    ["com.affine.auth.set.email.save"](): string;
    /**
      * `Set password`
      */
    ["com.affine.auth.set.password"](): string;
    /**
      * `Please set a password of {{min}}-{{max}} characters with both letters and numbers to continue signing up with `
      */
    ["com.affine.auth.set.password.message"](options: Readonly<{
        min: string;
        max: string;
    }>): string;
    /**
      * `Maximum {{max}} characters`
      */
    ["com.affine.auth.set.password.message.maxlength"](options: {
        readonly max: string;
    }): string;
    /**
      * `Minimum {{min}} characters`
      */
    ["com.affine.auth.set.password.message.minlength"](options: {
        readonly min: string;
    }): string;
    /**
      * `Password set successful`
      */
    ["com.affine.auth.set.password.page.success"](): string;
    /**
      * `Set your Manut Cloud password`
      */
    ["com.affine.auth.set.password.page.title"](): string;
    /**
      * `Set a password at least {{min}} letters long`
      */
    ["com.affine.auth.set.password.placeholder"](options: {
        readonly min: string;
    }): string;
    /**
      * `Confirm password`
      */
    ["com.affine.auth.set.password.placeholder.confirm"](): string;
    /**
      * `Save password`
      */
    ["com.affine.auth.set.password.save"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.auth.sign-out.confirm-modal.cancel"](): string;
    /**
      * `Sign Out`
      */
    ["com.affine.auth.sign-out.confirm-modal.confirm"](): string;
    /**
      * `After signing out, the Cloud Workspaces associated with this account will be removed from the current device, and signing in again will add them back.`
      */
    ["com.affine.auth.sign-out.confirm-modal.description"](): string;
    /**
      * `Sign out?`
      */
    ["com.affine.auth.sign-out.confirm-modal.title"](): string;
    /**
      * `Verification code`
      */
    ["com.affine.auth.sign.auth.code"](): string;
    /**
      * `Continue with code`
      */
    ["com.affine.auth.sign.auth.code.continue"](): string;
    /**
      * `Invalid verification code`
      */
    ["com.affine.auth.sign.auth.code.invalid"](): string;
    /**
      * `If you haven't received the email, please check your spam folder.`
      */
    ["com.affine.auth.sign.auth.code.message"](): string;
    /**
      * `Resend code`
      */
    ["com.affine.auth.sign.auth.code.resend"](): string;
    /**
      * `Resend in {{second}}s`
      */
    ["com.affine.auth.sign.auth.code.resend.hint"](options: {
        readonly second: string;
    }): string;
    /**
      * `Sign in with magic link`
      */
    ["com.affine.auth.sign.auth.code.send-email.sign-in"](): string;
    /**
      * `Terms of conditions`
      */
    ["com.affine.auth.sign.condition"](): string;
    /**
      * `Continue with email`
      */
    ["com.affine.auth.sign.email.continue"](): string;
    /**
      * `Invalid email`
      */
    ["com.affine.auth.sign.email.error"](): string;
    /**
      * `Enter your email address`
      */
    ["com.affine.auth.sign.email.placeholder"](): string;
    /**
      * `Sign in`
      */
    ["com.affine.auth.sign.in"](): string;
    /**
      * `Confirm your email`
      */
    ["com.affine.auth.sign.in.sent.email.subtitle"](): string;
    /**
      * `Privacy policy`
      */
    ["com.affine.auth.sign.policy"](): string;
    /**
      * `Sign up`
      */
    ["com.affine.auth.sign.up"](): string;
    /**
      * `Create your account`
      */
    ["com.affine.auth.sign.up.sent.email.subtitle"](): string;
    /**
      * `The app will automatically open or redirect to the web version. If you encounter any issues, you can also click the button below to manually open the Manut app.`
      */
    ["com.affine.auth.sign.up.success.subtitle"](): string;
    /**
      * `Your account has been created and you're now signed in!`
      */
    ["com.affine.auth.sign.up.success.title"](): string;
    /**
      * `You have successfully signed in. The app will automatically open or redirect to the web version. if you encounter any issues, you can also click the button below to  manually open the Manut app.`
      */
    ["com.affine.auth.signed.success.subtitle"](): string;
    /**
      * `You're almost there!`
      */
    ["com.affine.auth.signed.success.title"](): string;
    /**
      * `Server error, please try again later.`
      */
    ["com.affine.auth.toast.message.failed"](): string;
    /**
      * `You have been signed in, start to sync your data with Manut Cloud!`
      */
    ["com.affine.auth.toast.message.signed-in"](): string;
    /**
      * `Unable to sign in`
      */
    ["com.affine.auth.toast.title.failed"](): string;
    /**
      * `Signed in`
      */
    ["com.affine.auth.toast.title.signed-in"](): string;
    /**
      * `Your current email is {{email}}. We'll send a verification link to this email so you can confirm it belongs to you.`
      */
    ["com.affine.auth.verify.email.message"](options: {
        readonly email: string;
    }): string;
    /**
      * `Back`
      */
    ["com.affine.backButton"](): string;
    /**
      * `Your local data is stored in the browser and may be lost. Don't risk it - enable cloud now!`
      */
    ["com.affine.banner.local-warning"](): string;
    /**
      * `Manut Cloud`
      */
    ["com.affine.brand.affineCloud"](): string;
    /**
      * `Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec`
      */
    ["com.affine.calendar-date-picker.month-names"](): string;
    /**
      * `Today`
      */
    ["com.affine.calendar-date-picker.today"](): string;
    /**
      * `Su,Mo,Tu,We,Th,Fr,Sa`
      */
    ["com.affine.calendar-date-picker.week-days"](): string;
    /**
      * `Host by Manut.Pro, Save, sync, and backup all your data.`
      */
    ["com.affine.cloud-scroll-tip.caption"](): string;
    /**
      * `Manut Cloud`
      */
    ["com.affine.cloud-scroll-tip.title"](): string;
    /**
      * `Collections`
      */
    ["com.affine.cmdk.affine.category.affine.collections"](): string;
    /**
      * `Create`
      */
    ["com.affine.cmdk.affine.category.affine.creation"](): string;
    /**
      * `Select a specific date`
      */
    ["com.affine.cmdk.affine.category.affine.date-picker"](): string;
    /**
      * `Edgeless`
      */
    ["com.affine.cmdk.affine.category.affine.edgeless"](): string;
    /**
      * `General`
      */
    ["com.affine.cmdk.affine.category.affine.general"](): string;
    /**
      * `Help`
      */
    ["com.affine.cmdk.affine.category.affine.help"](): string;
    /**
      * `Journal`
      */
    ["com.affine.cmdk.affine.category.affine.journal"](): string;
    /**
      * `Layout controls`
      */
    ["com.affine.cmdk.affine.category.affine.layout"](): string;
    /**
      * `Navigation`
      */
    ["com.affine.cmdk.affine.category.affine.navigation"](): string;
    /**
      * `Docs`
      */
    ["com.affine.cmdk.affine.category.affine.pages"](): string;
    /**
      * `Recent`
      */
    ["com.affine.cmdk.affine.category.affine.recent"](): string;
    /**
      * `Settings`
      */
    ["com.affine.cmdk.affine.category.affine.settings"](): string;
    /**
      * `Tags`
      */
    ["com.affine.cmdk.affine.category.affine.tags"](): string;
    /**
      * `Updates`
      */
    ["com.affine.cmdk.affine.category.affine.updates"](): string;
    /**
      * `Edgeless commands`
      */
    ["com.affine.cmdk.affine.category.editor.edgeless"](): string;
    /**
      * `Insert object`
      */
    ["com.affine.cmdk.affine.category.editor.insert-object"](): string;
    /**
      * `Doc Commands`
      */
    ["com.affine.cmdk.affine.category.editor.page"](): string;
    /**
      * `Results`
      */
    ["com.affine.cmdk.affine.category.results"](): string;
    /**
      * `Change client border style to`
      */
    ["com.affine.cmdk.affine.client-border-style.to"](): string;
    /**
      * `Change colour mode to`
      */
    ["com.affine.cmdk.affine.color-mode.to"](): string;
    /**
      * `Contact us`
      */
    ["com.affine.cmdk.affine.contact-us"](): string;
    /**
      * `Create "{{keyWord}}" doc and insert`
      */
    ["com.affine.cmdk.affine.create-new-doc-and-insert"](options: {
        readonly keyWord: string;
    }): string;
    /**
      * `New "{{keyWord}}" edgeless`
      */
    ["com.affine.cmdk.affine.create-new-edgeless-as"](options: {
        readonly keyWord: string;
    }): string;
    /**
      * `New "{{keyWord}}" page`
      */
    ["com.affine.cmdk.affine.create-new-page-as"](options: {
        readonly keyWord: string;
    }): string;
    /**
      * `Change current page width to full width`
      */
    ["com.affine.cmdk.affine.current-page-width-layout.full-width"](): string;
    /**
      * `Change current page width to standard`
      */
    ["com.affine.cmdk.affine.current-page-width-layout.standard"](): string;
    /**
      * `Change default width for new pages in to full width`
      */
    ["com.affine.cmdk.affine.default-page-width-layout.full-width"](): string;
    /**
      * `Change default width for new pages in to standard`
      */
    ["com.affine.cmdk.affine.default-page-width-layout.standard"](): string;
    /**
      * `Change display language to`
      */
    ["com.affine.cmdk.affine.display-language.to"](): string;
    /**
      * `Add to favourites`
      */
    ["com.affine.cmdk.affine.editor.add-to-favourites"](): string;
    /**
      * `Start presentation`
      */
    ["com.affine.cmdk.affine.editor.edgeless.presentation-start"](): string;
    /**
      * `Remove from favourites`
      */
    ["com.affine.cmdk.affine.editor.remove-from-favourites"](): string;
    /**
      * `Restore from trash`
      */
    ["com.affine.cmdk.affine.editor.restore-from-trash"](): string;
    /**
      * `Reveal doc history modal`
      */
    ["com.affine.cmdk.affine.editor.reveal-page-history-modal"](): string;
    /**
      * `This doc has been moved to the trash, you can either restore or permanently delete it.`
      */
    ["com.affine.cmdk.affine.editor.trash-footer-hint"](): string;
    /**
      * `Change font style to`
      */
    ["com.affine.cmdk.affine.font-style.to"](): string;
    /**
      * `Change full width layout to`
      */
    ["com.affine.cmdk.affine.full-width-layout.to"](): string;
    /**
      * `Getting started`
      */
    ["com.affine.cmdk.affine.getting-started"](): string;
    /**
      * `Import workspace`
      */
    ["com.affine.cmdk.affine.import-workspace"](): string;
    /**
      * `Insert this link to the current doc`
      */
    ["com.affine.cmdk.affine.insert-link"](): string;
    /**
      * `Collapse left sidebar`
      */
    ["com.affine.cmdk.affine.left-sidebar.collapse"](): string;
    /**
      * `Expand left sidebar`
      */
    ["com.affine.cmdk.affine.left-sidebar.expand"](): string;
    /**
      * `Go to all docs`
      */
    ["com.affine.cmdk.affine.navigation.goto-all-pages"](): string;
    /**
      * `Go to edgeless list`
      */
    ["com.affine.cmdk.affine.navigation.goto-edgeless-list"](): string;
    /**
      * `Go to page list`
      */
    ["com.affine.cmdk.affine.navigation.goto-page-list"](): string;
    /**
      * `Go to trash`
      */
    ["com.affine.cmdk.affine.navigation.goto-trash"](): string;
    /**
      * `Go to workspace`
      */
    ["com.affine.cmdk.affine.navigation.goto-workspace"](): string;
    /**
      * `Go to account settings`
      */
    ["com.affine.cmdk.affine.navigation.open-account-settings"](): string;
    /**
      * `Go to Settings`
      */
    ["com.affine.cmdk.affine.navigation.open-settings"](): string;
    /**
      * `New edgeless`
      */
    ["com.affine.cmdk.affine.new-edgeless-page"](): string;
    /**
      * `New page`
      */
    ["com.affine.cmdk.affine.new-page"](): string;
    /**
      * `New workspace`
      */
    ["com.affine.cmdk.affine.new-workspace"](): string;
    /**
      * `Change noise background on the sidebar to`
      */
    ["com.affine.cmdk.affine.noise-background-on-the-sidebar.to"](): string;
    /**
      * `Restart to upgrade`
      */
    ["com.affine.cmdk.affine.restart-to-upgrade"](): string;
    /**
      * `OFF`
      */
    ["com.affine.cmdk.affine.switch-state.off"](): string;
    /**
      * `ON`
      */
    ["com.affine.cmdk.affine.switch-state.on"](): string;
    /**
      * `Change translucent UI on the sidebar to`
      */
    ["com.affine.cmdk.affine.translucent-ui-on-the-sidebar.to"](): string;
    /**
      * `What's new`
      */
    ["com.affine.cmdk.affine.whats-new"](): string;
    /**
      * `Search docs or paste link...`
      */
    ["com.affine.cmdk.docs.placeholder"](): string;
    /**
      * `Insert links`
      */
    ["com.affine.cmdk.insert-links"](): string;
    /**
      * `No results found`
      */
    ["com.affine.cmdk.no-results"](): string;
    /**
      * `No results found for`
      */
    ["com.affine.cmdk.no-results-for"](): string;
    /**
      * `Type a command or search anything...`
      */
    ["com.affine.cmdk.placeholder"](): string;
    /**
      * `Switch to $t(com.affine.edgelessMode)`
      */
    ["com.affine.cmdk.switch-to-edgeless"](): string;
    /**
      * `Switch to $t(com.affine.pageMode)`
      */
    ["com.affine.cmdk.switch-to-page"](): string;
    /**
      * `Delete`
      */
    ["com.affine.collection-bar.action.tooltip.delete"](): string;
    /**
      * `Edit`
      */
    ["com.affine.collection-bar.action.tooltip.edit"](): string;
    /**
      * `Pin to sidebar`
      */
    ["com.affine.collection-bar.action.tooltip.pin"](): string;
    /**
      * `Unpin`
      */
    ["com.affine.collection-bar.action.tooltip.unpin"](): string;
    /**
      * `Do you want to add a document to the current collection? If it is filtered based on rules, this will add a set of included rules.`
      */
    ["com.affine.collection.add-doc.confirm.description"](): string;
    /**
      * `Add new doc to this collection`
      */
    ["com.affine.collection.add-doc.confirm.title"](): string;
    /**
      * `Doc already exists`
      */
    ["com.affine.collection.addPage.alreadyExists"](): string;
    /**
      * `Added successfully`
      */
    ["com.affine.collection.addPage.success"](): string;
    /**
      * `Add docs`
      */
    ["com.affine.collection.addPages"](): string;
    /**
      * `Add rules`
      */
    ["com.affine.collection.addRules"](): string;
    /**
      * `All collections`
      */
    ["com.affine.collection.allCollections"](): string;
    /**
      * `Empty collection`
      */
    ["com.affine.collection.emptyCollection"](): string;
    /**
      * `Collection is a smart folder where you can manually add docs or automatically add docs through rules.`
      */
    ["com.affine.collection.emptyCollectionDescription"](): string;
    /**
      * `HELP INFO`
      */
    ["com.affine.collection.helpInfo"](): string;
    /**
      * `Edit collection`
      */
    ["com.affine.collection.menu.edit"](): string;
    /**
      * `Rename`
      */
    ["com.affine.collection.menu.rename"](): string;
    /**
      * `Removed successfully`
      */
    ["com.affine.collection.removePage.success"](): string;
    /**
      * `No collections`
      */
    ["com.affine.collections.empty.message"](): string;
    /**
      * `New collection`
      */
    ["com.affine.collections.empty.new-collection-button"](): string;
    /**
      * `Collections`
      */
    ["com.affine.collections.header"](): string;
    /**
      * `Comments`
      */
    ["com.affine.comment.comments"](): string;
    /**
      * `Copy link`
      */
    ["com.affine.comment.copy-link"](): string;
    /**
      * `All comments will also be deleted, and this action cannot be undone.`
      */
    ["com.affine.comment.delete.confirm.description"](): string;
    /**
      * `Delete the thread?`
      */
    ["com.affine.comment.delete.confirm.title"](): string;
    /**
      * `Only current mode`
      */
    ["com.affine.comment.filter.only-current-mode"](): string;
    /**
      * `Only my replies and mentions`
      */
    ["com.affine.comment.filter.only-my-replies"](): string;
    /**
      * `Show resolved comments`
      */
    ["com.affine.comment.filter.show-resolved"](): string;
    /**
      * `No comments yet, select content to add comment to`
      */
    ["com.affine.comment.no-comments"](): string;
    /**
      * `Reply`
      */
    ["com.affine.comment.reply"](): string;
    /**
      * `Delete this reply? This action cannot be undone.`
      */
    ["com.affine.comment.reply.delete.confirm.description"](): string;
    /**
      * `Delete this reply?`
      */
    ["com.affine.comment.reply.delete.confirm.title"](): string;
    /**
      * `Show {{count}} more replies`
      */
    ["com.affine.comment.reply.show-more"](options: {
        readonly count: string;
    }): string;
    /**
      * `Cancel`
      */
    ["com.affine.confirmModal.button.cancel"](): string;
    /**
      * `Ok`
      */
    ["com.affine.confirmModal.button.ok"](): string;
    /**
      * `Copy`
      */
    ["com.affine.context-menu.copy"](): string;
    /**
      * `Cut`
      */
    ["com.affine.context-menu.cut"](): string;
    /**
      * `Paste`
      */
    ["com.affine.context-menu.paste"](): string;
    /**
      * `Image copy failed`
      */
    ["com.affine.copy.asImage.failed"](): string;
    /**
      * `Download Client`
      */
    ["com.affine.copy.asImage.notAvailable.action"](): string;
    /**
      * `The 'Copy as image' feature is only available on our desktop app. Please download and install the client to access this feature.`
      */
    ["com.affine.copy.asImage.notAvailable.message"](): string;
    /**
      * `Couldn't copy image`
      */
    ["com.affine.copy.asImage.notAvailable.title"](): string;
    /**
      * `Image copied`
      */
    ["com.affine.copy.asImage.success"](): string;
    /**
      * `Current year`
      */
    ["com.affine.currentYear"](): string;
    /**
      * `Deleting {{count}} tags cannot be undone, please proceed with caution.`
      */
    ["com.affine.delete-tags.confirm.multi-tag-description"](options: {
        readonly count: string;
    }): string;
    /**
      * `Delete tag?`
      */
    ["com.affine.delete-tags.confirm.title"](): string;
    /**
      * `{{count}} tag deleted`
    
      * - com.affine.delete-tags.count_one: `{{count}} tag deleted`
    
      * - com.affine.delete-tags.count_other: `{{count}} tags deleted`
      */
    ["com.affine.delete-tags.count"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `{{count}} tag deleted`
      */
    ["com.affine.delete-tags.count_one"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `{{count}} tags deleted`
      */
    ["com.affine.delete-tags.count_other"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `Delete workspace from this device and optionally delete all data.`
      */
    ["com.affine.deleteLeaveWorkspace.description"](): string;
    /**
      * `Leave workspace`
      */
    ["com.affine.deleteLeaveWorkspace.leave"](): string;
    /**
      * `After you leave, you will not be able to access content within this workspace.`
      */
    ["com.affine.deleteLeaveWorkspace.leaveDescription"](): string;
    /**
      * `Total views`
      */
    ["com.affine.doc.analytics.chart.total-views"](): string;
    /**
      * `Unique views`
      */
    ["com.affine.doc.analytics.chart.unique-views"](): string;
    /**
      * `No page views in this window.`
      */
    ["com.affine.doc.analytics.empty.no-page-views"](): string;
    /**
      * `No viewers in this window.`
      */
    ["com.affine.doc.analytics.empty.no-viewers"](): string;
    /**
      * `Unable to load analytics.`
      */
    ["com.affine.doc.analytics.error.load-analytics"](): string;
    /**
      * `Unable to load viewers.`
      */
    ["com.affine.doc.analytics.error.load-viewers"](): string;
    /**
      * `Guest`
      */
    ["com.affine.doc.analytics.metric.guest"](): string;
    /**
      * `Total`
      */
    ["com.affine.doc.analytics.metric.total"](): string;
    /**
      * `Unique`
      */
    ["com.affine.doc.analytics.metric.unique"](): string;
    /**
      * `Open pricing plans`
      */
    ["com.affine.doc.analytics.paywall.open-pricing"](): string;
    /**
      * `Doc analytics over 7 days require an Manut Team subscription.`
      */
    ["com.affine.doc.analytics.paywall.toast"](): string;
    /**
      * `({{count}} total)`
      */
    ["com.affine.doc.analytics.summary.total"](options: {
        readonly count: string;
    }): string;
    /**
      * `View analytics`
      */
    ["com.affine.doc.analytics.title"](): string;
    /**
      * `Show all viewers`
      */
    ["com.affine.doc.analytics.viewers.show-all"](): string;
    /**
      * `Viewers`
      */
    ["com.affine.doc.analytics.viewers.title"](): string;
    /**
      * `Last {{days}} days`
      */
    ["com.affine.doc.analytics.window.last-days"](options: {
        readonly days: string;
    }): string;
    /**
      * `Add icon`
      */
    ["com.affine.docIconPicker.placeholder"](): string;
    /**
      * `Docs`
      */
    ["com.affine.docs.header"](): string;
    /**
      * `Draw with a blank whiteboard`
      */
    ["com.affine.draw_with_a_blank_whiteboard"](): string;
    /**
      * `Earlier`
      */
    ["com.affine.earlier"](): string;
    /**
      * `Edgeless mode`
      */
    ["com.affine.edgelessMode"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.editCollection.button.cancel"](): string;
    /**
      * `Create`
      */
    ["com.affine.editCollection.button.create"](): string;
    /**
      * `Create collection`
      */
    ["com.affine.editCollection.createCollection"](): string;
    /**
      * `Filters`
      */
    ["com.affine.editCollection.filters"](): string;
    /**
      * `Docs`
      */
    ["com.affine.editCollection.pages"](): string;
    /**
      * `Clear selected`
      */
    ["com.affine.editCollection.pages.clear"](): string;
    /**
      * `Rename collection`
      */
    ["com.affine.editCollection.renameCollection"](): string;
    /**
      * `Rules`
      */
    ["com.affine.editCollection.rules"](): string;
    /**
      * `No results`
      */
    ["com.affine.editCollection.rules.empty.noResults"](): string;
    /**
      * `No docs meet the filtering rules`
      */
    ["com.affine.editCollection.rules.empty.noResults.tips"](): string;
    /**
      * `No rules`
      */
    ["com.affine.editCollection.rules.empty.noRules"](): string;
    /**
      * `Add selected doc`
      */
    ["com.affine.editCollection.rules.include.add"](): string;
    /**
      * `is`
      */
    ["com.affine.editCollection.rules.include.is"](): string;
    /**
      * `is-not`
      */
    ["com.affine.editCollection.rules.include.is-not"](): string;
    /**
      * `Doc`
      */
    ["com.affine.editCollection.rules.include.page"](): string;
    /**
      * `“Selected docs” refers to manually adding docs rather than automatically adding them through rule matching. You can manually add docs through the “Add selected docs” option or by dragging and dropping.`
      */
    ["com.affine.editCollection.rules.include.tips"](): string;
    /**
      * `What is "Selected docs"？`
      */
    ["com.affine.editCollection.rules.include.tipsTitle"](): string;
    /**
      * `Selected docs`
      */
    ["com.affine.editCollection.rules.include.title"](): string;
    /**
      * `Preview`
      */
    ["com.affine.editCollection.rules.preview"](): string;
    /**
      * `Reset`
      */
    ["com.affine.editCollection.rules.reset"](): string;
    /**
      * `automatically`
      */
    ["com.affine.editCollection.rules.tips.highlight"](): string;
    /**
      * `Save`
      */
    ["com.affine.editCollection.save"](): string;
    /**
      * `Save as new collection`
      */
    ["com.affine.editCollection.saveCollection"](): string;
    /**
      * `Search doc...`
      */
    ["com.affine.editCollection.search.placeholder"](): string;
    /**
      * `Untitled collection`
      */
    ["com.affine.editCollection.untitledCollection"](): string;
    /**
      * `Update collection`
      */
    ["com.affine.editCollection.updateCollection"](): string;
    /**
      * `Collection is a smart folder where you can manually add docs or automatically add docs through rules.`
      */
    ["com.affine.editCollectionName.createTips"](): string;
    /**
      * `Name`
      */
    ["com.affine.editCollectionName.name"](): string;
    /**
      * `Collection name`
      */
    ["com.affine.editCollectionName.name.placeholder"](): string;
    /**
      * `Access needed`
      */
    ["com.affine.editor.at-menu.access-needed"](): string;
    /**
      * `{{username}} does not have access to this doc, do you want to invite and notify them?`
      */
    ["com.affine.editor.at-menu.access-needed-message"](options: {
        readonly username: string;
    }): string;
    /**
      * `Collections`
      */
    ["com.affine.editor.at-menu.collections"](): string;
    /**
      * `New "{{name}}" edgeless`
      */
    ["com.affine.editor.at-menu.create-edgeless"](options: {
        readonly name: string;
    }): string;
    /**
      * `New "{{name}}" page`
      */
    ["com.affine.editor.at-menu.create-page"](options: {
        readonly name: string;
    }): string;
    /**
      * `Select a specific date`
      */
    ["com.affine.editor.at-menu.date-picker"](): string;
    /**
      * `Import`
      */
    ["com.affine.editor.at-menu.import"](): string;
    /**
      * `Invited and notified`
      */
    ["com.affine.editor.at-menu.invited-and-notified"](): string;
    /**
      * `Journal`
      */
    ["com.affine.editor.at-menu.journal"](): string;
    /**
      * `Search for "{{query}}"`
      */
    ["com.affine.editor.at-menu.link-to-doc"](options: {
        readonly query: string;
    }): string;
    /**
      * `Loading...`
      */
    ["com.affine.editor.at-menu.loading"](): string;
    /**
      * `Member not notified`
      */
    ["com.affine.editor.at-menu.member-not-notified"](): string;
    /**
      * `This member does not have access to this doc, they are not notified.`
      */
    ["com.affine.editor.at-menu.member-not-notified-message"](): string;
    /**
      * `Mention Members`
      */
    ["com.affine.editor.at-menu.mention-members"](): string;
    /**
      * `{{count}} more docs`
      */
    ["com.affine.editor.at-menu.more-docs-hint"](options: {
        readonly count: string;
    }): string;
    /**
      * `{{count}} more members`
      */
    ["com.affine.editor.at-menu.more-members-hint"](options: {
        readonly count: string;
    }): string;
    /**
      * `New`
      */
    ["com.affine.editor.at-menu.new-doc"](): string;
    /**
      * `Recent`
      */
    ["com.affine.editor.at-menu.recent-docs"](): string;
    /**
      * `Tags`
      */
    ["com.affine.editor.at-menu.tags"](): string;
    /**
      * `Hide`
      */
    ["com.affine.editor.bi-directional-link-panel.hide"](): string;
    /**
      * `Show`
      */
    ["com.affine.editor.bi-directional-link-panel.show"](): string;
    /**
      * `Fold`
      */
    ["com.affine.editor.edgeless-embed-synced-doc-header.fold"](): string;
    /**
      * `Open`
      */
    ["com.affine.editor.edgeless-embed-synced-doc-header.open"](): string;
    /**
      * `Unfold`
      */
    ["com.affine.editor.edgeless-embed-synced-doc-header.unfold"](): string;
    /**
      * `Fold page block`
      */
    ["com.affine.editor.edgeless-note-header.fold-page-block"](): string;
    /**
      * `Open in Page`
      */
    ["com.affine.editor.edgeless-note-header.open-in-page"](): string;
    /**
      * `Duplicate Entries in Today's Journal`
      */
    ["com.affine.editor.journal-conflict.title"](): string;
    /**
      * `Default to Edgeless mode`
      */
    ["com.affine.editorDefaultMode.edgeless"](): string;
    /**
      * `Default to Page mode`
      */
    ["com.affine.editorDefaultMode.page"](): string;
    /**
      * `Add docs`
      */
    ["com.affine.empty.collection-detail.action.add-doc"](): string;
    /**
      * `Add rules`
      */
    ["com.affine.empty.collection-detail.action.add-rule"](): string;
    /**
      * `Collection is a smart folder where you can manually add docs or automatically add docs through rules.`
      */
    ["com.affine.empty.collection-detail.description"](): string;
    /**
      * `Empty collection`
      */
    ["com.affine.empty.collection-detail.title"](): string;
    /**
      * `Add collection`
      */
    ["com.affine.empty.collections.action.new-collection"](): string;
    /**
      * `Create your first collection here.`
      */
    ["com.affine.empty.collections.description"](): string;
    /**
      * `Collection management`
      */
    ["com.affine.empty.collections.title"](): string;
    /**
      * `New doc`
      */
    ["com.affine.empty.docs.action.new-doc"](): string;
    /**
      * `Create your first doc here.`
      */
    ["com.affine.empty.docs.all-description"](): string;
    /**
      * `Docs management`
      */
    ["com.affine.empty.docs.title"](): string;
    /**
      * `Deleted docs will appear here.`
      */
    ["com.affine.empty.docs.trash-description"](): string;
    /**
      * `Create a new tag for your documents.`
      */
    ["com.affine.empty.tags.description"](): string;
    /**
      * `Tag management`
      */
    ["com.affine.empty.tags.title"](): string;
    /**
      * `There's no doc here yet`
      */
    ["com.affine.emptyDesc"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.enableAffineCloudModal.button.cancel"](): string;
    /**
      * `Choose an instance.`
      */
    ["com.affine.enableAffineCloudModal.custom-server.description"](): string;
    /**
      * `Enable Cloud`
      */
    ["com.affine.enableAffineCloudModal.custom-server.enable"](): string;
    /**
      * `Enable Cloud for {{workspaceName}}`
      */
    ["com.affine.enableAffineCloudModal.custom-server.title"](options: {
        readonly workspaceName: string;
    }): string;
    /**
      * `Hide error`
      */
    ["com.affine.error.hide-error"](): string;
    /**
      * `It takes longer to load the doc content.`
      */
    ["com.affine.error.loading-timeout-error"](): string;
    /**
      * `Doc content is missing`
      */
    ["com.affine.error.no-page-root.title"](): string;
    /**
      * `Refetch`
      */
    ["com.affine.error.refetch"](): string;
    /**
      * `Reload Manut`
      */
    ["com.affine.error.reload"](): string;
    /**
      * `Refresh`
      */
    ["com.affine.error.retry"](): string;
    /**
      * `Something is wrong...`
      */
    ["com.affine.error.unexpected-error.title"](): string;
    /**
      * `Please request a new link.`
      */
    ["com.affine.expired.page.new-subtitle"](): string;
    /**
      * `Please request a new reset password link.`
      */
    ["com.affine.expired.page.subtitle"](): string;
    /**
      * `This link has expired...`
      */
    ["com.affine.expired.page.title"](): string;
    /**
      * `Display`
      */
    ["com.affine.explorer.display-menu.button"](): string;
    /**
      * `Grouping`
      */
    ["com.affine.explorer.display-menu.grouping"](): string;
    /**
      * `Remove group`
      */
    ["com.affine.explorer.display-menu.grouping.remove"](): string;
    /**
      * `Ordering`
      */
    ["com.affine.explorer.display-menu.ordering"](): string;
    /**
      * `Copied as Markdown`
      */
    ["com.affine.export.copied-as-markdown"](): string;
    /**
      * `Copy as Markdown`
      */
    ["com.affine.export.copy-markdown"](): string;
    /**
      * `Please try it again later.`
      */
    ["com.affine.export.error.message"](): string;
    /**
      * `Export failed due to an unexpected error`
      */
    ["com.affine.export.error.title"](): string;
    /**
      * `Print`
      */
    ["com.affine.export.print"](): string;
    /**
      * `Please open the download folder to check.`
      */
    ["com.affine.export.success.message"](): string;
    /**
      * `Exported successfully`
      */
    ["com.affine.export.success.title"](): string;
    /**
      * `Please contact your workspace owner to add more seats.`
      */
    ["com.affine.fail-to-join-workspace.description-2"](): string;
    /**
      * `Join Failed`
      */
    ["com.affine.fail-to-join-workspace.title"](): string;
    /**
      * `Request failed to send`
      */
    ["com.affine.failed-to-send-request.title"](): string;
    /**
      * `Add to favourites`
      */
    ["com.affine.favoritePageOperation.add"](): string;
    /**
      * `Remove from favourites`
      */
    ["com.affine.favoritePageOperation.remove"](): string;
    /**
      * `Filter`
      */
    ["com.affine.filter"](): string;
    /**
      * `Add Filter Rule`
      */
    ["com.affine.filter.add-filter"](): string;
    /**
      * `after`
      */
    ["com.affine.filter.after"](): string;
    /**
      * `before`
      */
    ["com.affine.filter.before"](): string;
    /**
      * `between`
      */
    ["com.affine.filter.between"](): string;
    /**
      * `contains all`
      */
    ["com.affine.filter.contains all"](): string;
    /**
      * `contains one of`
      */
    ["com.affine.filter.contains one of"](): string;
    /**
      * `does not contains all`
      */
    ["com.affine.filter.does not contains all"](): string;
    /**
      * `does not contains one of`
      */
    ["com.affine.filter.does not contains one of"](): string;
    /**
      * `Empty`
      */
    ["com.affine.filter.empty"](): string;
    /**
      * `Empty`
      */
    ["com.affine.filter.empty-tag"](): string;
    /**
      * `false`
      */
    ["com.affine.filter.false"](): string;
    /**
      * `is`
      */
    ["com.affine.filter.is"](): string;
    /**
      * `is empty`
      */
    ["com.affine.filter.is empty"](): string;
    /**
      * `is not empty`
      */
    ["com.affine.filter.is not empty"](): string;
    /**
      * `Favourited`
      */
    ["com.affine.filter.is-favourited"](): string;
    /**
      * `Shared`
      */
    ["com.affine.filter.is-public"](): string;
    /**
      * `last`
      */
    ["com.affine.filter.last"](): string;
    /**
      * `last 15 days`
      */
    ["com.affine.filter.last 15 days"](): string;
    /**
      * `last 3 days`
      */
    ["com.affine.filter.last 3 days"](): string;
    /**
      * `last 30 days`
      */
    ["com.affine.filter.last 30 days"](): string;
    /**
      * `last 7 days`
      */
    ["com.affine.filter.last 7 days"](): string;
    /**
      * `Save view`
      */
    ["com.affine.filter.save-view"](): string;
    /**
      * `this month`
      */
    ["com.affine.filter.this month"](): string;
    /**
      * `this quarter`
      */
    ["com.affine.filter.this quarter"](): string;
    /**
      * `this week`
      */
    ["com.affine.filter.this week"](): string;
    /**
      * `this year`
      */
    ["com.affine.filter.this year"](): string;
    /**
      * `true`
      */
    ["com.affine.filter.true"](): string;
    /**
      * `Add filter`
      */
    ["com.affine.filterList.button.add"](): string;
    /**
      * `Table of contents`
      */
    ["com.affine.header.menu.toc"](): string;
    /**
      * `View in Edgeless Canvas`
      */
    ["com.affine.header.mode-switch.edgeless"](): string;
    /**
      * `View in Page mode`
      */
    ["com.affine.header.mode-switch.page"](): string;
    /**
      * `Add tag`
      */
    ["com.affine.header.option.add-tag"](): string;
    /**
      * `Duplicate`
      */
    ["com.affine.header.option.duplicate"](): string;
    /**
      * `Open in desktop app`
      */
    ["com.affine.header.option.open-in-desktop"](): string;
    /**
      * `View all frames`
      */
    ["com.affine.header.option.view-frame"](): string;
    /**
      * `View table of contents`
      */
    ["com.affine.header.option.view-toc"](): string;
    /**
      * `Contact us`
      */
    ["com.affine.helpIsland.contactUs"](): string;
    /**
      * `Getting started`
      */
    ["com.affine.helpIsland.gettingStarted"](): string;
    /**
      * `Help and feedback`
      */
    ["com.affine.helpIsland.helpAndFeedback"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.history-vision.tips-modal.cancel"](): string;
    /**
      * `Enable Manut Cloud`
      */
    ["com.affine.history-vision.tips-modal.confirm"](): string;
    /**
      * `The current workspace is a local workspace, and we do not support version history for it at the moment. You can enable Manut Cloud. This will sync the workspace with the Cloud, allowing you to use this feature.`
      */
    ["com.affine.history-vision.tips-modal.description"](): string;
    /**
      * `History vision needs Manut Cloud`
      */
    ["com.affine.history-vision.tips-modal.title"](): string;
    /**
      * `Back to doc`
      */
    ["com.affine.history.back-to-page"](): string;
    /**
      * `You are about to restore the current version of the doc to the latest version available. This action will overwrite any changes made prior to the latest version.`
      */
    ["com.affine.history.confirm-restore-modal.hint"](): string;
    /**
      * `Load more`
      */
    ["com.affine.history.confirm-restore-modal.load-more"](): string;
    /**
      * `LIMITED DOC HISTORY`
      */
    ["com.affine.history.confirm-restore-modal.plan-prompt.limited-title"](): string;
    /**
      * `HELP INFO`
      */
    ["com.affine.history.confirm-restore-modal.plan-prompt.title"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.history.confirm-restore-modal.pro-plan-prompt.upgrade"](): string;
    /**
      * `Restore`
      */
    ["com.affine.history.confirm-restore-modal.restore"](): string;
    /**
      * `This document is such a spring chicken, it hasn't sprouted a single historical sprig yet!`
      */
    ["com.affine.history.empty-prompt.description"](): string;
    /**
      * `Empty`
      */
    ["com.affine.history.empty-prompt.title"](): string;
    /**
      * `Restore current version`
      */
    ["com.affine.history.restore-current-version"](): string;
    /**
      * `Version history`
      */
    ["com.affine.history.version-history"](): string;
    /**
      * `View history version`
      */
    ["com.affine.history.view-history-version"](): string;
    /**
      * `Create doc from Web Clipper`
      */
    ["com.affine.import-clipper.dialog.createDocFromClipper"](): string;
    /**
      * `Create into a New Workspace`
      */
    ["com.affine.import-clipper.dialog.createDocToNewWorkspace"](): string;
    /**
      * `Create doc to "{{workspace}}"`
      */
    ["com.affine.import-clipper.dialog.createDocToWorkspace"](options: {
        readonly workspace: string;
    }): string;
    /**
      * `Failed to import content, please try again.`
      */
    ["com.affine.import-clipper.dialog.errorImport"](): string;
    /**
      * `Failed to load content, please try again.`
      */
    ["com.affine.import-clipper.dialog.errorLoad"](): string;
    /**
      * `Create into a New Workspace`
      */
    ["com.affine.import-template.dialog.createDocToNewWorkspace"](): string;
    /**
      * `Create doc to "{{workspace}}"`
      */
    ["com.affine.import-template.dialog.createDocToWorkspace"](options: {
        readonly workspace: string;
    }): string;
    /**
      * `Create doc with "{{templateName}}" template`
      */
    ["com.affine.import-template.dialog.createDocWithTemplate"](options: {
        readonly templateName: string;
    }): string;
    /**
      * `Failed to import template, please try again.`
      */
    ["com.affine.import-template.dialog.errorImport"](): string;
    /**
      * `Failed to load template, please try again.`
      */
    ["com.affine.import-template.dialog.errorLoad"](): string;
    /**
      * `Manut workspace data`
      */
    ["com.affine.import.affine-workspace-data"](): string;
    /**
      * `Docx`
      */
    ["com.affine.import.docx"](): string;
    /**
      * `Import your .docx file.`
      */
    ["com.affine.import.docx.tooltip"](): string;
    /**
      * `.affine file`
      */
    ["com.affine.import.dotaffinefile"](): string;
    /**
      * `Import your Manut db file (.affine)`
      */
    ["com.affine.import.dotaffinefile.tooltip"](): string;
    /**
      * `HTML`
      */
    ["com.affine.import.html-files"](): string;
    /**
      * `This is an experimental feature that is not perfect and may cause your data to be missing after import.`
      */
    ["com.affine.import.html-files.tooltip"](): string;
    /**
      * `Markdown files (.md)`
      */
    ["com.affine.import.markdown-files"](): string;
    /**
      * `Markdown with media files (.zip)`
      */
    ["com.affine.import.markdown-with-media-files"](): string;
    /**
      * `Please upload a markdown zip file with attachments, experimental function, there may be data loss.`
      */
    ["com.affine.import.markdown-with-media-files.tooltip"](): string;
    /**
      * `If you'd like to request support for additional file types, feel free to let us know on`
      */
    ["com.affine.import.modal.tip"](): string;
    /**
      * `Notion`
      */
    ["com.affine.import.notion"](): string;
    /**
      * `Import your Notion data. Supported import formats: HTML with subpages.`
      */
    ["com.affine.import.notion.tooltip"](): string;
    /**
      * `Obsidian Vault`
      */
    ["com.affine.import.obsidian"](): string;
    /**
      * `Import an Obsidian vault. Select a folder to import all notes, images, and assets with wikilinks resolved.`
      */
    ["com.affine.import.obsidian.tooltip"](): string;
    /**
      * `Snapshot`
      */
    ["com.affine.import.snapshot"](): string;
    /**
      * `Import your Manut workspace and page snapshot file.`
      */
    ["com.affine.import.snapshot.tooltip"](): string;
    /**
      * `Import failed, please try again.`
      */
    ["com.affine.import.status.failed.message"](): string;
    /**
      * `No file selected`
      */
    ["com.affine.import.status.failed.message.no-file-selected"](): string;
    /**
      * `Import failure`
      */
    ["com.affine.import.status.failed.title"](): string;
    /**
      * `Importing your workspace data, please wait patiently.`
      */
    ["com.affine.import.status.importing.message"](): string;
    /**
      * `Importing...`
      */
    ["com.affine.import.status.importing.title"](): string;
    /**
      * `Your document has been imported successfully, thank you for choosing Manut. Any questions please feel free to feedback to us`
      */
    ["com.affine.import.status.success.message"](): string;
    /**
      * `Import completed`
      */
    ["com.affine.import.status.success.title"](): string;
    /**
      * `Support Markdown/Notion`
      */
    ["com.affine.import_file"](): string;
    /**
      * `Inactive`
      */
    ["com.affine.inactive"](): string;
    /**
      * `Inactive member`
      */
    ["com.affine.inactive-member"](): string;
    /**
      * `Inactive workspace`
      */
    ["com.affine.inactive-workspace"](): string;
    /**
      * `{{count}} calendar`
      */
    ["com.affine.integration.calendar.account.count"](options: {
        readonly count: string;
    }): string;
    /**
      * `Link`
      */
    ["com.affine.integration.calendar.account.link"](): string;
    /**
      * `No calendar accounts linked yet.`
      */
    ["com.affine.integration.calendar.account.linked-empty"](): string;
    /**
      * `Failed to load calendar accounts`
      */
    ["com.affine.integration.calendar.account.load-error"](): string;
    /**
      * `Authorization failed: {{error}}`
      */
    ["com.affine.integration.calendar.account.status.failed"](options: {
        readonly error: string;
    }): string;
    /**
      * `Authorization failed. Please reconnect your account.`
      */
    ["com.affine.integration.calendar.account.status.failed-reconnect"](): string;
    /**
      * `Unlink`
      */
    ["com.affine.integration.calendar.account.unlink"](): string;
    /**
      * `Failed to unlink calendar account`
      */
    ["com.affine.integration.calendar.account.unlink-error"](): string;
    /**
      * `All day`
      */
    ["com.affine.integration.calendar.all-day"](): string;
    /**
      * `Failed to start calendar authorization`
      */
    ["com.affine.integration.calendar.auth.start-error"](): string;
    /**
      * `Display name (optional)`
      */
    ["com.affine.integration.calendar.caldav.field.displayName"](): string;
    /**
      * `My CalDAV`
      */
    ["com.affine.integration.calendar.caldav.field.displayName.placeholder"](): string;
    /**
      * `Password`
      */
    ["com.affine.integration.calendar.caldav.field.password"](): string;
    /**
      * `Password is required.`
      */
    ["com.affine.integration.calendar.caldav.field.password.error"](): string;
    /**
      * `Password or app-specific password`
      */
    ["com.affine.integration.calendar.caldav.field.password.placeholder"](): string;
    /**
      * `Provider`
      */
    ["com.affine.integration.calendar.caldav.field.provider"](): string;
    /**
      * `Please select a provider.`
      */
    ["com.affine.integration.calendar.caldav.field.provider.error"](): string;
    /**
      * `Select provider`
      */
    ["com.affine.integration.calendar.caldav.field.provider.placeholder"](): string;
    /**
      * `Username`
      */
    ["com.affine.integration.calendar.caldav.field.username"](): string;
    /**
      * `Username is required.`
      */
    ["com.affine.integration.calendar.caldav.field.username.error"](): string;
    /**
      * `email@example.com`
      */
    ["com.affine.integration.calendar.caldav.field.username.placeholder"](): string;
    /**
      * `App-specific password required.`
      */
    ["com.affine.integration.calendar.caldav.hint.app-password"](): string;
    /**
      * `Provider setup guide`
      */
    ["com.affine.integration.calendar.caldav.hint.guide"](): string;
    /**
      * `Learn more`
      */
    ["com.affine.integration.calendar.caldav.hint.learn-more"](): string;
    /**
      * `Failed to link CalDAV account`
      */
    ["com.affine.integration.calendar.caldav.link.failed"](): string;
    /**
      * `Link CalDAV account`
      */
    ["com.affine.integration.calendar.caldav.link.title"](): string;
    /**
      * `New events will be scheduled in Manut’s journal`
      */
    ["com.affine.integration.calendar.desc"](): string;
    /**
      * `Calendar`
      */
    ["com.affine.integration.calendar.name"](): string;
    /**
      * `New doc`
      */
    ["com.affine.integration.calendar.new-doc"](): string;
    /**
      * `Subscribe`
      */
    ["com.affine.integration.calendar.new-subscription"](): string;
    /**
      * `Add a calendar by URL`
      */
    ["com.affine.integration.calendar.new-title"](): string;
    /**
      * `Calendar URL`
      */
    ["com.affine.integration.calendar.new-url-label"](): string;
    /**
      * `No subscribed calendars yet.`
      */
    ["com.affine.integration.calendar.no-calendar"](): string;
    /**
      * `No journal page found for {{date}}. Please create a journal page first.`
      */
    ["com.affine.integration.calendar.no-journal"](options: {
        readonly date: string;
    }): string;
    /**
      * `Failed to load calendar providers`
      */
    ["com.affine.integration.calendar.provider.load-error"](): string;
    /**
      * `An error occurred while saving the calendar settings`
      */
    ["com.affine.integration.calendar.save-error"](): string;
    /**
      * `Show all day event`
      */
    ["com.affine.integration.calendar.show-all-day-events"](): string;
    /**
      * `Show calendar events`
      */
    ["com.affine.integration.calendar.show-events"](): string;
    /**
      * `Enabling this setting allows you to connect your calendar events to your Journal in Manut`
      */
    ["com.affine.integration.calendar.show-events-desc"](): string;
    /**
      * `Unsubscribe`
      */
    ["com.affine.integration.calendar.unsubscribe"](): string;
    /**
      * `Are you sure you want to unsubscribe "{{name}}"? Unsubscribing this account will remove its data from Journal.`
      */
    ["com.affine.integration.calendar.unsubscribe-content"](options: {
        readonly name: string;
    }): string;
    /**
      * `Cloud only`
      */
    ["com.affine.integration.cloudOnly"](): string;
    /**
      * `Sign in and switch to a cloud workspace to use this integration. Local workspaces don't support cloud-backed services.`
      */
    ["com.affine.integration.cloudOnlyDesc"](): string;
    /**
      * `Connect GitHub, Slack, Linear, Figma and more to sync data into Manut.`
      */
    ["com.affine.integration.connections.desc"](): string;
    /**
      * `Connections`
      */
    ["com.affine.integration.connections.name"](): string;
    /**
      * `Link your Gmail account to import emails as docs.`
      */
    ["com.affine.integration.gmail.description"](): string;
    /**
      * `Import emails as docs`
      */
    ["com.affine.integration.gmail.import.dialog-title"](): string;
    /**
      * `Search your Gmail to import messages as docs.`
      */
    ["com.affine.integration.gmail.import.empty-state"](): string;
    /**
      * `Import`
      */
    ["com.affine.integration.gmail.import.import-button"](): string;
    /**
      * `Search your Gmail…`
      */
    ["com.affine.integration.gmail.import.search-placeholder"](): string;
    /**
      * `Imported '{{subject}}' as a new doc`
      */
    ["com.affine.integration.gmail.import.success"](options: {
        readonly subject: string;
    }): string;
    /**
      * `Gmail`
      */
    ["com.affine.integration.gmail.name"](): string;
    /**
      * `Open import…`
      */
    ["com.affine.integration.gmail.open-button"](): string;
    /**
      * `Link your Google Drive to embed files in docs.`
      */
    ["com.affine.integration.google-drive.description"](): string;
    /**
      * `Google Drive`
      */
    ["com.affine.integration.google-drive.name"](): string;
    /**
      * `Open Drive…`
      */
    ["com.affine.integration.google-drive.open-button"](): string;
    /**
      * `Link copied — paste it into a doc`
      */
    ["com.affine.integration.google-drive.picker.copied-toast"](): string;
    /**
      * `Copy link`
      */
    ["com.affine.integration.google-drive.picker.copy-link"](): string;
    /**
      * `Browse Google Drive`
      */
    ["com.affine.integration.google-drive.picker.dialog-title"](): string;
    /**
      * `Search your Drive to find files.`
      */
    ["com.affine.integration.google-drive.picker.empty-state"](): string;
    /**
      * `Open in Drive`
      */
    ["com.affine.integration.google-drive.picker.open-in-drive"](): string;
    /**
      * `Search your Drive…`
      */
    ["com.affine.integration.google-drive.picker.search-placeholder"](): string;
    /**
      * `Live import is rolling out soon.`
      */
    ["com.affine.integration.google.coming-soon"](): string;
    /**
      * `Connect Google account`
      */
    ["com.affine.integration.google.connect"](): string;
    /**
      * `Connected as {{email}}`
      */
    ["com.affine.integration.google.connected-as"](options: {
        readonly email: string;
    }): string;
    /**
      * `Disconnect`
      */
    ["com.affine.integration.google.disconnect"](): string;
    /**
      * `Connection failed: {{error}}`
      */
    ["com.affine.integration.google.error"](options: {
        readonly error: string;
    }): string;
    /**
      * `Connection failed.`
      */
    ["com.affine.integration.google.error-generic"](): string;
    /**
      * `Google OAuth client is not configured. Ask an admin to set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.`
      */
    ["com.affine.integration.google.not-configured"](): string;
    /**
      * `Integrations`
      */
    ["com.affine.integration.integrations"](): string;
    /**
      * `The MCP token is shown only once. Delete and recreate it to copy the JSON configuration.`
      */
    ["com.affine.integration.mcp-server.copy-json.disabled-hint"](): string;
    /**
      * `Enable other MCP Client to search and read the doc of Manut.`
      */
    ["com.affine.integration.mcp-server.desc"](): string;
    /**
      * `MCP Server`
      */
    ["com.affine.integration.mcp-server.name"](): string;
    /**
      * `Readwise`
      */
    ["com.affine.integration.name.readwise"](): string;
    /**
      * `Integration properties`
      */
    ["com.affine.integration.properties"](): string;
    /**
      * `Author`
      */
    ["com.affine.integration.readwise-prop.author"](): string;
    /**
      * `Created`
      */
    ["com.affine.integration.readwise-prop.created"](): string;
    /**
      * `Source`
      */
    ["com.affine.integration.readwise-prop.source"](): string;
    /**
      * `Updated`
      */
    ["com.affine.integration.readwise-prop.updated"](): string;
    /**
      * `Connect`
      */
    ["com.affine.integration.readwise.connect"](): string;
    /**
      * `The token could not access Readwise. Please verify access and try again.`
      */
    ["com.affine.integration.readwise.connect.error-notify-desc"](): string;
    /**
      * `Access Token failed validation`
      */
    ["com.affine.integration.readwise.connect.error-notify-title"](): string;
    /**
      * `Please enter a valid access token.`
      */
    ["com.affine.integration.readwise.connect.input-error"](): string;
    /**
      * `Paste your access token here`
      */
    ["com.affine.integration.readwise.connect.placeholder"](): string;
    /**
      * `Connect to Readwise`
      */
    ["com.affine.integration.readwise.connect.title"](): string;
    /**
      * `Manually import your content to Manut from Readwise`
      */
    ["com.affine.integration.readwise.desc"](): string;
    /**
      * `Disconnect`
      */
    ["com.affine.integration.readwise.disconnect"](): string;
    /**
      * `Delete`
      */
    ["com.affine.integration.readwise.disconnect.delete"](): string;
    /**
      * `Once disconnected, content will no longer be imported. Do you want to keep your existing highlights in Manut?`
      */
    ["com.affine.integration.readwise.disconnect.desc"](): string;
    /**
      * `Keep`
      */
    ["com.affine.integration.readwise.disconnect.keep"](): string;
    /**
      * `Disconnect Readwise?`
      */
    ["com.affine.integration.readwise.disconnect.title"](): string;
    /**
      * `Import`
      */
    ["com.affine.integration.readwise.import"](): string;
    /**
      * `Import aborted, with {{finished}} highlights processed`
      */
    ["com.affine.integration.readwise.import.abort-notify-desc"](options: {
        readonly finished: string;
    }): string;
    /**
      * `Importing aborted`
      */
    ["com.affine.integration.readwise.import.abort-notify-title"](): string;
    /**
      * `Content`
      */
    ["com.affine.integration.readwise.import.cell-h-content"](): string;
    /**
      * `Last update on Readwise`
      */
    ["com.affine.integration.readwise.import.cell-h-time"](): string;
    /**
      * `Todo`
      */
    ["com.affine.integration.readwise.import.cell-h-todo"](): string;
    /**
      * `Importing everything from the start`
      */
    ["com.affine.integration.readwise.import.desc-from-start"](): string;
    /**
      * `No highlights needs to be imported`
      */
    ["com.affine.integration.readwise.import.empty"](): string;
    /**
      * `Importing...`
      */
    ["com.affine.integration.readwise.import.importing"](): string;
    /**
      * `Please keep this app active until it's finished`
      */
    ["com.affine.integration.readwise.import.importing-desc"](): string;
    /**
      * `Stop Importing`
      */
    ["com.affine.integration.readwise.import.importing-stop"](): string;
    /**
      * `Highlights to be imported this time`
      */
    ["com.affine.integration.readwise.import.title"](): string;
    /**
      * `New`
      */
    ["com.affine.integration.readwise.import.todo-new"](): string;
    /**
      * `Skip`
      */
    ["com.affine.integration.readwise.import.todo-skip"](): string;
    /**
      * `Updated`
      */
    ["com.affine.integration.readwise.import.todo-update"](): string;
    /**
      * `Readwise`
      */
    ["com.affine.integration.readwise.name"](): string;
    /**
      * `Configuration`
      */
    ["com.affine.integration.readwise.setting.caption"](): string;
    /**
      * `Import`
      */
    ["com.affine.integration.readwise.setting.start-import-button"](): string;
    /**
      * `Using the settings above`
      */
    ["com.affine.integration.readwise.setting.start-import-desc"](): string;
    /**
      * `Start Importing`
      */
    ["com.affine.integration.readwise.setting.start-import-name"](): string;
    /**
      * `New highlights in Readwise will be synced to Manut `
      */
    ["com.affine.integration.readwise.setting.sync-new-desc"](): string;
    /**
      * `New Readwise highlights will be imported to Manut `
      */
    ["com.affine.integration.readwise.setting.sync-new-name"](): string;
    /**
      * `Apply tags to highlight imports`
      */
    ["com.affine.integration.readwise.setting.tags-label"](): string;
    /**
      * `Click to add tags`
      */
    ["com.affine.integration.readwise.setting.tags-placeholder"](): string;
    /**
      * `Cited or modified highlights will have future versions added to the end of them`
      */
    ["com.affine.integration.readwise.setting.update-append-desc"](): string;
    /**
      * `Append new version to the end`
      */
    ["com.affine.integration.readwise.setting.update-append-name"](): string;
    /**
      * `Enable this, so that we will process updates of existing highlights from Readwise `
      */
    ["com.affine.integration.readwise.setting.update-desc"](): string;
    /**
      * `Updates to Readwise highlights will be imported`
      */
    ["com.affine.integration.readwise.setting.update-name"](): string;
    /**
      * `Cited or modified highlights will be overwritten if there are future updates`
      */
    ["com.affine.integration.readwise.setting.update-override-desc"](): string;
    /**
      * `Overwrite with new version`
      */
    ["com.affine.integration.readwise.setting.update-override-name"](): string;
    /**
      * `How do we handle updates`
      */
    ["com.affine.integration.readwise.setting.update-strategy"](): string;
    /**
      * `Refresh`
      */
    ["com.affine.integration.refresh"](): string;
    /**
      * `Elevate your Manut experience with diverse add-ons and seamless integrations.`
      */
    ["com.affine.integration.setting.description"](): string;
    /**
      * `Learn how to develop a integration for Manut`
      */
    ["com.affine.integration.setting.learn"](): string;
    /**
      * `Available in a future release`
      */
    ["com.affine.integration.status.coming-soon"](): string;
    /**
      * `Configured by admin`
      */
    ["com.affine.integration.status.configured"](): string;
    /**
      * `Configure in admin settings`
      */
    ["com.affine.integration.status.not-configured"](): string;
    /**
      * `Import web pages to Manut`
      */
    ["com.affine.integration.web-clipper.desc"](): string;
    /**
      * `Web Clipper`
      */
    ["com.affine.integration.web-clipper.name"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.inviteModal.button.cancel"](): string;
    /**
      * `Maybe later`
      */
    ["com.affine.issue-feedback.cancel"](): string;
    /**
      * `Create issue on GitHub`
      */
    ["com.affine.issue-feedback.confirm"](): string;
    /**
      * `Got feedback? We're all ears! Create an issue on GitHub to let us know your thoughts and suggestions`
      */
    ["com.affine.issue-feedback.description"](): string;
    /**
      * `Share your feedback on GitHub`
      */
    ["com.affine.issue-feedback.title"](): string;
    /**
      * `Journals`
      */
    ["com.affine.journal.app-sidebar-title"](): string;
    /**
      * `{{count}} more articles`
      */
    ["com.affine.journal.conflict-show-more"](options: {
        readonly count: string;
    }): string;
    /**
      * `Created`
      */
    ["com.affine.journal.created-today"](): string;
    /**
      * `You haven't created anything yet`
      */
    ["com.affine.journal.daily-count-created-empty-tips"](): string;
    /**
      * `You haven't updated anything yet`
      */
    ["com.affine.journal.daily-count-updated-empty-tips"](): string;
    /**
      * `Create Daily Journal`
      */
    ["com.affine.journal.placeholder.create"](): string;
    /**
      * `No Journal`
      */
    ["com.affine.journal.placeholder.title"](): string;
    /**
      * `Updated`
      */
    ["com.affine.journal.updated-today"](): string;
    /**
      * `Just now`
      */
    ["com.affine.just-now"](): string;
    /**
      * `Align center`
      */
    ["com.affine.keyboardShortcuts.alignCenter"](): string;
    /**
      * `Align left`
      */
    ["com.affine.keyboardShortcuts.alignLeft"](): string;
    /**
      * `Align right`
      */
    ["com.affine.keyboardShortcuts.alignRight"](): string;
    /**
      * `Append to daily note`
      */
    ["com.affine.keyboardShortcuts.appendDailyNote"](): string;
    /**
      * `Body text`
      */
    ["com.affine.keyboardShortcuts.bodyText"](): string;
    /**
      * `Bold`
      */
    ["com.affine.keyboardShortcuts.bold"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.keyboardShortcuts.cancel"](): string;
    /**
      * `Code block`
      */
    ["com.affine.keyboardShortcuts.codeBlock"](): string;
    /**
      * `Connector`
      */
    ["com.affine.keyboardShortcuts.connector"](): string;
    /**
      * `Copy private link`
      */
    ["com.affine.keyboardShortcuts.copy-private-link"](): string;
    /**
      * `Divider`
      */
    ["com.affine.keyboardShortcuts.divider"](): string;
    /**
      * `Expand/collapse sidebar`
      */
    ["com.affine.keyboardShortcuts.expandOrCollapseSidebar"](): string;
    /**
      * `Go back`
      */
    ["com.affine.keyboardShortcuts.goBack"](): string;
    /**
      * `Go forward`
      */
    ["com.affine.keyboardShortcuts.goForward"](): string;
    /**
      * `Group`
      */
    ["com.affine.keyboardShortcuts.group"](): string;
    /**
      * `Group as database`
      */
    ["com.affine.keyboardShortcuts.groupDatabase"](): string;
    /**
      * `Hand`
      */
    ["com.affine.keyboardShortcuts.hand"](): string;
    /**
      * `Heading {{number}}`
      */
    ["com.affine.keyboardShortcuts.heading"](options: {
        readonly number: string;
    }): string;
    /**
      * `Image`
      */
    ["com.affine.keyboardShortcuts.image"](): string;
    /**
      * `Increase indent`
      */
    ["com.affine.keyboardShortcuts.increaseIndent"](): string;
    /**
      * `Inline code`
      */
    ["com.affine.keyboardShortcuts.inlineCode"](): string;
    /**
      * `Italic`
      */
    ["com.affine.keyboardShortcuts.italic"](): string;
    /**
      * `Hyperlink (with selected text)`
      */
    ["com.affine.keyboardShortcuts.link"](): string;
    /**
      * `Move down`
      */
    ["com.affine.keyboardShortcuts.moveDown"](): string;
    /**
      * `Move up`
      */
    ["com.affine.keyboardShortcuts.moveUp"](): string;
    /**
      * `New doc`
      */
    ["com.affine.keyboardShortcuts.newPage"](): string;
    /**
      * `Note`
      */
    ["com.affine.keyboardShortcuts.note"](): string;
    /**
      * `Pen`
      */
    ["com.affine.keyboardShortcuts.pen"](): string;
    /**
      * `Quick search`
      */
    ["com.affine.keyboardShortcuts.quickSearch"](): string;
    /**
      * `Redo`
      */
    ["com.affine.keyboardShortcuts.redo"](): string;
    /**
      * `Reduce indent`
      */
    ["com.affine.keyboardShortcuts.reduceIndent"](): string;
    /**
      * `Select`
      */
    ["com.affine.keyboardShortcuts.select"](): string;
    /**
      * `Select all`
      */
    ["com.affine.keyboardShortcuts.selectAll"](): string;
    /**
      * `Shape`
      */
    ["com.affine.keyboardShortcuts.shape"](): string;
    /**
      * `Strikethrough`
      */
    ["com.affine.keyboardShortcuts.strikethrough"](): string;
    /**
      * `Check keyboard shortcuts quickly`
      */
    ["com.affine.keyboardShortcuts.subtitle"](): string;
    /**
      * `Switch view`
      */
    ["com.affine.keyboardShortcuts.switch"](): string;
    /**
      * `Text`
      */
    ["com.affine.keyboardShortcuts.text"](): string;
    /**
      * `Keyboard shortcuts`
      */
    ["com.affine.keyboardShortcuts.title"](): string;
    /**
      * `Ungroup`
      */
    ["com.affine.keyboardShortcuts.unGroup"](): string;
    /**
      * `Underline`
      */
    ["com.affine.keyboardShortcuts.underline"](): string;
    /**
      * `Undo`
      */
    ["com.affine.keyboardShortcuts.undo"](): string;
    /**
      * `Zoom in`
      */
    ["com.affine.keyboardShortcuts.zoomIn"](): string;
    /**
      * `Zoom out`
      */
    ["com.affine.keyboardShortcuts.zoomOut"](): string;
    /**
      * `Zoom to 100%`
      */
    ["com.affine.keyboardShortcuts.zoomTo100"](): string;
    /**
      * `Zoom to fit`
      */
    ["com.affine.keyboardShortcuts.zoomToFit"](): string;
    /**
      * `Zoom to selection`
      */
    ["com.affine.keyboardShortcuts.zoomToSelection"](): string;
    /**
      * `Last {{weekday}}`
      */
    ["com.affine.last-week"](options: {
        readonly weekday: string;
    }): string;
    /**
      * `Last 30 days`
      */
    ["com.affine.last30Days"](): string;
    /**
      * `Last 7 days`
      */
    ["com.affine.last7Days"](): string;
    /**
      * `Last month`
      */
    ["com.affine.lastMonth"](): string;
    /**
      * `Last week`
      */
    ["com.affine.lastWeek"](): string;
    /**
      * `Last year`
      */
    ["com.affine.lastYear"](): string;
    /**
      * `Loading`
      */
    ["com.affine.loading"](): string;
    /**
      * `Loading document content, please wait a moment.`
      */
    ["com.affine.loading.description"](): string;
    /**
      * `Create Collection`
      */
    ["com.affine.m.explorer.collection.new-dialog-title"](): string;
    /**
      * `Rename`
      */
    ["com.affine.m.explorer.collection.rename"](): string;
    /**
      * `Rename Collection`
      */
    ["com.affine.m.explorer.collection.rename-menu-title"](): string;
    /**
      * `Rename`
      */
    ["com.affine.m.explorer.doc.rename"](): string;
    /**
      * `Create Folder`
      */
    ["com.affine.m.explorer.folder.new-dialog-title"](): string;
    /**
      * `Create a folder in the {{parent}}.`
      */
    ["com.affine.m.explorer.folder.new-tip-empty"](options: {
        readonly parent: string;
    }): string;
    /**
      * `Create "{{value}}" in the {{parent}}.`
      */
    ["com.affine.m.explorer.folder.new-tip-not-empty"](options: Readonly<{
        value: string;
        parent: string;
    }>): string;
    /**
      * `Rename`
      */
    ["com.affine.m.explorer.folder.rename"](): string;
    /**
      * `Done`
      */
    ["com.affine.m.explorer.folder.rename-confirm"](): string;
    /**
      * `Organize`
      */
    ["com.affine.m.explorer.folder.root"](): string;
    /**
      * `Manage Doc(s)`
      */
    ["com.affine.m.explorer.tag.manage-docs"](): string;
    /**
      * `Create Tag`
      */
    ["com.affine.m.explorer.tag.new-dialog-title"](): string;
    /**
      * `Create a tag in this workspace.`
      */
    ["com.affine.m.explorer.tag.new-tip-empty"](): string;
    /**
      * `Create "{{value}}" tag in this workspace.`
      */
    ["com.affine.m.explorer.tag.new-tip-not-empty"](options: {
        readonly value: string;
    }): string;
    /**
      * `Rename`
      */
    ["com.affine.m.explorer.tag.rename"](): string;
    /**
      * `Done`
      */
    ["com.affine.m.explorer.tag.rename-confirm"](): string;
    /**
      * `Rename Tag`
      */
    ["com.affine.m.explorer.tag.rename-menu-title"](): string;
    /**
      * `Rename to "{{name}}"`
      */
    ["com.affine.m.rename-to"](options: {
        readonly name: string;
    }): string;
    /**
      * `Apply`
      */
    ["com.affine.m.selector.confirm-default"](): string;
    /**
      * `Add {{count}} {{type}}(s)`
      */
    ["com.affine.m.selector.info-added"](options: Readonly<{
        count: string;
        type: string;
    }>): string;
    /**
      * `Remove {{count}} {{type}}(s)`
      */
    ["com.affine.m.selector.info-removed"](options: Readonly<{
        count: string;
        type: string;
    }>): string;
    /**
      * `{{total}} item(s)`
      */
    ["com.affine.m.selector.info-total"](options: {
        readonly total: string;
    }): string;
    /**
      * `Duplicate Entries in Today's Journal`
      */
    ["com.affine.m.selector.journal-menu.conflicts"](): string;
    /**
      * `Today's activity`
      */
    ["com.affine.m.selector.journal-menu.today-activity"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.m.selector.remove-warning.cancel"](): string;
    /**
      * `Do not ask again`
      */
    ["com.affine.m.selector.remove-warning.confirm"](): string;
    /**
      * `You unchecked {{type}} that already exist in the current {{where}}, which means you will remove them from this {{where}}. The item will not be deleted.`
      */
    ["com.affine.m.selector.remove-warning.message"](options: Readonly<{
        type: string;
        where: string;
    }>): string;
    /**
      * `Remove items`
      */
    ["com.affine.m.selector.remove-warning.title"](): string;
    /**
      * `folder`
      */
    ["com.affine.m.selector.remove-warning.where-folder"](): string;
    /**
      * `tag`
      */
    ["com.affine.m.selector.remove-warning.where-tag"](): string;
    /**
      * `Manage {{type}}(s)`
      */
    ["com.affine.m.selector.title"](options: {
        readonly type: string;
    }): string;
    /**
      * `Collection`
      */
    ["com.affine.m.selector.type-collection"](): string;
    /**
      * `Doc`
      */
    ["com.affine.m.selector.type-doc"](): string;
    /**
      * `Tag`
      */
    ["com.affine.m.selector.type-tag"](): string;
    /**
      * `Collection`
      */
    ["com.affine.m.selector.where-collection"](): string;
    /**
      * `Folder`
      */
    ["com.affine.m.selector.where-folder"](): string;
    /**
      * `Tag`
      */
    ["com.affine.m.selector.where-tag"](): string;
    /**
      * `Rename`
      */
    ["com.affine.menu.rename"](): string;
    /**
      * `Migrate data`
      */
    ["com.affine.migration-all-docs-notification.button"](): string;
    /**
      * `We are updating the local data to facilitate the recording and filtering of created by and Last edited by information. Please click the “Migrate Data” button and ensure a stable network connection during the process.`
      */
    ["com.affine.migration-all-docs-notification.desc"](): string;
    /**
      * `Migration failed: {{errorMessage}}`
      */
    ["com.affine.migration-all-docs-notification.error"](options: {
        readonly errorMessage: string;
    }): string;
    /**
      * `Migrate Data to Enhance User Experience`
      */
    ["com.affine.migration-all-docs-notification.header"](): string;
    /**
      * `No results found`
      */
    ["com.affine.mobile.search.empty"](): string;
    /**
      * `App version`
      */
    ["com.affine.mobile.setting.about.appVersion"](): string;
    /**
      * `Editor version`
      */
    ["com.affine.mobile.setting.about.editorVersion"](): string;
    /**
      * `About`
      */
    ["com.affine.mobile.setting.about.title"](): string;
    /**
      * `Font style`
      */
    ["com.affine.mobile.setting.appearance.font"](): string;
    /**
      * `Display language`
      */
    ["com.affine.mobile.setting.appearance.language"](): string;
    /**
      * `Color mode`
      */
    ["com.affine.mobile.setting.appearance.theme"](): string;
    /**
      * `Appearance`
      */
    ["com.affine.mobile.setting.appearance.title"](): string;
    /**
      * `Settings`
      */
    ["com.affine.mobile.setting.header-title"](): string;
    /**
      * `Delete my account`
      */
    ["com.affine.mobile.setting.others.delete-account"](): string;
    /**
      * `Discord Group`
      */
    ["com.affine.mobile.setting.others.discord"](): string;
    /**
      * `Star us on GitHub`
      */
    ["com.affine.mobile.setting.others.github"](): string;
    /**
      * `Privacy`
      */
    ["com.affine.mobile.setting.others.privacy"](): string;
    /**
      * `Terms of use`
      */
    ["com.affine.mobile.setting.others.terms"](): string;
    /**
      * `Privacy & others`
      */
    ["com.affine.mobile.setting.others.title"](): string;
    /**
      * `Official website`
      */
    ["com.affine.mobile.setting.others.website"](): string;
    /**
      * `Want to keep data local?`
      */
    ["com.affine.mobile.sign-in.skip.hint"](): string;
    /**
      * `Start Manut without an account`
      */
    ["com.affine.mobile.sign-in.skip.link"](): string;
    /**
      * `Older than a month`
      */
    ["com.affine.moreThan30Days"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.moveToTrash.confirmModal.cancel"](): string;
    /**
      * `Delete`
      */
    ["com.affine.moveToTrash.confirmModal.confirm"](): string;
    /**
      * `{{title}} will be moved to trash`
      */
    ["com.affine.moveToTrash.confirmModal.description"](options: {
        readonly title: string;
    }): string;
    /**
      * `{{ number }} docs will be moved to Trash`
      */
    ["com.affine.moveToTrash.confirmModal.description.multiple"](options: {
        readonly number: string;
    }): string;
    /**
      * `Delete doc?`
      */
    ["com.affine.moveToTrash.confirmModal.title"](): string;
    /**
      * `Delete {{ number }} docs?`
      */
    ["com.affine.moveToTrash.confirmModal.title.multiple"](options: {
        readonly number: string;
    }): string;
    /**
      * `Move to trash`
      */
    ["com.affine.moveToTrash.title"](): string;
    /**
      * `New tab`
      */
    ["com.affine.multi-tab.new-tab"](): string;
    /**
      * `Enabling Manut Cloud allows you to synchronise and backup data, as well as support multi-user collaboration and content publishing.`
      */
    ["com.affine.nameWorkspace.affine-cloud.description"](): string;
    /**
      * `Sync across devices with Manut Cloud`
      */
    ["com.affine.nameWorkspace.affine-cloud.title"](): string;
    /**
      * `If you want the workspace to be stored locally, you can download the desktop client.`
      */
    ["com.affine.nameWorkspace.affine-cloud.web-tips"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.nameWorkspace.button.cancel"](): string;
    /**
      * `Create`
      */
    ["com.affine.nameWorkspace.button.create"](): string;
    /**
      * `A workspace is your virtual space to capture, create and plan as just one person or together as a team.`
      */
    ["com.affine.nameWorkspace.description"](): string;
    /**
      * `Set a workspace name`
      */
    ["com.affine.nameWorkspace.placeholder"](): string;
    /**
      * `Workspace name`
      */
    ["com.affine.nameWorkspace.subtitle.workspace-name"](): string;
    /**
      * `Workspace type`
      */
    ["com.affine.nameWorkspace.subtitle.workspace-type"](): string;
    /**
      * `Name your workspace`
      */
    ["com.affine.nameWorkspace.title"](): string;
    /**
      * `New page`
      */
    ["com.affine.new.page-mode"](): string;
    /**
      * `New edgeless`
      */
    ["com.affine.new_edgeless"](): string;
    /**
      * `Import`
      */
    ["com.affine.new_import"](): string;
    /**
      * `Next {{weekday}}`
      */
    ["com.affine.next-week"](options: {
        readonly weekday: string;
    }): string;
    /**
      * `Next week`
      */
    ["com.affine.nextWeek"](): string;
    /**
      * `You don't have permission to do this`
      */
    ["com.affine.no-permission"](): string;
    /**
      * `Back home`
      */
    ["com.affine.notFoundPage.backButton"](): string;
    /**
      * `Page not found`
      */
    ["com.affine.notFoundPage.title"](): string;
    /**
      * `What are your thoughts?`
      */
    ["com.affine.notification.comment-prompt"](): string;
    /**
      * `your workspace`
      */
    ["com.affine.notification.budget-soft-cap.fallback-workspace-name"](): string;
    /**
      * `Delete all notifications`
      */
    ["com.affine.notification.delete-all"](): string;
    /**
      * `No new notifications`
      */
    ["com.affine.notification.empty"](): string;
    /**
      * `Mentions, comments, and workspace activity will show up here.`
      */
    ["com.affine.notification.empty.description"](): string;
    /**
      * `Open workspace`
      */
    ["com.affine.notification.invitation-review-approved.open-workspace"](): string;
    /**
      * `Accept & Join`
      */
    ["com.affine.notification.invitation.accept"](): string;
    /**
      * `Loading more...`
      */
    ["com.affine.notification.loading-more"](): string;
    /**
      * `Unsupported message`
      */
    ["com.affine.notification.unsupported"](): string;
    /**
      * `Dismiss`
      */
    ["com.affine.open-in-app.card.button.dismiss"](): string;
    /**
      * `Open in app`
      */
    ["com.affine.open-in-app.card.button.open"](): string;
    /**
      * `Download desktop app`
      */
    ["com.affine.open-in-app.card.download"](): string;
    /**
      * `Remember choice`
      */
    ["com.affine.open-in-app.card.remember"](): string;
    /**
      * `Open this doc in Manut app`
      */
    ["com.affine.open-in-app.card.title"](): string;
    /**
      * `Manut Community`
      */
    ["com.affine.other-page.nav.affine-community"](): string;
    /**
      * `Blog`
      */
    ["com.affine.other-page.nav.blog"](): string;
    /**
      * `Contact us`
      */
    ["com.affine.other-page.nav.contact-us"](): string;
    /**
      * `Download app`
      */
    ["com.affine.other-page.nav.download-app"](): string;
    /**
      * `Official website`
      */
    ["com.affine.other-page.nav.official-website"](): string;
    /**
      * `Open Manut`
      */
    ["com.affine.other-page.nav.open-affine"](): string;
    /**
      * `Add linked doc`
      */
    ["com.affine.page-operation.add-linked-page"](): string;
    /**
      * `Add property`
      */
    ["com.affine.page-properties.add-property"](): string;
    /**
      * `Create property`
      */
    ["com.affine.page-properties.add-property.menu.create"](): string;
    /**
      * `Properties`
      */
    ["com.affine.page-properties.add-property.menu.header"](): string;
    /**
      * `Backlinks`
      */
    ["com.affine.page-properties.backlinks"](): string;
    /**
      * `Config properties`
      */
    ["com.affine.page-properties.config-properties"](): string;
    /**
      * `Added`
      */
    ["com.affine.page-properties.create-property.added"](): string;
    /**
      * `Type`
      */
    ["com.affine.page-properties.create-property.menu.header"](): string;
    /**
      * `hide {{ count }} properties`
      */
    ["com.affine.page-properties.hide-property.more"](options: {
        readonly count: string;
    }): string;
    /**
      * `hide {{ count }} property`
      */
    ["com.affine.page-properties.hide-property.one"](options: {
        readonly count: string;
    }): string;
    /**
      * `Icons`
      */
    ["com.affine.page-properties.icons"](): string;
    /**
      * `Local user`
      */
    ["com.affine.page-properties.local-user"](): string;
    /**
      * `{{ count }} more properties`
      */
    ["com.affine.page-properties.more-property.more"](options: {
        readonly count: string;
    }): string;
    /**
      * `{{ count }} more property`
      */
    ["com.affine.page-properties.more-property.one"](options: {
        readonly count: string;
    }): string;
    /**
      * `Outgoing links`
      */
    ["com.affine.page-properties.outgoing-links"](): string;
    /**
      * `Info`
      */
    ["com.affine.page-properties.page-info"](): string;
    /**
      * `View Info`
      */
    ["com.affine.page-properties.page-info.view"](): string;
    /**
      * `No Record`
      */
    ["com.affine.page-properties.property-user-avatar-no-record"](): string;
    /**
      * `Local User`
      */
    ["com.affine.page-properties.property-user-local"](): string;
    /**
      * `Empty`
      */
    ["com.affine.page-properties.property-value-placeholder"](): string;
    /**
      * `Always hide`
      */
    ["com.affine.page-properties.property.always-hide"](): string;
    /**
      * `Always show`
      */
    ["com.affine.page-properties.property.always-show"](): string;
    /**
      * `Checkbox`
      */
    ["com.affine.page-properties.property.checkbox"](): string;
    /**
      * `Use a checkbox to indicate whether a condition is true or false. Useful for confirming options, toggling features, or tracking task states.`
      */
    ["com.affine.page-properties.property.checkbox.tooltips"](): string;
    /**
      * `Created`
      */
    ["com.affine.page-properties.property.createdAt"](): string;
    /**
      * `Track when a doc was first created. Useful for maintaining record history, sorting by creation date, or auditing content chronologically.`
      */
    ["com.affine.page-properties.property.createdAt.tooltips"](): string;
    /**
      * `Created by`
      */
    ["com.affine.page-properties.property.createdBy"](): string;
    /**
      * `Created by {{userName}}`
      */
    ["com.affine.page-properties.property.createdBy.tip"](options: {
        readonly userName: string;
    }): string;
    /**
      * `Displays the author of the current doc. Useful for tracking doc ownership, accountability, and collaboration.`
      */
    ["com.affine.page-properties.property.createdBy.tooltips"](): string;
    /**
      * `Date`
      */
    ["com.affine.page-properties.property.date"](): string;
    /**
      * `Use a date field to select or display a specific date. Useful for scheduling, setting deadlines, or recording important events.`
      */
    ["com.affine.page-properties.property.date.tooltips"](): string;
    /**
      * `Doc mode`
      */
    ["com.affine.page-properties.property.docPrimaryMode"](): string;
    /**
      * `Select the doc mode from Page Mode, Edgeless Mode, or Auto. Useful for choosing the best display for your content.`
      */
    ["com.affine.page-properties.property.docPrimaryMode.tooltips"](): string;
    /**
      * `Edgeless theme`
      */
    ["com.affine.page-properties.property.edgelessTheme"](): string;
    /**
      * `Select the doc theme from Light, Dark, or System. Useful for precise control over content viewing style.`
      */
    ["com.affine.page-properties.property.edgelessTheme.tooltips"](): string;
    /**
      * `Hide in view`
      */
    ["com.affine.page-properties.property.hide-in-view"](): string;
    /**
      * `Hide in view when empty`
      */
    ["com.affine.page-properties.property.hide-in-view-when-empty"](): string;
    /**
      * `Hide when empty`
      */
    ["com.affine.page-properties.property.hide-when-empty"](): string;
    /**
      * `Upload images to display or manage them. Useful for showcasing visual content, adding illustrations, or organizing a gallery.`
      */
    ["com.affine.page-properties.property.image.tooltips"](): string;
    /**
      * `Journal`
      */
    ["com.affine.page-properties.property.journal"](): string;
    /**
      * `Duplicated`
      */
    ["com.affine.page-properties.property.journal-duplicated"](): string;
    /**
      * `Remove journal mark`
      */
    ["com.affine.page-properties.property.journal-remove"](): string;
    /**
      * `Indicates that this doc is a journal entry or daily note. Facilitates easy capture of ideas, quick logging of thoughts, and ongoing personal reflection.`
      */
    ["com.affine.page-properties.property.journal.tooltips"](): string;
    /**
      * `Enter a link to websites or Manut docs. Useful for connecting to external resources and referencing internal docs.`
      */
    ["com.affine.page-properties.property.link.tooltips"](): string;
    /**
      * `Select one or more options. Useful for categorizing items, filtering data, or managing tags.`
      */
    ["com.affine.page-properties.property.multiSelect.tooltips"](): string;
    /**
      * `Number`
      */
    ["com.affine.page-properties.property.number"](): string;
    /**
      * `Enter a numeric value. Useful for quantities, measurements, or ranking items.`
      */
    ["com.affine.page-properties.property.number.tooltips"](): string;
    /**
      * `Page width`
      */
    ["com.affine.page-properties.property.pageWidth"](): string;
    /**
      * `Control the width of this page to fit content display needs.`
      */
    ["com.affine.page-properties.property.pageWidth.tooltips"](): string;
    /**
      * `Progress`
      */
    ["com.affine.page-properties.property.progress"](): string;
    /**
      * `Set a progress value between 0 and 100. Useful for tracking completion status, visualizing progress, or managing goals.`
      */
    ["com.affine.page-properties.property.progress.tooltips"](): string;
    /**
      * `Remove property`
      */
    ["com.affine.page-properties.property.remove-property"](): string;
    /**
      * `Required`
      */
    ["com.affine.page-properties.property.required"](): string;
    /**
      * `Choose one option. Useful for selecting a single preference, categorizing items, or making decisions.`
      */
    ["com.affine.page-properties.property.select.tooltips"](): string;
    /**
      * `Show in view`
      */
    ["com.affine.page-properties.property.show-in-view"](): string;
    /**
      * `Tags`
      */
    ["com.affine.page-properties.property.tags"](): string;
    /**
      * `Add relevant identifiers or categories to the doc. Useful for organizing content, improving searchability, and grouping related docs together.`
      */
    ["com.affine.page-properties.property.tags.tooltips"](): string;
    /**
      * `Template`
      */
    ["com.affine.page-properties.property.template"](): string;
    /**
      * `Mark this doc as a template, which can be used to create new docs.`
      */
    ["com.affine.page-properties.property.template.tooltips"](): string;
    /**
      * `Text`
      */
    ["com.affine.page-properties.property.text"](): string;
    /**
      * `Enter text. Useful for descriptions, comments, notes, or any other free-form text input.`
      */
    ["com.affine.page-properties.property.text.tooltips"](): string;
    /**
      * `Updated`
      */
    ["com.affine.page-properties.property.updatedAt"](): string;
    /**
      * `Record the last modification timestamp. Useful for tracking changes, identifying recent updates, or monitoring content freshness.`
      */
    ["com.affine.page-properties.property.updatedAt.tooltips"](): string;
    /**
      * `Last edited by`
      */
    ["com.affine.page-properties.property.updatedBy"](): string;
    /**
      * `Last edited by {{userName}}`
      */
    ["com.affine.page-properties.property.updatedBy.tip"](options: {
        readonly userName: string;
    }): string;
    /**
      * `Displays the last editor of the current doc. Useful for tracking recent changes.`
      */
    ["com.affine.page-properties.property.updatedBy.tooltips"](): string;
    /**
      * `customize properties`
      */
    ["com.affine.page-properties.settings.title"](): string;
    /**
      * `Open tag page`
      */
    ["com.affine.page-properties.tags.open-tags-page"](): string;
    /**
      * `Select tag or create one`
      */
    ["com.affine.page-properties.tags.selector-header-title"](): string;
    /**
      * `With AI`
      */
    ["com.affine.page-starter-bar.ai"](): string;
    /**
      * `Edgeless`
      */
    ["com.affine.page-starter-bar.edgeless"](): string;
    /**
      * `Start`
      */
    ["com.affine.page-starter-bar.start"](): string;
    /**
      * `Template`
      */
    ["com.affine.page-starter-bar.template"](): string;
    /**
      * `Display`
      */
    ["com.affine.page.display"](): string;
    /**
      * `Display properties`
      */
    ["com.affine.page.display.display-properties"](): string;
    /**
      * `Body notes`
      */
    ["com.affine.page.display.display-properties.body-notes"](): string;
    /**
      * `Grouping`
      */
    ["com.affine.page.display.grouping"](): string;
    /**
      * `Favourites`
      */
    ["com.affine.page.display.grouping.group-by-favourites"](): string;
    /**
      * `Tag`
      */
    ["com.affine.page.display.grouping.group-by-tag"](): string;
    /**
      * `Untagged`
      */
    ["com.affine.page.display.grouping.group-by-tag.untagged"](): string;
    /**
      * `No grouping`
      */
    ["com.affine.page.display.grouping.no-grouping"](): string;
    /**
      * `List option`
      */
    ["com.affine.page.display.list-option"](): string;
    /**
      * `Clear selection`
      */
    ["com.affine.page.group-header.clear"](): string;
    /**
      * `Favourited`
      */
    ["com.affine.page.group-header.favourited"](): string;
    /**
      * `Not favourited`
      */
    ["com.affine.page.group-header.not-favourited"](): string;
    /**
      * `Select all`
      */
    ["com.affine.page.group-header.select-all"](): string;
    /**
      * `Created by {{name}}`
      */
    ["com.affine.page.toolbar.created_by"](options: {
        readonly name: string;
    }): string;
    /**
      * `Doc mode`
      */
    ["com.affine.pageMode"](): string;
    /**
      * `all`
      */
    ["com.affine.pageMode.all"](): string;
    /**
      * `Edgeless`
      */
    ["com.affine.pageMode.edgeless"](): string;
    /**
      * `Page`
      */
    ["com.affine.pageMode.page"](): string;
    /**
      * `Congratulations on your successful purchase of Manut AI! You're now empowered to refine your content, generate images, and craft comprehensive mindmaps directly within Manut AI, dramatically enhancing your productivity.`
      */
    ["com.affine.payment.ai-upgrade-success-page.text"](): string;
    /**
      * `Purchase successful!`
      */
    ["com.affine.payment.ai-upgrade-success-page.title"](): string;
    /**
      * `Cancel subscription`
      */
    ["com.affine.payment.ai.action.cancel.button-label"](): string;
    /**
      * `Keep Manut AI`
      */
    ["com.affine.payment.ai.action.cancel.confirm.cancel-text"](): string;
    /**
      * `Cancel subscription`
      */
    ["com.affine.payment.ai.action.cancel.confirm.confirm-text"](): string;
    /**
      * `If you end your subscription now, you can still use Manut AI until the end of this billing period.`
      */
    ["com.affine.payment.ai.action.cancel.confirm.description"](): string;
    /**
      * `Cancel subscription`
      */
    ["com.affine.payment.ai.action.cancel.confirm.title"](): string;
    /**
      * `Login`
      */
    ["com.affine.payment.ai.action.login.button-label"](): string;
    /**
      * `Resume`
      */
    ["com.affine.payment.ai.action.resume.button-label"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.payment.ai.action.resume.confirm.cancel-text"](): string;
    /**
      * `Confirm`
      */
    ["com.affine.payment.ai.action.resume.confirm.confirm-text"](): string;
    /**
      * `Are you sure you want to resume the subscription for Manut AI? This means your payment method will be charged automatically at the end of each billing cycle, starting from the next billing cycle.`
      */
    ["com.affine.payment.ai.action.resume.confirm.description"](): string;
    /**
      * `You will be charged in the next billing cycle.`
      */
    ["com.affine.payment.ai.action.resume.confirm.notify.msg"](): string;
    /**
      * `Subscription updated`
      */
    ["com.affine.payment.ai.action.resume.confirm.notify.title"](): string;
    /**
      * `Resume auto-renewal?`
      */
    ["com.affine.payment.ai.action.resume.confirm.title"](): string;
    /**
      * `Write with you`
      */
    ["com.affine.payment.ai.benefit.g1"](): string;
    /**
      * `Create quality content from sentences to articles on topics you need`
      */
    ["com.affine.payment.ai.benefit.g1-1"](): string;
    /**
      * `Rewrite like the professionals`
      */
    ["com.affine.payment.ai.benefit.g1-2"](): string;
    /**
      * `Change the tones / fix spelling & grammar`
      */
    ["com.affine.payment.ai.benefit.g1-3"](): string;
    /**
      * `Draw with you`
      */
    ["com.affine.payment.ai.benefit.g2"](): string;
    /**
      * `Visualize your mind, magically`
      */
    ["com.affine.payment.ai.benefit.g2-1"](): string;
    /**
      * `Turn your outline into beautiful, engaging presentations`
      */
    ["com.affine.payment.ai.benefit.g2-2"](): string;
    /**
      * `Summarize your content into structured mind-map`
      */
    ["com.affine.payment.ai.benefit.g2-3"](): string;
    /**
      * `Plan with you`
      */
    ["com.affine.payment.ai.benefit.g3"](): string;
    /**
      * `Memorize and tidy up your knowledge`
      */
    ["com.affine.payment.ai.benefit.g3-1"](): string;
    /**
      * `Auto-sorting and auto-tagging`
      */
    ["com.affine.payment.ai.benefit.g3-2"](): string;
    /**
      * `Open source & Privacy ensured`
      */
    ["com.affine.payment.ai.benefit.g3-3"](): string;
    /**
      * `You have purchased Manut AI. The expiration date is {{end}}.`
      */
    ["com.affine.payment.ai.billing-tip.end-at"](options: {
        readonly end: string;
    }): string;
    /**
      * `You have purchased Manut AI. The next payment date is {{due}}.`
      */
    ["com.affine.payment.ai.billing-tip.next-bill-at"](options: {
        readonly due: string;
    }): string;
    /**
      * `You are currently on the Free plan.`
      */
    ["com.affine.payment.ai.pricing-plan.caption-free"](): string;
    /**
      * `You have purchased Manut AI`
      */
    ["com.affine.payment.ai.pricing-plan.caption-purchased"](): string;
    /**
      * `Learn about Manut AI`
      */
    ["com.affine.payment.ai.pricing-plan.learn"](): string;
    /**
      * `Manut AI`
      */
    ["com.affine.payment.ai.pricing-plan.title"](): string;
    /**
      * `Turn all your ideas into reality`
      */
    ["com.affine.payment.ai.pricing-plan.title-caption-1"](): string;
    /**
      * `A true multimodal AI copilot.`
      */
    ["com.affine.payment.ai.pricing-plan.title-caption-2"](): string;
    /**
      * `This model requires Manut AI subscription.`
      */
    ["com.affine.payment.ai.pro-locked.title"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.payment.ai.pro-locked.upgrade"](): string;
    /**
      * `Billed annually`
      */
    ["com.affine.payment.ai.subscribe.billed-annually"](): string;
    /**
      * `You have purchased Manut AI.`
      */
    ["com.affine.payment.ai.usage-description-purchased"](): string;
    /**
      * `Manut AI usage`
      */
    ["com.affine.payment.ai.usage-title"](): string;
    /**
      * `Each chat reply, image generation, or AI-action click counts as one request. Resets monthly.`
      */
    ["com.affine.payment.ai.usage-tooltip"](): string;
    /**
      * `Change plan`
      */
    ["com.affine.payment.ai.usage.change-button-label"](): string;
    /**
      * `Purchase`
      */
    ["com.affine.payment.ai.usage.purchase-button-label"](): string;
    /**
      * `Times used`
      */
    ["com.affine.payment.ai.usage.used-caption"](): string;
    /**
      * `{{used}}/{{limit}} times`
      */
    ["com.affine.payment.ai.usage.used-detail"](options: Readonly<{
        used: string;
        limit: string;
    }>): string;
    /**
      * `Unlimited local workspaces`
      */
    ["com.affine.payment.benefit-1"](): string;
    /**
      * `Unlimited login devices`
      */
    ["com.affine.payment.benefit-2"](): string;
    /**
      * `Unlimited blocks`
      */
    ["com.affine.payment.benefit-3"](): string;
    /**
      * `{{capacity}} of cloud storage`
      */
    ["com.affine.payment.benefit-4"](options: {
        readonly capacity: string;
    }): string;
    /**
      * `{{capacity}} of maximum file size`
      */
    ["com.affine.payment.benefit-5"](options: {
        readonly capacity: string;
    }): string;
    /**
      * `Number of members per workspace ≤ {{capacity}}`
      */
    ["com.affine.payment.benefit-6"](options: {
        readonly capacity: string;
    }): string;
    /**
      * `{{capacity}}-days version history`
      */
    ["com.affine.payment.benefit-7"](options: {
        readonly capacity: string;
    }): string;
    /**
      * `Manut AI`
      */
    ["com.affine.payment.billing-setting.ai-plan"](): string;
    /**
      * `Purchase`
      */
    ["com.affine.payment.billing-setting.ai.purchase"](): string;
    /**
      * `Start free trial`
      */
    ["com.affine.payment.billing-setting.ai.start-free-trial"](): string;
    /**
      * `One-time payment`
      */
    ["com.affine.payment.billing-setting.believer.price-caption"](): string;
    /**
      * `Manut Cloud`
      */
    ["com.affine.payment.billing-setting.believer.title"](): string;
    /**
      * `Cancel subscription`
      */
    ["com.affine.payment.billing-setting.cancel-subscription"](): string;
    /**
      * `Once you canceled subscription you will no longer enjoy the plan benefits.`
      */
    ["com.affine.payment.billing-setting.cancel-subscription.description"](): string;
    /**
      * `Change plan`
      */
    ["com.affine.payment.billing-setting.change-plan"](): string;
    /**
      * `Manut Cloud`
      */
    ["com.affine.payment.billing-setting.current-plan"](): string;
    /**
      * `Due date`
      */
    ["com.affine.payment.billing-setting.due-date"](): string;
    /**
      * `Your subscription will end on {{dueDate}}`
      */
    ["com.affine.payment.billing-setting.due-date.description"](options: {
        readonly dueDate: string;
    }): string;
    /**
      * `Expiration date`
      */
    ["com.affine.payment.billing-setting.expiration-date"](): string;
    /**
      * `Your subscription is valid until {{expirationDate}}`
      */
    ["com.affine.payment.billing-setting.expiration-date.description"](options: {
        readonly expirationDate: string;
    }): string;
    /**
      * `Billing history`
      */
    ["com.affine.payment.billing-setting.history"](): string;
    /**
      * `Information`
      */
    ["com.affine.payment.billing-setting.information"](): string;
    /**
      * `month`
      */
    ["com.affine.payment.billing-setting.month"](): string;
    /**
      * `There are no invoices to display.`
      */
    ["com.affine.payment.billing-setting.no-invoice"](): string;
    /**
      * `Paid`
      */
    ["com.affine.payment.billing-setting.paid"](): string;
    /**
      * `Manage payment details`
      */
    ["com.affine.payment.billing-setting.payment-method"](): string;
    /**
      * `View future and past invoices, update billing information, and change payment methods. Provided by Stripe.`
      */
    ["com.affine.payment.billing-setting.payment-method.description"](): string;
    /**
      * `Go`
      */
    ["com.affine.payment.billing-setting.payment-method.go"](): string;
    /**
      * `Renew date`
      */
    ["com.affine.payment.billing-setting.renew-date"](): string;
    /**
      * `Next billing date: {{renewDate}}`
      */
    ["com.affine.payment.billing-setting.renew-date.description"](options: {
        readonly renewDate: string;
    }): string;
    /**
      * `Resume`
      */
    ["com.affine.payment.billing-setting.resume-subscription"](): string;
    /**
      * `Manage your billing information and invoices`
      */
    ["com.affine.payment.billing-setting.subtitle"](): string;
    /**
      * `Billing`
      */
    ["com.affine.payment.billing-setting.title"](): string;
    /**
      * `Update`
      */
    ["com.affine.payment.billing-setting.update"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.payment.billing-setting.upgrade"](): string;
    /**
      * `View invoice`
      */
    ["com.affine.payment.billing-setting.view-invoice"](): string;
    /**
      * `year`
      */
    ["com.affine.payment.billing-setting.year"](): string;
    /**
      * `Your recent payment failed, the next payment date is {{due}}.`
      */
    ["com.affine.payment.billing-tip.past-due"](options: {
        readonly due: string;
    }): string;
    /**
      * `Please tell us more about your use case, to make Manut better.`
      */
    ["com.affine.payment.billing-type-form.description"](): string;
    /**
      * `Go`
      */
    ["com.affine.payment.billing-type-form.go"](): string;
    /**
      * `Tell us your use case`
      */
    ["com.affine.payment.billing-type-form.title"](): string;
    /**
      * `You have reached the limit`
      */
    ["com.affine.payment.blob-limit.title"](): string;
    /**
      * `Book a demo`
      */
    ["com.affine.payment.book-a-demo"](): string;
    /**
      * `Buy Pro`
      */
    ["com.affine.payment.buy-pro"](): string;
    /**
      * `Change to {{to}} Billing`
      */
    ["com.affine.payment.change-to"](options: {
        readonly to: string;
    }): string;
    /**
      * `Include in FOSS`
      */
    ["com.affine.payment.cloud.free.benefit.g1"](): string;
    /**
      * `Unlimited local workspaces`
      */
    ["com.affine.payment.cloud.free.benefit.g1-1"](): string;
    /**
      * `Unlimited use and customization`
      */
    ["com.affine.payment.cloud.free.benefit.g1-2"](): string;
    /**
      * `Unlimited doc and edgeless editing`
      */
    ["com.affine.payment.cloud.free.benefit.g1-3"](): string;
    /**
      * `Include in Basic`
      */
    ["com.affine.payment.cloud.free.benefit.g2"](): string;
    /**
      * `10 GB of cloud storage.`
      */
    ["com.affine.payment.cloud.free.benefit.g2-1"](): string;
    /**
      * `10 MB of maximum file size.`
      */
    ["com.affine.payment.cloud.free.benefit.g2-2"](): string;
    /**
      * `Up to 3 members per workspace.`
      */
    ["com.affine.payment.cloud.free.benefit.g2-3"](): string;
    /**
      * `7-days cloud time machine file version history.`
      */
    ["com.affine.payment.cloud.free.benefit.g2-4"](): string;
    /**
      * `Up to 3 login devices.`
      */
    ["com.affine.payment.cloud.free.benefit.g2-5"](): string;
    /**
      * `Local Editor under MIT license.`
      */
    ["com.affine.payment.cloud.free.description"](): string;
    /**
      * `Local FOSS + Cloud Basic`
      */
    ["com.affine.payment.cloud.free.name"](): string;
    /**
      * `Free forever`
      */
    ["com.affine.payment.cloud.free.title"](): string;
    /**
      * `Included in Believer plan`
      */
    ["com.affine.payment.cloud.lifetime.included"](): string;
    /**
      * `Included in Pro plan`
      */
    ["com.affine.payment.cloud.onetime.included"](): string;
    /**
      * `We host, no technical setup required.`
      */
    ["com.affine.payment.cloud.pricing-plan.select.caption"](): string;
    /**
      * `Hosted by Manut.Pro`
      */
    ["com.affine.payment.cloud.pricing-plan.select.title"](): string;
    /**
      * `Billed annually`
      */
    ["com.affine.payment.cloud.pricing-plan.toggle-billed-yearly"](): string;
    /**
      * `Saving {{discount}}%`
      */
    ["com.affine.payment.cloud.pricing-plan.toggle-discount"](options: {
        readonly discount: string;
    }): string;
    /**
      * `Annually`
      */
    ["com.affine.payment.cloud.pricing-plan.toggle-yearly"](): string;
    /**
      * `Include in Pro`
      */
    ["com.affine.payment.cloud.pro.benefit.g1"](): string;
    /**
      * `Everything in Manut FOSS & Basic.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-1"](): string;
    /**
      * `100 GB of cloud storage.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-2"](): string;
    /**
      * `100 MB of maximum file size.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-3"](): string;
    /**
      * `Up to 10 members per workspace.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-4"](): string;
    /**
      * `30-days cloud time machine file version history.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-5"](): string;
    /**
      * `Add comments on Doc and Edgeless.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-6"](): string;
    /**
      * `Community support.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-7"](): string;
    /**
      * `Real-time syncing & collaboration for more people.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-8"](): string;
    /**
      * `Granular edit access to docs.`
      */
    ["com.affine.payment.cloud.pro.benefit.g1-9"](): string;
    /**
      * `For family and small teams.`
      */
    ["com.affine.payment.cloud.pro.description"](): string;
    /**
      * `Pro`
      */
    ["com.affine.payment.cloud.pro.name"](): string;
    /**
      * `annually`
      */
    ["com.affine.payment.cloud.pro.title.billed-yearly"](): string;
    /**
      * `{{price}} per month`
      */
    ["com.affine.payment.cloud.pro.title.price-monthly"](options: {
        readonly price: string;
    }): string;
    /**
      * `Include in Team Workspace`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1"](): string;
    /**
      * `Everything in Manut Pro.`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1-1"](): string;
    /**
      * `100 GB initial storage + 20 GB per seat.`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1-2"](): string;
    /**
      * `500 MB of maximum file size.`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1-3"](): string;
    /**
      * `Unlimited team members (10+ seats).`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1-4"](): string;
    /**
      * `Multiple admin roles.`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1-5"](): string;
    /**
      * `Priority customer support.`
      */
    ["com.affine.payment.cloud.team-workspace.benefit.g1-6"](): string;
    /**
      * `Best for scalable teams.`
      */
    ["com.affine.payment.cloud.team-workspace.description"](): string;
    /**
      * `Team`
      */
    ["com.affine.payment.cloud.team-workspace.name"](): string;
    /**
      * `annually`
      */
    ["com.affine.payment.cloud.team-workspace.title.billed-yearly"](): string;
    /**
      * `{{price}} per seat/month`
      */
    ["com.affine.payment.cloud.team-workspace.title.price-monthly"](options: {
        readonly price: string;
    }): string;
    /**
      * `Contact sales`
      */
    ["com.affine.payment.contact-sales"](): string;
    /**
      * `Current plan`
      */
    ["com.affine.payment.current-plan"](): string;
    /**
      * `{{amount}}% off`
      */
    ["com.affine.payment.discount-amount"](options: {
        readonly amount: string;
    }): string;
    /**
      * `Downgrade`
      */
    ["com.affine.payment.downgrade"](): string;
    /**
      * `We'd like to hear more about where we fall short, so that we can make Manut better.`
      */
    ["com.affine.payment.downgraded-notify.content"](): string;
    /**
      * `Later`
      */
    ["com.affine.payment.downgraded-notify.later"](): string;
    /**
      * `Sure, Open in browser`
      */
    ["com.affine.payment.downgraded-notify.ok-client"](): string;
    /**
      * `Sure, Open in new tab`
      */
    ["com.affine.payment.downgraded-notify.ok-web"](): string;
    /**
      * `Sorry to see you go`
      */
    ["com.affine.payment.downgraded-notify.title"](): string;
    /**
      * `You have successfully downgraded. After the current billing period ends, your account will automatically switch to the Free plan.`
      */
    ["com.affine.payment.downgraded-tooltip"](): string;
    /**
      * `Best team workspace for collaboration and knowledge distilling.`
      */
    ["com.affine.payment.dynamic-benefit-1"](): string;
    /**
      * `Focusing on what really matters with team project management and automation.`
      */
    ["com.affine.payment.dynamic-benefit-2"](): string;
    /**
      * `Pay for seats, fits all team size.`
      */
    ["com.affine.payment.dynamic-benefit-3"](): string;
    /**
      * `Solutions & best practices for dedicated needs.`
      */
    ["com.affine.payment.dynamic-benefit-4"](): string;
    /**
      * `Embedable & interrogations with IT support.`
      */
    ["com.affine.payment.dynamic-benefit-5"](): string;
    /**
      * `Copied key to clipboard`
      */
    ["com.affine.payment.license-success.copy"](): string;
    /**
      * `You can use this key to upgrade in Settings > Workspace > License > Use purchased key`
      */
    ["com.affine.payment.license-success.hint"](): string;
    /**
      * `Open Manut`
      */
    ["com.affine.payment.license-success.open-affine"](): string;
    /**
      * `Thank you for purchasing your Manut license.`
      */
    ["com.affine.payment.license-success.text-1"](): string;
    /**
      * `Thank you for your purchase!`
      */
    ["com.affine.payment.license-success.title"](): string;
    /**
      * `Everything in Manut Pro`
      */
    ["com.affine.payment.lifetime.benefit-1"](): string;
    /**
      * `Life-time personal usage`
      */
    ["com.affine.payment.lifetime.benefit-2"](): string;
    /**
      * `{{capacity}} Cloud Storage`
      */
    ["com.affine.payment.lifetime.benefit-3"](options: {
        readonly capacity: string;
    }): string;
    /**
      * `Dedicated Discord support with Manut makers`
      */
    ["com.affine.payment.lifetime.benefit-4"](): string;
    /**
      * `Become a Life-time supporter?`
      */
    ["com.affine.payment.lifetime.caption-1"](): string;
    /**
      * `Purchase`
      */
    ["com.affine.payment.lifetime.purchase"](): string;
    /**
      * `Purchased`
      */
    ["com.affine.payment.lifetime.purchased"](): string;
    /**
      * `Believer Plan`
      */
    ["com.affine.payment.lifetime.title"](): string;
    /**
      * `Workspaces created by {{planName}} users are limited to {{quota}} members. To add more collaborators, you can:`
      */
    ["com.affine.payment.member-limit.description"](options: Readonly<{
        planName: string;
        quota: string;
    }>): string;
    /**
      * `Convert to a Team Workspace for unlimited collaboration`
      */
    ["com.affine.payment.member-limit.description.tips-1"](): string;
    /**
      * `Or create a new workspace`
      */
    ["com.affine.payment.member-limit.description.tips-2"](): string;
    /**
      * `Upgrade to Manut Pro for expanded member capacity`
      */
    ["com.affine.payment.member-limit.description.tips-for-free-plan"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.payment.member-limit.free.confirm"](): string;
    /**
      * `Got it`
      */
    ["com.affine.payment.member-limit.pro.confirm"](): string;
    /**
      * `You have reached the limit`
      */
    ["com.affine.payment.member-limit.title"](): string;
    /**
      * `Manage members here. {{planName}} users can invite up to {{memberLimit}}`
      */
    ["com.affine.payment.member.description"](options: Readonly<{
        planName: string;
        memberLimit: string;
    }>): string;
    /**
      * `Choose your plan`
      */
    ["com.affine.payment.member.description.choose-plan"](): string;
    /**
      * `go upgrade`
      */
    ["com.affine.payment.member.description.go-upgrade"](): string;
    /**
      * `Looking to collaborate with more people?`
      */
    ["com.affine.payment.member.description2"](): string;
    /**
      * `Approve`
      */
    ["com.affine.payment.member.team.approve"](): string;
    /**
      * `You have approved the {{name}}’s request to join this workspace`
      */
    ["com.affine.payment.member.team.approve.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Request approved`
      */
    ["com.affine.payment.member.team.approve.notify.title"](): string;
    /**
      * `Assign as owner`
      */
    ["com.affine.payment.member.team.assign"](): string;
    /**
      * `Transfer Ownership`
      */
    ["com.affine.payment.member.team.assign.confirm.button"](): string;
    /**
      * `You are about to transfer workspace ownership to {{name}}. Please review the following changes carefully:`
      */
    ["com.affine.payment.member.team.assign.confirm.description"](options: {
        readonly name: string;
    }): string;
    /**
      * `This action cannot be undone`
      */
    ["com.affine.payment.member.team.assign.confirm.description-1"](): string;
    /**
      * `Your role will be changed to Admin`
      */
    ["com.affine.payment.member.team.assign.confirm.description-2"](): string;
    /**
      * `You will lose ownership rights to the entire workspace`
      */
    ["com.affine.payment.member.team.assign.confirm.description-3"](): string;
    /**
      * `To confirm this transfer, please type the workspace name`
      */
    ["com.affine.payment.member.team.assign.confirm.description-4"](): string;
    /**
      * `Type workspace name to confirm`
      */
    ["com.affine.payment.member.team.assign.confirm.placeholder"](): string;
    /**
      * `Confirm new workspace owner`
      */
    ["com.affine.payment.member.team.assign.confirm.title"](): string;
    /**
      * `You have successfully assigned {{name}} as the owner of this workspace.`
      */
    ["com.affine.payment.member.team.assign.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Owner assigned`
      */
    ["com.affine.payment.member.team.assign.notify.title"](): string;
    /**
      * `Change role to admin`
      */
    ["com.affine.payment.member.team.change.admin"](): string;
    /**
      * `You have successfully promoted {{name}} to Admin.`
      */
    ["com.affine.payment.member.team.change.admin.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Change role to collaborator`
      */
    ["com.affine.payment.member.team.change.collaborator"](): string;
    /**
      * `You have successfully changed {{name}} s role to collaborator.`
      */
    ["com.affine.payment.member.team.change.collaborator.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Role Updated`
      */
    ["com.affine.payment.member.team.change.notify.title"](): string;
    /**
      * `Decline`
      */
    ["com.affine.payment.member.team.decline"](): string;
    /**
      * `You have declined the {{name}}’s request to join this workspace`
      */
    ["com.affine.payment.member.team.decline.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Request declined`
      */
    ["com.affine.payment.member.team.decline.notify.title"](): string;
    /**
      * `Work together with unlimited team members.`
      */
    ["com.affine.payment.member.team.description"](): string;
    /**
      * `Your team workspace has subscription disabled, which prevents adding more seats. Please contact your workspace owner to enable subscription.`
      */
    ["com.affine.payment.member.team.disabled-subscription.admin.description"](): string;
    /**
      * `Subscription has been disabled for your team workspace. To add more seats, you'll need to resume subscription first.`
      */
    ["com.affine.payment.member.team.disabled-subscription.owner.description"](): string;
    /**
      * `Resume Subscription`
      */
    ["com.affine.payment.member.team.disabled-subscription.resume-subscription"](): string;
    /**
      * `Copy`
      */
    ["com.affine.payment.member.team.invite.copy"](): string;
    /**
      * `Invite new members to join your workspace via email or share an invite link`
      */
    ["com.affine.payment.member.team.invite.description"](): string;
    /**
      * `Done`
      */
    ["com.affine.payment.member.team.invite.done"](): string;
    /**
      * `Email addresses`
      */
    ["com.affine.payment.member.team.invite.email-addresses"](): string;
    /**
      * `Email Invite`
      */
    ["com.affine.payment.member.team.invite.email-invite"](): string;
    /**
      * `Enter email addresses (separated by commas)`
      */
    ["com.affine.payment.member.team.invite.email-placeholder"](): string;
    /**
      * `{{number}} days`
      */
    ["com.affine.payment.member.team.invite.expiration-date"](options: {
        readonly number: string;
    }): string;
    /**
      * `To expire at: {{expireTime}}`
      */
    ["com.affine.payment.member.team.invite.expire-at"](options: {
        readonly expireTime: string;
    }): string;
    /**
      * `Generate`
      */
    ["com.affine.payment.member.team.invite.generate"](): string;
    /**
      * `Import CSV`
      */
    ["com.affine.payment.member.team.invite.import-csv"](): string;
    /**
      * `Invitation link`
      */
    ["com.affine.payment.member.team.invite.invitation-link"](): string;
    /**
      * `Generate a link to invite members to your workspace`
      */
    ["com.affine.payment.member.team.invite.invitation-link.description"](): string;
    /**
      * `Invite Link`
      */
    ["com.affine.payment.member.team.invite.invite-link"](): string;
    /**
      * `Link expiration`
      */
    ["com.affine.payment.member.team.invite.link-expiration"](): string;
    /**
      * `These email addresses have already been invited:`
      */
    ["com.affine.payment.member.team.invite.notify.fail-message"](): string;
    /**
      * `Invitation sent,{{successCount}} successful, {{failedCount}} failed`
      */
    ["com.affine.payment.member.team.invite.notify.title"](options: Readonly<{
        successCount: string;
        failedCount: string;
    }>): string;
    /**
      * `Send Invites`
      */
    ["com.affine.payment.member.team.invite.send-invites"](): string;
    /**
      * `Invite team members`
      */
    ["com.affine.payment.member.team.invite.title"](): string;
    /**
      * `Remove member`
      */
    ["com.affine.payment.member.team.remove"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.payment.member.team.remove.confirm.cancel"](): string;
    /**
      * `Remove Member`
      */
    ["com.affine.payment.member.team.remove.confirm.confirm-button"](): string;
    /**
      * `This action will revoke their access to all workspace resources immediately.`
      */
    ["com.affine.payment.member.team.remove.confirm.description"](): string;
    /**
      * `Remove member from workspace?`
      */
    ["com.affine.payment.member.team.remove.confirm.title"](): string;
    /**
      * `You have removed {{name}} from this workspace`
      */
    ["com.affine.payment.member.team.remove.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Member removed`
      */
    ["com.affine.payment.member.team.remove.notify.title"](): string;
    /**
      * `Retry payment`
      */
    ["com.affine.payment.member.team.retry-payment"](): string;
    /**
      * `The payment for adding new team members has failed. Please contact your workspace owner to update the payment method and process unpaid invoices.`
      */
    ["com.affine.payment.member.team.retry-payment.admin.description"](): string;
    /**
      * `The payment for adding new team members has failed. To add more seats, please update your payment method and process unpaid invoices.`
      */
    ["com.affine.payment.member.team.retry-payment.owner.description"](): string;
    /**
      * `Insufficient Team Seats`
      */
    ["com.affine.payment.member.team.retry-payment.title"](): string;
    /**
      * `Update Payment`
      */
    ["com.affine.payment.member.team.retry-payment.update-payment"](): string;
    /**
      * `Revoke invitation`
      */
    ["com.affine.payment.member.team.revoke"](): string;
    /**
      * `You have canceled the invitation for {{name}}`
      */
    ["com.affine.payment.member.team.revoke.notify.message"](options: {
        readonly name: string;
    }): string;
    /**
      * `Invitation Revoked`
      */
    ["com.affine.payment.member.team.revoke.notify.title"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.payment.modal.change.cancel"](): string;
    /**
      * `Change`
      */
    ["com.affine.payment.modal.change.confirm"](): string;
    /**
      * `Change your subscription`
      */
    ["com.affine.payment.modal.change.title"](): string;
    /**
      * `Cancel subscription`
      */
    ["com.affine.payment.modal.downgrade.cancel"](): string;
    /**
      * `You can still use Manut Cloud Pro until the end of this billing period :)`
      */
    ["com.affine.payment.modal.downgrade.caption"](): string;
    /**
      * `Keep Manut Cloud Pro`
      */
    ["com.affine.payment.modal.downgrade.confirm"](): string;
    /**
      * `We're sorry to see you go, but we're always working to improve, and your feedback is welcome. We hope to see you return in the future.`
      */
    ["com.affine.payment.modal.downgrade.content"](): string;
    /**
      * `Keep Team plan`
      */
    ["com.affine.payment.modal.downgrade.team-confirm"](): string;
    /**
      * `Are you sure?`
      */
    ["com.affine.payment.modal.downgrade.title"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.payment.modal.resume.cancel"](): string;
    /**
      * `Confirm`
      */
    ["com.affine.payment.modal.resume.confirm"](): string;
    /**
      * `Are you sure you want to resume the subscription for your pro account? This means your payment method will be charged automatically at the end of each billing cycle, starting from the next billing cycle.`
      */
    ["com.affine.payment.modal.resume.content"](): string;
    /**
      * `Resume auto-renewal?`
      */
    ["com.affine.payment.modal.resume.title"](): string;
    /**
      * `Refresh`
      */
    ["com.affine.payment.plans-error-retry"](): string;
    /**
      * `Unable to load pricing plans, please check your network. `
      */
    ["com.affine.payment.plans-error-tip"](): string;
    /**
      * `monthly`
      */
    ["com.affine.payment.recurring-monthly"](): string;
    /**
      * `annually`
      */
    ["com.affine.payment.recurring-yearly"](): string;
    /**
      * `Redeem code`
      */
    ["com.affine.payment.redeem-code"](): string;
    /**
      * `Resume`
      */
    ["com.affine.payment.resume"](): string;
    /**
      * `Resume auto-renewal`
      */
    ["com.affine.payment.resume-renewal"](): string;
    /**
      * `Your team workspace subscription has been enabled successfully. Changes will take effect immediately.`
      */
    ["com.affine.payment.resume.success.team.message"](): string;
    /**
      * `Subscription Resumed`
      */
    ["com.affine.payment.resume.success.title"](): string;
    /**
      * `See all plans`
      */
    ["com.affine.payment.see-all-plans"](): string;
    /**
      * `Sign up free`
      */
    ["com.affine.payment.sign-up-free"](): string;
    /**
      * `Start 14-day free trial`
      */
    ["com.affine.payment.start-free-trial"](): string;
    /**
      * `Cloud storage is insufficient. Please contact the owner of that workspace.`
      */
    ["com.affine.payment.storage-limit.description.member"](): string;
    /**
      * `Cloud storage is insufficient. You can upgrade your account to unlock more cloud storage.`
      */
    ["com.affine.payment.storage-limit.description.owner"](): string;
    /**
      * `Unable to sync due to insufficient storage space. You can remove excess content, upgrade your account, or increase your workspace storage to resolve this issue.`
      */
    ["com.affine.payment.storage-limit.new-description.owner"](): string;
    /**
      * `Sync failed due to storage space limit`
      */
    ["com.affine.payment.storage-limit.new-title"](): string;
    /**
      * `View`
      */
    ["com.affine.payment.storage-limit.view"](): string;
    /**
      * `Active`
      */
    ["com.affine.payment.subscription-status.active"](): string;
    /**
      * `Past-due bill`
      */
    ["com.affine.payment.subscription-status.past-due"](): string;
    /**
      * `Trialing`
      */
    ["com.affine.payment.subscription-status.trialing"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.payment.subscription.button"](): string;
    /**
      * `The universal editor that lets you work, play, present or create just about anything.`
      */
    ["com.affine.payment.subscription.description"](): string;
    /**
      * `Unlock more features`
      */
    ["com.affine.payment.subscription.title"](): string;
    /**
      * `You are currently on the {{plan}} plan. After the current billing period ends, your account will automatically switch to the Free plan.`
      */
    ["com.affine.payment.subtitle-canceled"](options: {
        readonly plan: string;
    }): string;
    /**
      * `This is the pricing plans of Manut Cloud. You can sign up or sign in to your account first.`
      */
    ["com.affine.payment.subtitle-not-signed-in"](): string;
    /**
      * `This workspace has exceeded both storage and member limits, causing synchronization to pause. Please contact your workspace owner to address these limits and resume syncing.`
      */
    ["com.affine.payment.sync-paused.member.both.description"](): string;
    /**
      * `Got It`
      */
    ["com.affine.payment.sync-paused.member.member.confirm"](): string;
    /**
      * `This workspace has reached its maximum member capacity and synchronization has been paused. Please contact your workspace owner to either adjust team membership or upgrade the plan to resume syncing.`
      */
    ["com.affine.payment.sync-paused.member.member.description"](): string;
    /**
      * `This workspace has exceeded its storage limit and synchronization has been paused. Please contact your workspace owner to either reduce storage usage or upgrade the plan to resume syncing.`
      */
    ["com.affine.payment.sync-paused.member.storage.description"](): string;
    /**
      * `Your workspace has exceeded both storage and member limits, causing synchronization to pause. To resume syncing, please either:`
      */
    ["com.affine.payment.sync-paused.owner.both.description"](): string;
    /**
      * `Reduce storage usage and remove some team members`
      */
    ["com.affine.payment.sync-paused.owner.both.tips-1"](): string;
    /**
      * `Upgrade your plan for increased capacity`
      */
    ["com.affine.payment.sync-paused.owner.both.tips-2"](): string;
    /**
      * `Your workspace has reached its maximum member capacity and synchronization has been paused. To resume syncing, you can either`
      */
    ["com.affine.payment.sync-paused.owner.member.description"](): string;
    /**
      * `Remove some team members from the workspace`
      */
    ["com.affine.payment.sync-paused.owner.member.tips-1"](): string;
    /**
      * `Upgrade your plan to accommodate more members`
      */
    ["com.affine.payment.sync-paused.owner.member.tips-2"](): string;
    /**
      * `Your workspace has exceeded its storage limit and synchronization has been paused. To resume syncing, please either:`
      */
    ["com.affine.payment.sync-paused.owner.storage.description"](): string;
    /**
      * `Remove unnecessary files or content to reduce storage usage`
      */
    ["com.affine.payment.sync-paused.owner.storage.tips-1"](): string;
    /**
      * `Upgrade your plan for increased storage capacity`
      */
    ["com.affine.payment.sync-paused.owner.storage.tips-2"](): string;
    /**
      * `Workspace sync paused`
      */
    ["com.affine.payment.sync-paused.title"](): string;
    /**
      * `See all plans`
      */
    ["com.affine.payment.tag-tooltips"](): string;
    /**
      * `Tell us your use case`
      */
    ["com.affine.payment.tell-us-use-case"](): string;
    /**
      * `Pricing plans`
      */
    ["com.affine.payment.title"](): string;
    /**
      * `You have changed your plan to {{plan}} billing.`
      */
    ["com.affine.payment.updated-notify-msg"](options: {
        readonly plan: string;
    }): string;
    /**
      * `Subscription updated`
      */
    ["com.affine.payment.updated-notify-title"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.payment.upgrade"](): string;
    /**
      * `We'd like to hear more about your use case, so that we can make Manut better.`
      */
    ["com.affine.payment.upgrade-success-notify.content"](): string;
    /**
      * `Later`
      */
    ["com.affine.payment.upgrade-success-notify.later"](): string;
    /**
      * `Sure, open in browser`
      */
    ["com.affine.payment.upgrade-success-notify.ok-client"](): string;
    /**
      * `Sure, open in new tab`
      */
    ["com.affine.payment.upgrade-success-notify.ok-web"](): string;
    /**
      * `Thanks for subscribing!`
      */
    ["com.affine.payment.upgrade-success-notify.title"](): string;
    /**
      * `Congratulations! Your workspace has been successfully upgraded to a Team Workspace. Now you can invite unlimited members to collaborate in this workspace.`
      */
    ["com.affine.payment.upgrade-success-page.team.text-1"](): string;
    /**
      * `Congratulations! Your Manut account has been successfully upgraded to a Pro account.`
      */
    ["com.affine.payment.upgrade-success-page.text"](): string;
    /**
      * `Upgrade successful!`
      */
    ["com.affine.payment.upgrade-success-page.title"](): string;
    /**
      * `Failed to render page.`
      */
    ["com.affine.pdf.page.render.error"](): string;
    /**
      * `Close`
      */
    ["com.affine.peek-view-controls.close"](): string;
    /**
      * `Copy link`
      */
    ["com.affine.peek-view-controls.copy-link"](): string;
    /**
      * `Open this attachment`
      */
    ["com.affine.peek-view-controls.open-attachment"](): string;
    /**
      * `Open in new tab`
      */
    ["com.affine.peek-view-controls.open-attachment-in-new-tab"](): string;
    /**
      * `Open in split view`
      */
    ["com.affine.peek-view-controls.open-attachment-in-split-view"](): string;
    /**
      * `Open this doc`
      */
    ["com.affine.peek-view-controls.open-doc"](): string;
    /**
      * `Open in center peek`
      */
    ["com.affine.peek-view-controls.open-doc-in-center-peek"](): string;
    /**
      * `Open in edgeless`
      */
    ["com.affine.peek-view-controls.open-doc-in-edgeless"](): string;
    /**
      * `Open in new tab`
      */
    ["com.affine.peek-view-controls.open-doc-in-new-tab"](): string;
    /**
      * `Open in split view`
      */
    ["com.affine.peek-view-controls.open-doc-in-split-view"](): string;
    /**
      * `Open doc info`
      */
    ["com.affine.peek-view-controls.open-info"](): string;
    /**
      * `e.g. Always respond in Thai. I run a fintech startup in Bangkok and prefer concise, action-oriented answers.`
      */
    ["com.affine.personalize.placeholder"](): string;
    /**
      * `Custom instructions`
      */
    ["com.affine.personalize.section.title"](): string;
    /**
      * `Couldn't save — try again`
      */
    ["com.affine.personalize.status.error"](): string;
    /**
      * `Saved`
      */
    ["com.affine.personalize.status.saved"](): string;
    /**
      * `Saving…`
      */
    ["com.affine.personalize.status.saving"](): string;
    /**
      * `Customize how Manut AI responds to you across this workspace.`
      */
    ["com.affine.personalize.subtitle"](): string;
    /**
      * `Personalize`
      */
    ["com.affine.personalize.title"](): string;
    /**
      * `Add more properties`
      */
    ["com.affine.propertySidebar.add-more.section"](): string;
    /**
      * `Properties`
      */
    ["com.affine.propertySidebar.property-list.section"](): string;
    /**
      * `New`
      */
    ["com.affine.quicksearch.group.creation"](): string;
    /**
      * `Search for "{{query}}"`
      */
    ["com.affine.quicksearch.group.searchfor"](options: {
        readonly query: string;
    }): string;
    /**
      * `Search for "{{query}}" (locally)`
      */
    ["com.affine.quicksearch.group.searchfor-locally"](options: {
        readonly query: string;
    }): string;
    /**
      * `Search locally`
      */
    ["com.affine.quicksearch.search-locally"](): string;
    /**
      * `Dismiss`
      */
    ["com.affine.recording.dismiss"](): string;
    /**
      * `Open file`
      */
    ["com.affine.recording.failed.button"](): string;
    /**
      * `Failed to save`
      */
    ["com.affine.recording.failed.prompt"](): string;
    /**
      * `Importing...`
      */
    ["com.affine.recording.importing.prompt"](): string;
    /**
      * `Audio activity`
      */
    ["com.affine.recording.new"](): string;
    /**
      * `{{appName}}'s audio`
      */
    ["com.affine.recording.recording"](options: {
        readonly appName: string;
    }): string;
    /**
      * `Audio recording`
      */
    ["com.affine.recording.recording.unnamed"](): string;
    /**
      * `Start`
      */
    ["com.affine.recording.start"](): string;
    /**
      * `Stop`
      */
    ["com.affine.recording.stop"](): string;
    /**
      * `Open app`
      */
    ["com.affine.recording.success.button"](): string;
    /**
      * `Finished`
      */
    ["com.affine.recording.success.prompt"](): string;
    /**
      * `Request to join`
      */
    ["com.affine.request-to-join-workspace.button"](): string;
    /**
      * `Reset sync`
      */
    ["com.affine.resetSyncStatus.button"](): string;
    /**
      * `This operation may fix some synchronization issues.`
      */
    ["com.affine.resetSyncStatus.description"](): string;
    /**
      * `New Collection`
      */
    ["com.affine.rootAppSidebar.collection.new"](): string;
    /**
      * `Collections`
      */
    ["com.affine.rootAppSidebar.collections"](): string;
    /**
      * `Only doc can be placed on here`
      */
    ["com.affine.rootAppSidebar.doc.link-doc-only"](): string;
    /**
      * `No linked docs`
      */
    ["com.affine.rootAppSidebar.docs.no-subdoc"](): string;
    /**
      * `Loading linked docs...`
      */
    ["com.affine.rootAppSidebar.docs.references-loading"](): string;
    /**
      * `New doc`
      */
    ["com.affine.rootAppSidebar.explorer.collection-add-tooltip"](): string;
    /**
      * `New collection`
      */
    ["com.affine.rootAppSidebar.explorer.collection-section-add-tooltip"](): string;
    /**
      * `New linked doc`
      */
    ["com.affine.rootAppSidebar.explorer.doc-add-tooltip"](): string;
    /**
      * `Copy`
      */
    ["com.affine.rootAppSidebar.explorer.drop-effect.copy"](): string;
    /**
      * `Link`
      */
    ["com.affine.rootAppSidebar.explorer.drop-effect.link"](): string;
    /**
      * `Move`
      */
    ["com.affine.rootAppSidebar.explorer.drop-effect.move"](): string;
    /**
      * `New doc`
      */
    ["com.affine.rootAppSidebar.explorer.fav-section-add-tooltip"](): string;
    /**
      * `New doc`
      */
    ["com.affine.rootAppSidebar.explorer.organize-add-tooltip"](): string;
    /**
      * `New folder`
      */
    ["com.affine.rootAppSidebar.explorer.organize-section-add-tooltip"](): string;
    /**
      * `New doc`
      */
    ["com.affine.rootAppSidebar.explorer.tag-add-tooltip"](): string;
    /**
      * `New tag`
      */
    ["com.affine.rootAppSidebar.explorer.tag-section-add-tooltip"](): string;
    /**
      * `Favorites`
      */
    ["com.affine.rootAppSidebar.favorites"](): string;
    /**
      * `No favorites`
      */
    ["com.affine.rootAppSidebar.favorites.empty"](): string;
    /**
      * `Migration data`
      */
    ["com.affine.rootAppSidebar.migration-data"](): string;
    /**
      * `Empty the old favorites`
      */
    ["com.affine.rootAppSidebar.migration-data.clean-all"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.rootAppSidebar.migration-data.clean-all.cancel"](): string;
    /**
      * `OK`
      */
    ["com.affine.rootAppSidebar.migration-data.clean-all.confirm"](): string;
    /**
      * `The old "Favorites" will be replaced`
      */
    ["com.affine.rootAppSidebar.migration-data.help"](): string;
    /**
      * `Empty the old favorites`
      */
    ["com.affine.rootAppSidebar.migration-data.help.clean-all"](): string;
    /**
      * `OK`
      */
    ["com.affine.rootAppSidebar.migration-data.help.confirm"](): string;
    /**
      * `Notifications`
      */
    ["com.affine.rootAppSidebar.notifications"](): string;
    /**
      * `Organize`
      */
    ["com.affine.rootAppSidebar.organize"](): string;
    /**
      * `Add Folder`
      */
    ["com.affine.rootAppSidebar.organize.add-folder"](): string;
    /**
      * `Add More`
      */
    ["com.affine.rootAppSidebar.organize.add-more"](): string;
    /**
      * `Delete`
      */
    ["com.affine.rootAppSidebar.organize.delete"](): string;
    /**
      * `Remove from folder`
      */
    ["com.affine.rootAppSidebar.organize.delete-from-folder"](): string;
    /**
      * `Delete the folder will not delete any docs, tags, or collections.`
      */
    ["com.affine.rootAppSidebar.organize.delete.notify-message"](): string;
    /**
      * `Delete {{name}}`
      */
    ["com.affine.rootAppSidebar.organize.delete.notify-title"](options: {
        readonly name: string;
    }): string;
    /**
      * `No folders`
      */
    ["com.affine.rootAppSidebar.organize.empty"](): string;
    /**
      * `Empty folder`
      */
    ["com.affine.rootAppSidebar.organize.empty-folder"](): string;
    /**
      * `Add pages`
      */
    ["com.affine.rootAppSidebar.organize.empty-folder.add-pages"](): string;
    /**
      * `New folder`
      */
    ["com.affine.rootAppSidebar.organize.empty.new-folders-button"](): string;
    /**
      * `Add to favorites`
      */
    ["com.affine.rootAppSidebar.organize.folder-add-favorite"](): string;
    /**
      * `Remove from favorites`
      */
    ["com.affine.rootAppSidebar.organize.folder-rm-favorite"](): string;
    /**
      * `Add Collections`
      */
    ["com.affine.rootAppSidebar.organize.folder.add-collections"](): string;
    /**
      * `Add docs`
      */
    ["com.affine.rootAppSidebar.organize.folder.add-docs"](): string;
    /**
      * `Add others`
      */
    ["com.affine.rootAppSidebar.organize.folder.add-others"](): string;
    /**
      * `Add tags`
      */
    ["com.affine.rootAppSidebar.organize.folder.add-tags"](): string;
    /**
      * `Create a subfolder`
      */
    ["com.affine.rootAppSidebar.organize.folder.create-subfolder"](): string;
    /**
      * `New doc`
      */
    ["com.affine.rootAppSidebar.organize.folder.new-doc"](): string;
    /**
      * `New folder`
      */
    ["com.affine.rootAppSidebar.organize.new-folders"](): string;
    /**
      * `Only folder can be placed on here`
      */
    ["com.affine.rootAppSidebar.organize.root-folder-only"](): string;
    /**
      * `Others`
      */
    ["com.affine.rootAppSidebar.others"](): string;
    /**
      * `Click to collapse`
      */
    ["com.affine.rootAppSidebar.resize-handle.tooltip.click"](): string;
    /**
      * `Drag to resize`
      */
    ["com.affine.rootAppSidebar.resize-handle.tooltip.drag"](): string;
    /**
      * `Only doc can be placed on here`
      */
    ["com.affine.rootAppSidebar.tag.doc-only"](): string;
    /**
      * `Tags`
      */
    ["com.affine.rootAppSidebar.tags"](): string;
    /**
      * `No tags`
      */
    ["com.affine.rootAppSidebar.tags.empty"](): string;
    /**
      * `New tag`
      */
    ["com.affine.rootAppSidebar.tags.empty.new-tag-button"](): string;
    /**
      * `New tag`
      */
    ["com.affine.rootAppSidebar.tags.new-tag"](): string;
    /**
      * `No docs`
      */
    ["com.affine.rootAppSidebar.tags.no-doc"](): string;
    /**
      * `Type here ...`
      */
    ["com.affine.search-tags.placeholder"](): string;
    /**
      * `Empty`
      */
    ["com.affine.selectPage.empty"](): string;
    /**
      * `Selected`
      */
    ["com.affine.selectPage.selected"](): string;
    /**
      * `Add include doc`
      */
    ["com.affine.selectPage.title"](): string;
    /**
      * `Search collections...`
      */
    ["com.affine.selector-collection.search.placeholder"](): string;
    /**
      * `Search tags...`
      */
    ["com.affine.selector-tag.search.placeholder"](): string;
    /**
      * `Request Sent successfully`
      */
    ["com.affine.sent-request-to-join-workspace.title"](): string;
    /**
      * `Delete Server`
      */
    ["com.affine.server.delete"](): string;
    /**
      * `Account settings`
      */
    ["com.affine.setting.account"](): string;
    /**
      * `Delete your account from {{server}}`
      */
    ["com.affine.setting.account.delete-from-server"](options: {
        readonly server: string;
    }): string;
    /**
      * `Delete`
      */
    ["com.affine.setting.account.delete.confirm-button"](): string;
    /**
      * `Delete your account?`
      */
    ["com.affine.setting.account.delete.confirm-title"](): string;
    /**
      * `Please type your email to confirm`
      */
    ["com.affine.setting.account.delete.input-placeholder"](): string;
    /**
      * `Once deleted, your account will no longer be accessible, and all data in your personal cloud space will be permanently deleted.`
      */
    ["com.affine.setting.account.delete.message"](): string;
    /**
      * `Your account and cloud data have been deleted.`
      */
    ["com.affine.setting.account.delete.success-description-1"](): string;
    /**
      * `Local data can be deleted by uninstalling app and clearing browser data.`
      */
    ["com.affine.setting.account.delete.success-description-2"](): string;
    /**
      * `Account deleted`
      */
    ["com.affine.setting.account.delete.success-title"](): string;
    /**
      * `You’re the owner of a team workspace. To delete your account, please delete the workspace or transfer ownership first.`
      */
    ["com.affine.setting.account.delete.team-warning-description"](): string;
    /**
      * `Cannot delete account`
      */
    ["com.affine.setting.account.delete.team-warning-title"](): string;
    /**
      * `Your personal information`
      */
    ["com.affine.setting.account.message"](): string;
    /**
      * `Links`
      */
    ["com.affine.setting.appearance.links"](): string;
    /**
      * `Open Manut links`
      */
    ["com.affine.setting.appearance.open-in-app"](): string;
    /**
      * `Ask me each time`
      */
    ["com.affine.setting.appearance.open-in-app.always-ask"](): string;
    /**
      * `You can choose to open the link in the desktop app or directly in the browser.`
      */
    ["com.affine.setting.appearance.open-in-app.hint"](): string;
    /**
      * `Open links in desktop app`
      */
    ["com.affine.setting.appearance.open-in-app.open-in-desktop-app"](): string;
    /**
      * `Open links in browser`
      */
    ["com.affine.setting.appearance.open-in-app.open-in-web"](): string;
    /**
      * `Open Manut links`
      */
    ["com.affine.setting.appearance.open-in-app.title"](): string;
    /**
      * `Notifications`
      */
    ["com.affine.setting.notifications"](): string;
    /**
      * `You will be notified through email when other members of the workspace comment on your docs.`
      */
    ["com.affine.setting.notifications.email.comments.subtitle"](): string;
    /**
      * `Comments`
      */
    ["com.affine.setting.notifications.email.comments.title"](): string;
    /**
      * `Invitation related messages will be sent through emails.`
      */
    ["com.affine.setting.notifications.email.invites.subtitle"](): string;
    /**
      * `Invites`
      */
    ["com.affine.setting.notifications.email.invites.title"](): string;
    /**
      * `You will be notified through email when other members of the workspace @ you.`
      */
    ["com.affine.setting.notifications.email.mention.subtitle"](): string;
    /**
      * `Mention`
      */
    ["com.affine.setting.notifications.email.mention.title"](): string;
    /**
      * `Email notifications`
      */
    ["com.affine.setting.notifications.email.title"](): string;
    /**
      * `Choose the types of updates you want to receive and where to get them.`
      */
    ["com.affine.setting.notifications.header.description"](): string;
    /**
      * `Notifications`
      */
    ["com.affine.setting.notifications.header.title"](): string;
    /**
      * `Sync with Manut Cloud`
      */
    ["com.affine.setting.sign.message"](): string;
    /**
      * `Securely sign out of your account.`
      */
    ["com.affine.setting.sign.out.message"](): string;
    /**
      * `General`
      */
    ["com.affine.settingSidebar.settings.general"](): string;
    /**
      * `Workspace`
      */
    ["com.affine.settingSidebar.settings.workspace"](): string;
    /**
      * `Settings`
      */
    ["com.affine.settingSidebar.title"](): string;
    /**
      * `Appearance`
      */
    ["com.affine.settings.appearance"](): string;
    /**
      * `Customise the appearance of the client.`
      */
    ["com.affine.settings.appearance.border-style-description"](): string;
    /**
      * `Customise your date style.`
      */
    ["com.affine.settings.appearance.date-format-description"](): string;
    /**
      * `Maximum display of content within a doc.`
      */
    ["com.affine.settings.appearance.full-width-description"](): string;
    /**
      * `Select the language for the interface.`
      */
    ["com.affine.settings.appearance.language-description"](): string;
    /**
      * `By default, the week starts on Sunday.`
      */
    ["com.affine.settings.appearance.start-week-description"](): string;
    /**
      * `Customise appearance of Windows Client.`
      */
    ["com.affine.settings.appearance.window-frame-description"](): string;
    /**
      * `If enabled, it will automatically check for new versions at regular intervals.`
      */
    ["com.affine.settings.auto-check-description"](): string;
    /**
      * `If enabled, new versions will be automatically downloaded to the current device.`
      */
    ["com.affine.settings.auto-download-description"](): string;
    /**
      * `Editor`
      */
    ["com.affine.settings.editorSettings"](): string;
    /**
      * `Ask me every time`
      */
    ["com.affine.settings.editorSettings.ask-me-every-time"](): string;
    /**
      * `Edgeless`
      */
    ["com.affine.settings.editorSettings.edgeless"](): string;
    /**
      * `Connector`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter"](): string;
    /**
      * `Border style`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.border-style"](): string;
    /**
      * `Border thickness`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.border-thickness"](): string;
    /**
      * `Color`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.color"](): string;
    /**
      * `Connector shape`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.connector-shape"](): string;
    /**
      * `Curve`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.connector-shape.curve"](): string;
    /**
      * `Elbowed`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.connector-shape.elbowed"](): string;
    /**
      * `Straight`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.connector-shape.straight"](): string;
    /**
      * `End endpoint`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.end-endpoint"](): string;
    /**
      * `Start endpoint`
      */
    ["com.affine.settings.editorSettings.edgeless.connecter.start-endpoint"](): string;
    /**
      * `Custom`
      */
    ["com.affine.settings.editorSettings.edgeless.custom"](): string;
    /**
      * `Frame`
      */
    ["com.affine.settings.editorSettings.edgeless.frame"](): string;
    /**
      * `Background`
      */
    ["com.affine.settings.editorSettings.edgeless.frame.background"](): string;
    /**
      * `Mind Map`
      */
    ["com.affine.settings.editorSettings.edgeless.mind-map"](): string;
    /**
      * `Layout`
      */
    ["com.affine.settings.editorSettings.edgeless.mind-map.layout"](): string;
    /**
      * `Left`
      */
    ["com.affine.settings.editorSettings.edgeless.mind-map.layout.left"](): string;
    /**
      * `Radial`
      */
    ["com.affine.settings.editorSettings.edgeless.mind-map.layout.radial"](): string;
    /**
      * `Right`
      */
    ["com.affine.settings.editorSettings.edgeless.mind-map.layout.right"](): string;
    /**
      * `Note`
      */
    ["com.affine.settings.editorSettings.edgeless.note"](): string;
    /**
      * `Background`
      */
    ["com.affine.settings.editorSettings.edgeless.note.background"](): string;
    /**
      * `Border style`
      */
    ["com.affine.settings.editorSettings.edgeless.note.border"](): string;
    /**
      * `Border thickness`
      */
    ["com.affine.settings.editorSettings.edgeless.note.border-thickness"](): string;
    /**
      * `Dash`
      */
    ["com.affine.settings.editorSettings.edgeless.note.border.dash"](): string;
    /**
      * `None`
      */
    ["com.affine.settings.editorSettings.edgeless.note.border.none"](): string;
    /**
      * `Solid`
      */
    ["com.affine.settings.editorSettings.edgeless.note.border.solid"](): string;
    /**
      * `Corners`
      */
    ["com.affine.settings.editorSettings.edgeless.note.corners"](): string;
    /**
      * `Shadow style`
      */
    ["com.affine.settings.editorSettings.edgeless.note.shadow"](): string;
    /**
      * `Pen`
      */
    ["com.affine.settings.editorSettings.edgeless.pen"](): string;
    /**
      * `Color`
      */
    ["com.affine.settings.editorSettings.edgeless.pen.color"](): string;
    /**
      * `Thickness`
      */
    ["com.affine.settings.editorSettings.edgeless.pen.thickness"](): string;
    /**
      * `Shape`
      */
    ["com.affine.settings.editorSettings.edgeless.shape"](): string;
    /**
      * `Border color`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.border-color"](): string;
    /**
      * `Border style`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.border-style"](): string;
    /**
      * `Border thickness`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.border-thickness"](): string;
    /**
      * `Diamond`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.diamond"](): string;
    /**
      * `Ellipse`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.ellipse"](): string;
    /**
      * `Fill color`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.fill-color"](): string;
    /**
      * `Flow`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.flow"](): string;
    /**
      * `Font`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.font"](): string;
    /**
      * `Font size`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.font-size"](): string;
    /**
      * `Font style`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.font-style"](): string;
    /**
      * `List`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.list"](): string;
    /**
      * `Rounded Rectangle`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.rounded-rectangle"](): string;
    /**
      * `Square`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.square"](): string;
    /**
      * `Text alignment`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.text-alignment"](): string;
    /**
      * `Text color`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.text-color"](): string;
    /**
      * `Triangle`
      */
    ["com.affine.settings.editorSettings.edgeless.shape.triangle"](): string;
    /**
      * `Style`
      */
    ["com.affine.settings.editorSettings.edgeless.style"](): string;
    /**
      * `General`
      */
    ["com.affine.settings.editorSettings.edgeless.style.general"](): string;
    /**
      * `Scribbled`
      */
    ["com.affine.settings.editorSettings.edgeless.style.scribbled"](): string;
    /**
      * `Text`
      */
    ["com.affine.settings.editorSettings.edgeless.text"](): string;
    /**
      * `Alignment`
      */
    ["com.affine.settings.editorSettings.edgeless.text.alignment"](): string;
    /**
      * `Center`
      */
    ["com.affine.settings.editorSettings.edgeless.text.alignment.center"](): string;
    /**
      * `Left`
      */
    ["com.affine.settings.editorSettings.edgeless.text.alignment.left"](): string;
    /**
      * `Right`
      */
    ["com.affine.settings.editorSettings.edgeless.text.alignment.right"](): string;
    /**
      * `Text color`
      */
    ["com.affine.settings.editorSettings.edgeless.text.color"](): string;
    /**
      * `Font`
      */
    ["com.affine.settings.editorSettings.edgeless.text.font"](): string;
    /**
      * `Font family`
      */
    ["com.affine.settings.editorSettings.edgeless.text.font-family"](): string;
    /**
      * `Font size`
      */
    ["com.affine.settings.editorSettings.edgeless.text.font-size"](): string;
    /**
      * `Font style`
      */
    ["com.affine.settings.editorSettings.edgeless.text.font-style"](): string;
    /**
      * `Font weight`
      */
    ["com.affine.settings.editorSettings.edgeless.text.font-weight"](): string;
    /**
      * `General`
      */
    ["com.affine.settings.editorSettings.general"](): string;
    /**
      * `Enable the powerful AI assistant, Manut AI.`
      */
    ["com.affine.settings.editorSettings.general.ai.description"](): string;
    /**
      * `Disable AI and Reload`
      */
    ["com.affine.settings.editorSettings.general.ai.disable.confirm"](): string;
    /**
      * `Are you sure you want to disable AI? We value your productivity and our AI can enhance it. Please think again!`
      */
    ["com.affine.settings.editorSettings.general.ai.disable.description"](): string;
    /**
      * `Disable AI?`
      */
    ["com.affine.settings.editorSettings.general.ai.disable.title"](): string;
    /**
      * `Enable AI and Reload`
      */
    ["com.affine.settings.editorSettings.general.ai.enable.confirm"](): string;
    /**
      * `Do you want to enable AI? Our AI assistant is ready to enhance your productivity and provide smart assistance. Let's get started! We need reload page to make this change.`
      */
    ["com.affine.settings.editorSettings.general.ai.enable.description"](): string;
    /**
      * `Enable AI?`
      */
    ["com.affine.settings.editorSettings.general.ai.enable.title"](): string;
    /**
      * `Manut AI`
      */
    ["com.affine.settings.editorSettings.general.ai.title"](): string;
    /**
      * `Automatically title blank new docs with today's date.`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.description"](): string;
    /**
      * `DD-MM-YYYY`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.format.dd-mm-yyyy"](): string;
    /**
      * `Choose the date format used for automatic new doc titles.`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.format.description"](): string;
    /**
      * `Journal style (localized)`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.format.journal"](): string;
    /**
      * `MM-DD-YYYY`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.format.mm-dd-yyyy"](): string;
    /**
      * `New doc date format`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.format.title"](): string;
    /**
      * `YYYY-MM-DD`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.format.yyyy-mm-dd"](): string;
    /**
      * `Auto-title new docs with current date`
      */
    ["com.affine.settings.editorSettings.general.auto-date-title.title"](): string;
    /**
      * `Set a default programming language.`
      */
    ["com.affine.settings.editorSettings.general.default-code-block.language.description"](): string;
    /**
      * `Code blocks default language`
      */
    ["com.affine.settings.editorSettings.general.default-code-block.language.title"](): string;
    /**
      * `Encapsulate code snippets for better readability.`
      */
    ["com.affine.settings.editorSettings.general.default-code-block.wrap.description"](): string;
    /**
      * `Wrap code in code blocks`
      */
    ["com.affine.settings.editorSettings.general.default-code-block.wrap.title"](): string;
    /**
      * `Default mode for new doc.`
      */
    ["com.affine.settings.editorSettings.general.default-new-doc.description"](): string;
    /**
      * `New doc default mode`
      */
    ["com.affine.settings.editorSettings.general.default-new-doc.title"](): string;
    /**
      * `Customize your text experience.`
      */
    ["com.affine.settings.editorSettings.general.font-family.custom.description"](): string;
    /**
      * `Custom font family`
      */
    ["com.affine.settings.editorSettings.general.font-family.custom.title"](): string;
    /**
      * `Choose your editor's font family.`
      */
    ["com.affine.settings.editorSettings.general.font-family.description"](): string;
    /**
      * `Font family`
      */
    ["com.affine.settings.editorSettings.general.font-family.title"](): string;
    /**
      * `Adjust the base font size for better readability.`
      */
    ["com.affine.settings.editorSettings.general.font-size.description"](): string;
    /**
      * `Font size`
      */
    ["com.affine.settings.editorSettings.general.font-size.title"](): string;
    /**
      * `Enable default middle click paste behavior on Linux.`
      */
    ["com.affine.settings.editorSettings.general.middle-click-paste.description"](): string;
    /**
      * `Middle click paste`
      */
    ["com.affine.settings.editorSettings.general.middle-click-paste.title"](): string;
    /**
      * `Automatically detect and correct spelling errors.`
      */
    ["com.affine.settings.editorSettings.general.spell-check.description"](): string;
    /**
      * `Spell check`
      */
    ["com.affine.settings.editorSettings.general.spell-check.title"](): string;
    /**
      * `Page`
      */
    ["com.affine.settings.editorSettings.page"](): string;
    /**
      * `Set default width for new pages, individual pages can override.`
      */
    ["com.affine.settings.editorSettings.page.default-page-width.description"](): string;
    /**
      * `Full width`
      */
    ["com.affine.settings.editorSettings.page.default-page-width.full-width"](): string;
    /**
      * `Standard`
      */
    ["com.affine.settings.editorSettings.page.default-page-width.standard"](): string;
    /**
      * `Default page width`
      */
    ["com.affine.settings.editorSettings.page.default-page-width.title"](): string;
    /**
      * `Display bi-directional links on the doc.`
      */
    ["com.affine.settings.editorSettings.page.display-bi-link.description"](): string;
    /**
      * `Display bi-directional links`
      */
    ["com.affine.settings.editorSettings.page.display-bi-link.title"](): string;
    /**
      * `Display document information on the doc.`
      */
    ["com.affine.settings.editorSettings.page.display-doc-info.description"](): string;
    /**
      * `Display doc info`
      */
    ["com.affine.settings.editorSettings.page.display-doc-info.title"](): string;
    /**
      * `Set edgeless default color scheme.`
      */
    ["com.affine.settings.editorSettings.page.edgeless-default-theme.description"](): string;
    /**
      * `Specified by current color mode`
      */
    ["com.affine.settings.editorSettings.page.edgeless-default-theme.specified"](): string;
    /**
      * `Edgeless default theme`
      */
    ["com.affine.settings.editorSettings.page.edgeless-default-theme.title"](): string;
    /**
      * `Use the scroll wheel to zoom in and out.`
      */
    ["com.affine.settings.editorSettings.page.edgeless-scroll-wheel-zoom.description"](): string;
    /**
      * `Scroll wheel zoom`
      */
    ["com.affine.settings.editorSettings.page.edgeless-scroll-wheel-zoom.title"](): string;
    /**
      * `Maximise display of content within a page.`
      */
    ["com.affine.settings.editorSettings.page.full-width.description"](): string;
    /**
      * `Full width layout`
      */
    ["com.affine.settings.editorSettings.page.full-width.title"](): string;
    /**
      * `Preferences`
      */
    ["com.affine.settings.editorSettings.preferences"](): string;
    /**
      * `You can export the entire preferences data for backup, and the exported data can be re-imported.`
      */
    ["com.affine.settings.editorSettings.preferences.export.description"](): string;
    /**
      * `Export Settings`
      */
    ["com.affine.settings.editorSettings.preferences.export.title"](): string;
    /**
      * `You can import previously exported preferences data for restoration.`
      */
    ["com.affine.settings.editorSettings.preferences.import.description"](): string;
    /**
      * `Import Settings`
      */
    ["com.affine.settings.editorSettings.preferences.import.title"](): string;
    /**
      * `Configure your own editor`
      */
    ["com.affine.settings.editorSettings.subtitle"](): string;
    /**
      * `Editor settings`
      */
    ["com.affine.settings.editorSettings.title"](): string;
    /**
      * `Email`
      */
    ["com.affine.settings.email"](): string;
    /**
      * `Change email`
      */
    ["com.affine.settings.email.action"](): string;
    /**
      * `Change email`
      */
    ["com.affine.settings.email.action.change"](): string;
    /**
      * `Verify email`
      */
    ["com.affine.settings.email.action.verify"](): string;
    /**
      * `Meetings`
      */
    ["com.affine.settings.meetings"](): string;
    /**
      * `Enable meeting notes`
      */
    ["com.affine.settings.meetings.enable.title"](): string;
    /**
      * `Privacy & Security`
      */
    ["com.affine.settings.meetings.privacy.header"](): string;
    /**
      * `Permission issues`
      */
    ["com.affine.settings.meetings.privacy.issues"](): string;
    /**
      * `Permissions are granted but the status isn't updated? Restart the app to refresh permissions.`
      */
    ["com.affine.settings.meetings.privacy.issues.description"](): string;
    /**
      * `Restart App`
      */
    ["com.affine.settings.meetings.privacy.issues.restart"](): string;
    /**
      * `Microphone`
      */
    ["com.affine.settings.meetings.privacy.microphone"](): string;
    /**
      * `The Meeting feature requires permission to be used.`
      */
    ["com.affine.settings.meetings.privacy.microphone.description"](): string;
    /**
      * `Click to allow`
      */
    ["com.affine.settings.meetings.privacy.microphone.permission-setting"](): string;
    /**
      * `Screen & System audio recording`
      */
    ["com.affine.settings.meetings.privacy.screen-system-audio-recording"](): string;
    /**
      * `The Meeting feature requires permission to be used.`
      */
    ["com.affine.settings.meetings.privacy.screen-system-audio-recording.description"](): string;
    /**
      * `Click to allow`
      */
    ["com.affine.settings.meetings.privacy.screen-system-audio-recording.permission-setting"](): string;
    /**
      * `Meeting recording`
      */
    ["com.affine.settings.meetings.record.header"](): string;
    /**
      * `Open saved recordings`
      */
    ["com.affine.settings.meetings.record.open-saved-file"](): string;
    /**
      * `Open the locally stored recording files.`
      */
    ["com.affine.settings.meetings.record.open-saved-file.description"](): string;
    /**
      * `Manut will generate meeting notes by recording your meetings. Authorization to "Screen & System Audio Recording" is necessary.`
      */
    ["com.affine.settings.meetings.record.permission-modal.description"](): string;
    /**
      * `Open System Settings`
      */
    ["com.affine.settings.meetings.record.permission-modal.open-setting"](): string;
    /**
      * `Screen & System Audio Recording`
      */
    ["com.affine.settings.meetings.record.permission-modal.title"](): string;
    /**
      * `When meeting starts`
      */
    ["com.affine.settings.meetings.record.recording-mode"](): string;
    /**
      * `Auto start recording`
      */
    ["com.affine.settings.meetings.record.recording-mode.auto-start"](): string;
    /**
      * `Choose the behavior when the meeting starts.`
      */
    ["com.affine.settings.meetings.record.recording-mode.description"](): string;
    /**
      * `Do nothing`
      */
    ["com.affine.settings.meetings.record.recording-mode.none"](): string;
    /**
      * `Show a recording prompt`
      */
    ["com.affine.settings.meetings.record.recording-mode.prompt"](): string;
    /**
      * `Save meeting's recording block to`
      */
    ["com.affine.settings.meetings.record.save-mode"](): string;
    /**
      * `Native Audio Capture, No Bots Required - Direct from Your Mac to Meeting Intelligence.`
      */
    ["com.affine.settings.meetings.setting.prompt"](): string;
    /**
      * `Beyond Recording
    Your AI Meeting Assistant is Here`
      */
    ["com.affine.settings.meetings.setting.welcome"](): string;
    /**
      * `Learn more`
      */
    ["com.affine.settings.meetings.setting.welcome.learn-more"](): string;
    /**
      * `AI auto summary`
      */
    ["com.affine.settings.meetings.transcription.auto-summary"](): string;
    /**
      * `Automatically generate a summary of the meeting notes.`
      */
    ["com.affine.settings.meetings.transcription.auto-summary.description"](): string;
    /**
      * `AI auto todo list`
      */
    ["com.affine.settings.meetings.transcription.auto-todo"](): string;
    /**
      * `Automatically generate a todo list of the meeting notes.`
      */
    ["com.affine.settings.meetings.transcription.auto-todo.description"](): string;
    /**
      * `Transcription with AI`
      */
    ["com.affine.settings.meetings.transcription.header"](): string;
    /**
      * `Enable Manut Cloud to collaborate with others`
      */
    ["com.affine.settings.member-tooltip"](): string;
    /**
      * `Loading member list...`
      */
    ["com.affine.settings.member.loading"](): string;
    /**
      * `Noise background on the sidebar`
      */
    ["com.affine.settings.noise-style"](): string;
    /**
      * `Use background noise effect on the sidebar.`
      */
    ["com.affine.settings.noise-style-description"](): string;
    /**
      * `Password`
      */
    ["com.affine.settings.password"](): string;
    /**
      * `Change password`
      */
    ["com.affine.settings.password.action.change"](): string;
    /**
      * `Set password`
      */
    ["com.affine.settings.password.action.set"](): string;
    /**
      * `Set a password to sign in to your account`
      */
    ["com.affine.settings.password.message"](): string;
    /**
      * `My profile`
      */
    ["com.affine.settings.profile"](): string;
    /**
      * `Your account profile will be displayed to everyone.`
      */
    ["com.affine.settings.profile.message"](): string;
    /**
      * `Display name`
      */
    ["com.affine.settings.profile.name"](): string;
    /**
      * `Input account name`
      */
    ["com.affine.settings.profile.placeholder"](): string;
    /**
      * `Remove workspace`
      */
    ["com.affine.settings.remove-workspace"](): string;
    /**
      * `Remove workspace from this device and optionally delete all data.`
      */
    ["com.affine.settings.remove-workspace-description"](): string;
    /**
      * `Sign in / Sign up`
      */
    ["com.affine.settings.sign"](): string;
    /**
      * `Need more customization options? Tell us in the community.`
      */
    ["com.affine.settings.suggestion"](): string;
    /**
      * `Translucent UI on the sidebar`
      */
    ["com.affine.settings.translucent-style"](): string;
    /**
      * `Use transparency effect on the sidebar.`
      */
    ["com.affine.settings.translucent-style-description"](): string;
    /**
      * `Workspace`
      */
    ["com.affine.settings.workspace"](): string;
    /**
      * `Allow workspace members to use Manut AI features. This setting doesn't affect billing. Workspace members use Manut AI through their personal accounts.`
      */
    ["com.affine.settings.workspace.affine-ai.description"](): string;
    /**
      * `Allow Manut AI Assistant`
      */
    ["com.affine.settings.workspace.affine-ai.label"](): string;
    /**
      * `Manut AI`
      */
    ["com.affine.settings.workspace.affine-ai.title"](): string;
    /**
      * `Archived workspaces`
      */
    ["com.affine.settings.workspace.backup"](): string;
    /**
      * `Delete archived workspace`
      */
    ["com.affine.settings.workspace.backup.delete"](): string;
    /**
      * `Deleted on {{date}} at {{time}}`
      */
    ["com.affine.settings.workspace.backup.delete-at"](options: Readonly<{
        date: string;
        time: string;
    }>): string;
    /**
      * `Workspace backup deleted successfully`
      */
    ["com.affine.settings.workspace.backup.delete.success"](): string;
    /**
      * `Are you sure you want to delete this workspace. This action cannot be undone. Make sure you no longer need them before proceeding.`
      */
    ["com.affine.settings.workspace.backup.delete.warning"](): string;
    /**
      * `No archived workspace files found`
      */
    ["com.affine.settings.workspace.backup.empty"](): string;
    /**
      * `Enable local workspace`
      */
    ["com.affine.settings.workspace.backup.import"](): string;
    /**
      * `Workspace enabled successfully`
      */
    ["com.affine.settings.workspace.backup.import.success"](): string;
    /**
      * `Open`
      */
    ["com.affine.settings.workspace.backup.import.success.action"](): string;
    /**
      * `Manage archived local workspace files`
      */
    ["com.affine.settings.workspace.backup.subtitle"](): string;
    /**
      * `Team's Billing`
      */
    ["com.affine.settings.workspace.billing"](): string;
    /**
      * `Team Workspace`
      */
    ["com.affine.settings.workspace.billing.team-workspace"](): string;
    /**
      * `Cancel Plan`
      */
    ["com.affine.settings.workspace.billing.team-workspace.cancel-plan"](): string;
    /**
      * `Your workspace is billed annually.`
      */
    ["com.affine.settings.workspace.billing.team-workspace.description.billed.annually"](): string;
    /**
      * `Your workspace is billed monthly.`
      */
    ["com.affine.settings.workspace.billing.team-workspace.description.billed.monthly"](): string;
    /**
      * `Your workspace is in a free trail period.`
      */
    ["com.affine.settings.workspace.billing.team-workspace.description.free-trail"](): string;
    /**
      * `Next billing date: {{date}}`
      */
    ["com.affine.settings.workspace.billing.team-workspace.next-billing-date"](options: {
        readonly date: string;
    }): string;
    /**
      * `Your subscription will end on {{date}}`
      */
    ["com.affine.settings.workspace.billing.team-workspace.not-renewed"](options: {
        readonly date: string;
    }): string;
    /**
      * `You can view current workspace's information here.`
      */
    ["com.affine.settings.workspace.description"](): string;
    /**
      * `Experimental features`
      */
    ["com.affine.settings.workspace.experimental-features"](): string;
    /**
      * `Once enabled, you can preview adapter export content in the right side bar.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-adapter-panel.description"](): string;
    /**
      * `Adapter Panel`
      */
    ["com.affine.settings.workspace.experimental-features.enable-adapter-panel.name"](): string;
    /**
      * `To provide detailed control over which edgeless blocks are visible in page mode.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-advanced-block-visibility.description"](): string;
    /**
      * `Advanced block visibility control`
      */
    ["com.affine.settings.workspace.experimental-features.enable-advanced-block-visibility.name"](): string;
    /**
      * `Enables AI chat blocks.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-chat-block.description"](): string;
    /**
      * `AI Chat Block`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-chat-block.name"](): string;
    /**
      * `Enable or disable AI model switch feature.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-model-switch.description"](): string;
    /**
      * `Enable AI Model Switch`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-model-switch.name"](): string;
    /**
      * `Enable or disable AI Network Search feature.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-network-search.description"](): string;
    /**
      * `Enable AI Network Search`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-network-search.name"](): string;
    /**
      * `Enables AI onboarding.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-onboarding.description"](): string;
    /**
      * `AI Onboarding`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-onboarding.name"](): string;
    /**
      * `Enable or disable AI playground feature.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-playground.description"](): string;
    /**
      * `Enable AI Playground`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-playground.name"](): string;
    /**
      * `When toggled off, every time you choose "Continue with AI", AI only got a screenshot.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-send-detailed-object.description"](): string;
    /**
      * `Send detailed object information to AI`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai-send-detailed-object.name"](): string;
    /**
      * `Enable or disable ALL AI features.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai.description"](): string;
    /**
      * `Enable AI`
      */
    ["com.affine.settings.workspace.experimental-features.enable-ai.name"](): string;
    /**
      * `Audio block allows you to play audio files globally and add notes to them.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-audio-block.description"](): string;
    /**
      * `Audio block`
      */
    ["com.affine.settings.workspace.experimental-features.enable-audio-block.name"](): string;
    /**
      * `Once enabled, all blocks will have created time, updated time, created by and updated by.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-block-meta.description"](): string;
    /**
      * `Block Meta`
      */
    ["com.affine.settings.workspace.experimental-features.enable-block-meta.name"](): string;
    /**
      * `Enables querying of todo blocks.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-block-query.description"](): string;
    /**
      * `Todo Block Query`
      */
    ["com.affine.settings.workspace.experimental-features.enable-block-query.name"](): string;
    /**
      * `Let your words stand out. This also include the callout in the transcription block.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-callout.description"](): string;
    /**
      * `Callout`
      */
    ["com.affine.settings.workspace.experimental-features.enable-callout.name"](): string;
    /**
      * `Once enabled, you can preview HTML in code block.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-code-block-html-preview.description"](): string;
    /**
      * `Code block HTML preview`
      */
    ["com.affine.settings.workspace.experimental-features.enable-code-block-html-preview.name"](): string;
    /**
      * `Enables color picker blocks.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-color-picker.description"](): string;
    /**
      * `Color Picker`
      */
    ["com.affine.settings.workspace.experimental-features.enable-color-picker.name"](): string;
    /**
      * `Allows adding notes to database attachments.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-database-attachment-note.description"](): string;
    /**
      * `Database Attachment Note`
      */
    ["com.affine.settings.workspace.experimental-features.enable-database-attachment-note.name"](): string;
    /**
      * `The database will be displayed in full-width mode.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-database-full-width.description"](): string;
    /**
      * `Database Full Width`
      */
    ["com.affine.settings.workspace.experimental-features.enable-database-full-width.name"](): string;
    /**
      * `Once enabled, you can use scribbled style in edgeless mode.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-edgeless-scribbled-style.description"](): string;
    /**
      * `Edgeless scribbled style`
      */
    ["com.affine.settings.workspace.experimental-features.enable-edgeless-scribbled-style.name"](): string;
    /**
      * `Enables edgeless text blocks.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-edgeless-text.description"](): string;
    /**
      * `Edgeless Text`
      */
    ["com.affine.settings.workspace.experimental-features.enable-edgeless-text.name"](): string;
    /**
      * `Once enabled, the editor will be displayed in RTL mode.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-editor-rtl.description"](): string;
    /**
      * `Editor RTL`
      */
    ["com.affine.settings.workspace.experimental-features.enable-editor-rtl.name"](): string;
    /**
      * `Enables editor settings.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-editor-settings.description"](): string;
    /**
      * `Editor Settings`
      */
    ["com.affine.settings.workspace.experimental-features.enable-editor-settings.name"](): string;
    /**
      * `Enables Embed Iframe Block.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-embed-iframe-block.description"](): string;
    /**
      * `Embed Iframe Block`
      */
    ["com.affine.settings.workspace.experimental-features.enable-embed-iframe-block.name"](): string;
    /**
      * `Once enabled, you can use an emoji as the doc icon. When the first character of the doc name is an emoji, it will be extracted and used as its icon.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-emoji-doc-icon.description"](): string;
    /**
      * `Emoji Doc Icon`
      */
    ["com.affine.settings.workspace.experimental-features.enable-emoji-doc-icon.name"](): string;
    /**
      * `Once enabled, you can use an emoji as the folder icon. When the first character of the folder name is an emoji, it will be extracted and used as its icon.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-emoji-folder-icon.description"](): string;
    /**
      * `Emoji Folder Icon`
      */
    ["com.affine.settings.workspace.experimental-features.enable-emoji-folder-icon.name"](): string;
    /**
      * `Allow create local workspace`
      */
    ["com.affine.settings.workspace.experimental-features.enable-local-workspace.description"](): string;
    /**
      * `Allow create local workspace`
      */
    ["com.affine.settings.workspace.experimental-features.enable-local-workspace.name"](): string;
    /**
      * `Meetings allows you to record and transcribe meetings. Don't forget to enable it in Manut settings.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-meetings.description"](): string;
    /**
      * `Meetings`
      */
    ["com.affine.settings.workspace.experimental-features.enable-meetings.name"](): string;
    /**
      * `Enables mind map import.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mind-map-import.description"](): string;
    /**
      * `Mind Map Import`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mind-map-import.name"](): string;
    /**
      * `Once enabled, users can edit edgeless canvas.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mobile-edgeless-editing.description"](): string;
    /**
      * `Enable Edgeless Editing`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mobile-edgeless-editing.name"](): string;
    /**
      * `Enables the mobile keyboard toolbar.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mobile-keyboard-toolbar.description"](): string;
    /**
      * `Mobile Keyboard Toolbar`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mobile-keyboard-toolbar.name"](): string;
    /**
      * `Enables the mobile linked doc menu.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mobile-linked-doc-menu.description"](): string;
    /**
      * `Mobile Linked Doc Widget`
      */
    ["com.affine.settings.workspace.experimental-features.enable-mobile-linked-doc-menu.name"](): string;
    /**
      * `Once enabled, you can preview PDF in embed view.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-pdf-embed-preview.description"](): string;
    /**
      * `PDF embed preview`
      */
    ["com.affine.settings.workspace.experimental-features.enable-pdf-embed-preview.name"](): string;
    /**
      * `Once enabled, users can import and export blocksuite snapshots.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-snapshot-import-export.description"](): string;
    /**
      * `Enable Snapshot Import Export`
      */
    ["com.affine.settings.workspace.experimental-features.enable-snapshot-import-export.name"](): string;
    /**
      * `Enables syncing of doc blocks.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-synced-doc-block.description"](): string;
    /**
      * `Synced Doc Block`
      */
    ["com.affine.settings.workspace.experimental-features.enable-synced-doc-block.name"](): string;
    /**
      * `Once enabled, switch table view to virtual scroll mode in Database Block.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-table-virtual-scroll.description"](): string;
    /**
      * `Database block table view virtual scroll`
      */
    ["com.affine.settings.workspace.experimental-features.enable-table-virtual-scroll.name"](): string;
    /**
      * `Enables theme editor.`
      */
    ["com.affine.settings.workspace.experimental-features.enable-theme-editor.description"](): string;
    /**
      * `Theme Editor`
      */
    ["com.affine.settings.workspace.experimental-features.enable-theme-editor.name"](): string;
    /**
      * `Get started`
      */
    ["com.affine.settings.workspace.experimental-features.get-started"](): string;
    /**
      * `Experimental features`
      */
    ["com.affine.settings.workspace.experimental-features.header.plugins"](): string;
    /**
      * `Some features available for early access`
      */
    ["com.affine.settings.workspace.experimental-features.header.subtitle"](): string;
    /**
      * `I am aware of the risks, and I am willing to continue to use it.`
      */
    ["com.affine.settings.workspace.experimental-features.prompt-disclaimer"](): string;
    /**
      * `Do you want to use the plugin system that is in an experimental stage?`
      */
    ["com.affine.settings.workspace.experimental-features.prompt-header"](): string;
    /**
      * `You are about to enable an experimental feature. This feature is still in development and may contain errors or behave unpredictably. Please proceed with caution and at your own risk.`
      */
    ["com.affine.settings.workspace.experimental-features.prompt-warning"](): string;
    /**
      * `WARNING MESSAGE`
      */
    ["com.affine.settings.workspace.experimental-features.prompt-warning-title"](): string;
    /**
      * `Manage Manut indexing and Manut AI Embedding for local content processing`
      */
    ["com.affine.settings.workspace.indexer-embedding.description"](): string;
    /**
      * `The uploaded file will be embedded in the current workspace.`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.additional-attachments.description"](): string;
    /**
      * `Attachment will be removed. AI will not continue to extract content from this attachment.`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.additional-attachments.remove-attachment.description"](): string;
    /**
      * `Remove the attachment from embedding?`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.additional-attachments.remove-attachment.title"](): string;
    /**
      * `Delete File`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.additional-attachments.remove-attachment.tooltip"](): string;
    /**
      * `Additional attachments`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.additional-attachments.title"](): string;
    /**
      * `Embedding allows AI to retrieve your content. If the indexer uses local settings, it may affect some of the results of the Embedding.`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.description"](): string;
    /**
      * `Only the workspace owner can enable Workspace Embedding.`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.disabled-tooltip"](): string;
    /**
      * `The Ignored docs will not be embedded into the current workspace.`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.ignore-docs.description"](): string;
    /**
      * `Ignore Docs`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.ignore-docs.title"](): string;
    /**
      * `Loading sync status...`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.progress.loading-sync-status"](): string;
    /**
      * `Synced`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.progress.synced"](): string;
    /**
      * `Syncing`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.progress.syncing"](): string;
    /**
      * `Embedding progress`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.progress.title"](): string;
    /**
      * `Failed to remove attachment from embedding`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.remove-attachment.error"](): string;
    /**
      * `Select doc`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.select-doc"](): string;
    /**
      * `AI can call files embedded in the workspace.`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.switch.description"](): string;
    /**
      * `Failed to update workspace doc embedding enabled`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.switch.error"](): string;
    /**
      * `Workspace Embedding`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.switch.title"](): string;
    /**
      * `Embedding`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.title"](): string;
    /**
      * `Failed to update ignored docs`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.update-ignored-docs.error"](): string;
    /**
      * `Upload file`
      */
    ["com.affine.settings.workspace.indexer-embedding.embedding.upload-file"](): string;
    /**
      * `Indexer & Embedding`
      */
    ["com.affine.settings.workspace.indexer-embedding.title"](): string;
    /**
      * `License`
      */
    ["com.affine.settings.workspace.license"](): string;
    /**
      * `Activate License`
      */
    ["com.affine.settings.workspace.license.activate-modal.title"](): string;
    /**
      * `License activated successfully.`
      */
    ["com.affine.settings.workspace.license.activate-success"](): string;
    /**
      * `{{initialQuota}} initial storage + {{quotaPerSeat}} per seat`
      */
    ["com.affine.settings.workspace.license.benefit.team.g2"](options: Readonly<{
        initialQuota: string;
        quotaPerSeat: string;
    }>): string;
    /**
      * `{{quota}} of maximum file size`
      */
    ["com.affine.settings.workspace.license.benefit.team.g3"](options: {
        readonly quota: string;
    }): string;
    /**
      * `Unlimited team members (10+ seats)`
      */
    ["com.affine.settings.workspace.license.benefit.team.g4"](): string;
    /**
      * `Multiple admin roles`
      */
    ["com.affine.settings.workspace.license.benefit.team.g5"](): string;
    /**
      * `Priority customer support`
      */
    ["com.affine.settings.workspace.license.benefit.team.g6"](): string;
    /**
      * `Need more seats? Best for scalable teams.`
      */
    ["com.affine.settings.workspace.license.benefit.team.subtitle"](): string;
    /**
      * `Buy more seat`
      */
    ["com.affine.settings.workspace.license.buy-more-seat"](): string;
    /**
      * `After deactivation, you will need to upload a new license to continue using team feature`
      */
    ["com.affine.settings.workspace.license.deactivate-modal.description-license"](): string;
    /**
      * `Manage Payment`
      */
    ["com.affine.settings.workspace.license.deactivate-modal.manage-payment"](): string;
    /**
      * `Confirm deactivation?`
      */
    ["com.affine.settings.workspace.license.deactivate-modal.title"](): string;
    /**
      * `License deactivated successfully.`
      */
    ["com.affine.settings.workspace.license.deactivate-success"](): string;
    /**
      * `Lean more`
      */
    ["com.affine.settings.workspace.license.lean-more"](): string;
    /**
      * `Only an owner can edit the workspace avatar and name. Changes will be shown for everyone.`
      */
    ["com.affine.settings.workspace.not-owner"](): string;
    /**
      * `Preference`
      */
    ["com.affine.settings.workspace.preferences"](): string;
    /**
      * `Properties`
      */
    ["com.affine.settings.workspace.properties"](): string;
    /**
      * `Add property`
      */
    ["com.affine.settings.workspace.properties.add_property"](): string;
    /**
      * `All`
      */
    ["com.affine.settings.workspace.properties.all"](): string;
    /**
      * `Delete property`
      */
    ["com.affine.settings.workspace.properties.delete-property"](): string;
    /**
      * `Edit property`
      */
    ["com.affine.settings.workspace.properties.edit-property"](): string;
    /**
      * `General properties`
      */
    ["com.affine.settings.workspace.properties.general-properties"](): string;
    /**
      * `Properties`
      */
    ["com.affine.settings.workspace.properties.header.title"](): string;
    /**
      * `In use`
      */
    ["com.affine.settings.workspace.properties.in-use"](): string;
    /**
      * `Readonly properties`
      */
    ["com.affine.settings.workspace.properties.readonly-properties"](): string;
    /**
      * `Required properties`
      */
    ["com.affine.settings.workspace.properties.required-properties"](): string;
    /**
      * `Set as required property`
      */
    ["com.affine.settings.workspace.properties.set-as-required"](): string;
    /**
      * `Unused`
      */
    ["com.affine.settings.workspace.properties.unused"](): string;
    /**
      * `Enable Manut Cloud to publish this workspace`
      */
    ["com.affine.settings.workspace.publish-tooltip"](): string;
    /**
      * `Sharing`
      */
    ["com.affine.settings.workspace.sharing.title"](): string;
    /**
      * `Allow URL unfurling by Slack & other social apps, even if a doc is only accessible by workspace members.`
      */
    ["com.affine.settings.workspace.sharing.url-preview.description"](): string;
    /**
      * `Always enable url preview`
      */
    ["com.affine.settings.workspace.sharing.url-preview.title"](): string;
    /**
      * `Control whether pages in this workspace can be shared publicly. Turn off to block new shares and external access for existing shares.`
      */
    ["com.affine.settings.workspace.sharing.workspace-sharing.description"](): string;
    /**
      * `Allow workspace page sharing`
      */
    ["com.affine.settings.workspace.sharing.workspace-sharing.title"](): string;
    /**
      * `Available Offline`
      */
    ["com.affine.settings.workspace.state.available-offline"](): string;
    /**
      * `Joined Workspace`
      */
    ["com.affine.settings.workspace.state.joined"](): string;
    /**
      * `Local`
      */
    ["com.affine.settings.workspace.state.local"](): string;
    /**
      * `Published to Web`
      */
    ["com.affine.settings.workspace.state.published"](): string;
    /**
      * `Sync with Manut Cloud`
      */
    ["com.affine.settings.workspace.state.sync-affine-cloud"](): string;
    /**
      * `Team Workspace`
      */
    ["com.affine.settings.workspace.state.team"](): string;
    /**
      * `You can view current workspace's storage and files here.`
      */
    ["com.affine.settings.workspace.storage.subtitle"](): string;
    /**
      * `Unused blobs`
      */
    ["com.affine.settings.workspace.storage.unused-blobs"](): string;
    /**
      * `Delete blob files`
      */
    ["com.affine.settings.workspace.storage.unused-blobs.delete.title"](): string;
    /**
      * `Are you sure you want to delete these blob files? This action cannot be undone. Make sure you no longer need them before proceeding.`
      */
    ["com.affine.settings.workspace.storage.unused-blobs.delete.warning"](): string;
    /**
      * `No unused blobs`
      */
    ["com.affine.settings.workspace.storage.unused-blobs.empty"](): string;
    /**
      * `Selected`
      */
    ["com.affine.settings.workspace.storage.unused-blobs.selected"](): string;
    /**
      * `Template for journal`
      */
    ["com.affine.settings.workspace.template.journal"](): string;
    /**
      * `Select a template for your journal`
      */
    ["com.affine.settings.workspace.template.journal-desc"](): string;
    /**
      * `Keep empty`
      */
    ["com.affine.settings.workspace.template.keep-empty"](): string;
    /**
      * `New doc with template`
      */
    ["com.affine.settings.workspace.template.page"](): string;
    /**
      * `New docs will use the specified template, ignoring default settings.`
      */
    ["com.affine.settings.workspace.template.page-desc"](): string;
    /**
      * `Template for new doc`
      */
    ["com.affine.settings.workspace.template.page-select"](): string;
    /**
      * `Remove template`
      */
    ["com.affine.settings.workspace.template.remove"](): string;
    /**
      * `My Templates`
      */
    ["com.affine.settings.workspace.template.title"](): string;
    /**
      * `Sharing doc requires Manut Cloud.`
      */
    ["com.affine.share-menu.EnableCloudDescription"](): string;
    /**
      * `Share mode`
      */
    ["com.affine.share-menu.ShareMode"](): string;
    /**
      * `Share doc`
      */
    ["com.affine.share-menu.SharePage"](): string;
    /**
      * `Share via export`
      */
    ["com.affine.share-menu.ShareViaExport"](): string;
    /**
      * `Download a static copy of your doc to share with others`
      */
    ["com.affine.share-menu.ShareViaExportDescription"](): string;
    /**
      * `Print a paper copy`
      */
    ["com.affine.share-menu.ShareViaPrintDescription"](): string;
    /**
      * `Share with link`
      */
    ["com.affine.share-menu.ShareWithLink"](): string;
    /**
      * `Create a link you can easily share with anyone. The visitors will open your doc in the form od a document`
      */
    ["com.affine.share-menu.ShareWithLinkDescription"](): string;
    /**
      * `Shared doc`
      */
    ["com.affine.share-menu.SharedPage"](): string;
    /**
      * `Copy Link`
      */
    ["com.affine.share-menu.copy"](): string;
    /**
      * `Copy private link`
      */
    ["com.affine.share-menu.copy-private-link"](): string;
    /**
      * `Copy Link to Selected Block`
      */
    ["com.affine.share-menu.copy.block"](): string;
    /**
      * `Copy Link to Edgeless Mode`
      */
    ["com.affine.share-menu.copy.edgeless"](): string;
    /**
      * `Copy Link to Selected Frame`
      */
    ["com.affine.share-menu.copy.frame"](): string;
    /**
      * `Copy Link to Page Mode`
      */
    ["com.affine.share-menu.copy.page"](): string;
    /**
      * `You can share this document with link.`
      */
    ["com.affine.share-menu.create-public-link.notification.success.message"](): string;
    /**
      * `Public link created`
      */
    ["com.affine.share-menu.create-public-link.notification.success.title"](): string;
    /**
      * `Please try again later.`
      */
    ["com.affine.share-menu.disable-publish-link.notification.fail.message"](): string;
    /**
      * `Failed to disable public link`
      */
    ["com.affine.share-menu.disable-publish-link.notification.fail.title"](): string;
    /**
      * `This doc is no longer shared publicly.`
      */
    ["com.affine.share-menu.disable-publish-link.notification.success.message"](): string;
    /**
      * `Public link disabled`
      */
    ["com.affine.share-menu.disable-publish-link.notification.success.title"](): string;
    /**
      * `General access`
      */
    ["com.affine.share-menu.generalAccess"](): string;
    /**
      * `Send invite`
      */
    ["com.affine.share-menu.invite-editor.header"](): string;
    /**
      * `Invite`
      */
    ["com.affine.share-menu.invite-editor.invite"](): string;
    /**
      * `Manage members`
      */
    ["com.affine.share-menu.invite-editor.manage-members"](): string;
    /**
      * `No results found`
      */
    ["com.affine.share-menu.invite-editor.no-found"](): string;
    /**
      * `Invite other members`
      */
    ["com.affine.share-menu.invite-editor.placeholder"](): string;
    /**
      * `Notify via Email`
      */
    ["com.affine.share-menu.invite-editor.sent-email"](): string;
    /**
      * `Add collaborators`
      */
    ["com.affine.share-menu.member-management.add-collaborators"](): string;
    /**
      * `{{memberCount}} collaborators in the doc`
      */
    ["com.affine.share-menu.member-management.header"](options: {
        readonly memberCount: string;
    }): string;
    /**
      * `{{member1}} and {{member2}} are in this doc`
      */
    ["com.affine.share-menu.member-management.member-count-2"](options: Readonly<{
        member1: string;
        member2: string;
    }>): string;
    /**
      * `{{member1}}, {{member2}} and {{member3}} are in this doc`
      */
    ["com.affine.share-menu.member-management.member-count-3"](options: Readonly<{
        member1: string;
        member2: string;
        member3: string;
    }>): string;
    /**
      * `{{member1}}, {{member2}} and {{memberCount}} others`
      */
    ["com.affine.share-menu.member-management.member-count-more"](options: Readonly<{
        member1: string;
        member2: string;
        memberCount: string;
    }>): string;
    /**
      * `Remove`
      */
    ["com.affine.share-menu.member-management.remove"](): string;
    /**
      * `Set as owner`
      */
    ["com.affine.share-menu.member-management.set-as-owner"](): string;
    /**
      * `The new owner will be effective immediately, and you might lose access to this doc if other users remove you, please confirm.`
      */
    ["com.affine.share-menu.member-management.set-as-owner.confirm.description"](): string;
    /**
      * `Make this person the owner?`
      */
    ["com.affine.share-menu.member-management.set-as-owner.confirm.title"](): string;
    /**
      * `Failed to update permission`
      */
    ["com.affine.share-menu.member-management.update-fail"](): string;
    /**
      * `Permission updated`
      */
    ["com.affine.share-menu.member-management.update-success"](): string;
    /**
      * `Manage workspace members`
      */
    ["com.affine.share-menu.navigate.workspace"](): string;
    /**
      * `Anyone with the link`
      */
    ["com.affine.share-menu.option.link.label"](): string;
    /**
      * `No access`
      */
    ["com.affine.share-menu.option.link.no-access"](): string;
    /**
      * `Only workspace members can access this link`
      */
    ["com.affine.share-menu.option.link.no-access.description"](): string;
    /**
      * `Read only`
      */
    ["com.affine.share-menu.option.link.readonly"](): string;
    /**
      * `Anyone can access this link`
      */
    ["com.affine.share-menu.option.link.readonly.description"](): string;
    /**
      * `Can edit`
      */
    ["com.affine.share-menu.option.permission.can-edit"](): string;
    /**
      * `Can manage`
      */
    ["com.affine.share-menu.option.permission.can-manage"](): string;
    /**
      * `Can read`
      */
    ["com.affine.share-menu.option.permission.can-read"](): string;
    /**
      * `Members in workspace`
      */
    ["com.affine.share-menu.option.permission.label"](): string;
    /**
      * `No access`
      */
    ["com.affine.share-menu.option.permission.no-access"](): string;
    /**
      * `Workspace admins and owner automatically have Can manage permissions.`
      */
    ["com.affine.share-menu.option.permission.tips"](): string;
    /**
      * `Got it`
      */
    ["com.affine.share-menu.paywall.member.confirm"](): string;
    /**
      * `Ask your workspace owner to upgrade to Pro or higher to enable permissions.`
      */
    ["com.affine.share-menu.paywall.member.description"](): string;
    /**
      * `Permission requires a workspace upgrade`
      */
    ["com.affine.share-menu.paywall.member.title"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.share-menu.paywall.owner.confirm"](): string;
    /**
      * `Upgrade to Pro or higher to unlock permission settings for this doc.`
      */
    ["com.affine.share-menu.paywall.owner.description"](): string;
    /**
      * `Permission not available in Free plan`
      */
    ["com.affine.share-menu.paywall.owner.title"](): string;
    /**
      * `Publish to web`
      */
    ["com.affine.share-menu.publish-to-web"](): string;
    /**
      * `Share privately`
      */
    ["com.affine.share-menu.share-privately"](): string;
    /**
      * `Share`
      */
    ["com.affine.share-menu.shareButton"](): string;
    /**
      * `Shared`
      */
    ["com.affine.share-menu.sharedButton"](): string;
    /**
      * `Sharing for this workspace is turned off. Please contact an admin to enable it.`
      */
    ["com.affine.share-menu.workspace-sharing.disabled.tooltip"](): string;
    /**
      * `Built with`
      */
    ["com.affine.share-page.footer.built-with"](): string;
    /**
      * `Create with`
      */
    ["com.affine.share-page.footer.create-with"](): string;
    /**
      * `Empower your sharing with Manut Cloud: One-click doc sharing`
      */
    ["com.affine.share-page.footer.description"](): string;
    /**
      * `Get started for free`
      */
    ["com.affine.share-page.footer.get-started"](): string;
    /**
      * `Use This Template`
      */
    ["com.affine.share-page.header.import-template"](): string;
    /**
      * `Login or Sign Up`
      */
    ["com.affine.share-page.header.login"](): string;
    /**
      * `Present`
      */
    ["com.affine.share-page.header.present"](): string;
    /**
      * `Edgeless`
      */
    ["com.affine.shortcutsTitle.edgeless"](): string;
    /**
      * `General`
      */
    ["com.affine.shortcutsTitle.general"](): string;
    /**
      * `Markdown syntax`
      */
    ["com.affine.shortcutsTitle.markdownSyntax"](): string;
    /**
      * `Page`
      */
    ["com.affine.shortcutsTitle.page"](): string;
    /**
      * `Collapse sidebar`
      */
    ["com.affine.sidebarSwitch.collapse"](): string;
    /**
      * `Expand sidebar`
      */
    ["com.affine.sidebarSwitch.expand"](): string;
    /**
      * `Snapshot Imp. & Exp.`
      */
    ["com.affine.snapshot.import-export.enable"](): string;
    /**
      * `Once enabled you can find the Snapshot Export Import option in the document's More menu.`
      */
    ["com.affine.snapshot.import-export.enable.desc"](): string;
    /**
      * `Click or drag`
      */
    ["com.affine.split-view-drag-handle.tooltip"](): string;
    /**
      * `Split view does not support folders.`
      */
    ["com.affine.split-view-folder-warning.description"](): string;
    /**
      * `Maybe later`
      */
    ["com.affine.star-affine.cancel"](): string;
    /**
      * `Star on GitHub`
      */
    ["com.affine.star-affine.confirm"](): string;
    /**
      * `Are you finding our app useful and enjoyable? We'd love your support to keep improving! A great way to help us out is by giving us a star on GitHub. This simple action can make a big difference and helps us continue to deliver the best experience for you.`
      */
    ["com.affine.star-affine.description"](): string;
    /**
      * `Star us on GitHub`
      */
    ["com.affine.star-affine.title"](): string;
    /**
      * `Change plan`
      */
    ["com.affine.storage.change-plan"](): string;
    /**
      * `You have reached the maximum capacity limit for your current account`
      */
    ["com.affine.storage.maximum-tips"](): string;
    /**
      * `Pro users will have unlimited storage capacity during the alpha test period of the team version`
      */
    ["com.affine.storage.maximum-tips.pro"](): string;
    /**
      * `Plan`
      */
    ["com.affine.storage.plan"](): string;
    /**
      * `Manut Cloud storage`
      */
    ["com.affine.storage.title"](): string;
    /**
      * `Upgrade`
      */
    ["com.affine.storage.upgrade"](): string;
    /**
      * `Space used`
      */
    ["com.affine.storage.used.hint"](): string;
    /**
      * `Syncing`
      */
    ["com.affine.syncing"](): string;
    /**
      * `{{count}} doc`
    
      * - com.affine.tags.count_one: `{{count}} doc`
    
      * - com.affine.tags.count_other: `{{count}} docs`
    
      * - com.affine.tags.count_zero: `{{count}} doc`
      */
    ["com.affine.tags.count"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `{{count}} doc`
      */
    ["com.affine.tags.count_one"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `{{count}} docs`
      */
    ["com.affine.tags.count_other"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `{{count}} doc`
      */
    ["com.affine.tags.count_zero"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `Type tag name here...`
      */
    ["com.affine.tags.create-tag.placeholder"](): string;
    /**
      * `Tag already exists`
      */
    ["com.affine.tags.create-tag.toast.exist"](): string;
    /**
      * `Tag created`
      */
    ["com.affine.tags.create-tag.toast.success"](): string;
    /**
      * `Tag deleted`
      */
    ["com.affine.tags.delete-tags.toast"](): string;
    /**
      * `Tag updated`
      */
    ["com.affine.tags.edit-tag.toast.success"](): string;
    /**
      * `New tag`
      */
    ["com.affine.tags.empty.new-tag-button"](): string;
    /**
      * `Enable telemetry`
      */
    ["com.affine.telemetry.enable"](): string;
    /**
      * `Telemetry is a feature that allows us to collect data on how you use the app. This data helps us improve the app and provide better features.`
      */
    ["com.affine.telemetry.enable.desc"](): string;
    /**
      * `Select`
      */
    ["com.affine.template-journal-onboarding.select"](): string;
    /**
      * `Set a Template for the Journal`
      */
    ["com.affine.template-journal-onboarding.title"](): string;
    /**
      * `Create new template`
      */
    ["com.affine.template-list.create-new"](): string;
    /**
      * `Delete Template`
      */
    ["com.affine.template-list.delete"](): string;
    /**
      * `No template`
      */
    ["com.affine.template-list.empty"](): string;
    /**
      * `Auto`
      */
    ["com.affine.themeSettings.auto"](): string;
    /**
      * `Dark`
      */
    ["com.affine.themeSettings.dark"](): string;
    /**
      * `Light`
      */
    ["com.affine.themeSettings.light"](): string;
    /**
      * `System`
      */
    ["com.affine.themeSettings.system"](): string;
    /**
      * `now`
      */
    ["com.affine.time.now"](): string;
    /**
      * `this month`
      */
    ["com.affine.time.this-mouth"](): string;
    /**
      * `this week`
      */
    ["com.affine.time.this-week"](): string;
    /**
      * `this year`
      */
    ["com.affine.time.this-year"](): string;
    /**
      * `today`
      */
    ["com.affine.time.today"](): string;
    /**
      * `Successfully added linked doc`
      */
    ["com.affine.toastMessage.addLinkedPage"](): string;
    /**
      * `Added to favorites`
      */
    ["com.affine.toastMessage.addedFavorites"](): string;
    /**
      * `The default mode for this document has been changed to Edgeless mode`
      */
    ["com.affine.toastMessage.defaultMode.edgeless.message"](): string;
    /**
      * `Default mode has changed`
      */
    ["com.affine.toastMessage.defaultMode.edgeless.title"](): string;
    /**
      * `The default mode for this document has been changed to Page mode`
      */
    ["com.affine.toastMessage.defaultMode.page.message"](): string;
    /**
      * `Default mode has changed`
      */
    ["com.affine.toastMessage.defaultMode.page.title"](): string;
    /**
      * `Edgeless mode`
      */
    ["com.affine.toastMessage.edgelessMode"](): string;
    /**
      * `Moved to trash`
      */
    ["com.affine.toastMessage.movedTrash"](): string;
    /**
      * `Page Mode`
      */
    ["com.affine.toastMessage.pageMode"](): string;
    /**
      * `Permanently deleted`
      */
    ["com.affine.toastMessage.permanentlyDeleted"](): string;
    /**
      * `Removed from favourites`
      */
    ["com.affine.toastMessage.removedFavorites"](): string;
    /**
      * `Successfully renamed`
      */
    ["com.affine.toastMessage.rename"](): string;
    /**
      * `{{title}} restored`
      */
    ["com.affine.toastMessage.restored"](options: {
        readonly title: string;
    }): string;
    /**
      * `Successfully deleted`
      */
    ["com.affine.toastMessage.successfullyDeleted"](): string;
    /**
      * `Today`
      */
    ["com.affine.today"](): string;
    /**
      * `Tomorrow`
      */
    ["com.affine.tomorrow"](): string;
    /**
      * `Limited to view-only on mobile.`
      */
    ["com.affine.top-tip.mobile"](): string;
    /**
      * `Delete`
      */
    ["com.affine.trashOperation.delete"](): string;
    /**
      * `Once deleted, you can't undo this action. Do you confirm?`
      */
    ["com.affine.trashOperation.delete.description"](): string;
    /**
      * `Permanently delete`
      */
    ["com.affine.trashOperation.delete.title"](): string;
    /**
      * `Once deleted, you can't undo this action. Do you confirm?`
      */
    ["com.affine.trashOperation.deleteDescription"](): string;
    /**
      * `Delete permanently`
      */
    ["com.affine.trashOperation.deletePermanently"](): string;
    /**
      * `Restore it`
      */
    ["com.affine.trashOperation.restoreIt"](): string;
    /**
      * `Perfect for growing teams and organizations that need professional collaboration tools.`
      */
    ["com.affine.upgrade-to-team-page.benefit.description"](): string;
    /**
      * `Invite unlimited members to your workspace`
      */
    ["com.affine.upgrade-to-team-page.benefit.g1"](): string;
    /**
      * `Set custom roles and permissions for better control`
      */
    ["com.affine.upgrade-to-team-page.benefit.g2"](): string;
    /**
      * `Access advanced team management features`
      */
    ["com.affine.upgrade-to-team-page.benefit.g3"](): string;
    /**
      * `Get priority customer support`
      */
    ["com.affine.upgrade-to-team-page.benefit.g4"](): string;
    /**
      * `Team Workspace gives you everything you need for seamless team collaboration:`
      */
    ["com.affine.upgrade-to-team-page.benefit.title"](): string;
    /**
      * `Continue to Pricing`
      */
    ["com.affine.upgrade-to-team-page.create-and-upgrade-confirm.confirm"](): string;
    /**
      * `A workspace is your virtual space to capture, create and plan as just one person or together as a team.`
      */
    ["com.affine.upgrade-to-team-page.create-and-upgrade-confirm.description"](): string;
    /**
      * `Set a workspace name`
      */
    ["com.affine.upgrade-to-team-page.create-and-upgrade-confirm.placeholder"](): string;
    /**
      * `Name Your Workspace`
      */
    ["com.affine.upgrade-to-team-page.create-and-upgrade-confirm.title"](): string;
    /**
      * `No workspace available`
      */
    ["com.affine.upgrade-to-team-page.no-workspace-available"](): string;
    /**
      * `Empower Your Team with Seamless Collaboration`
      */
    ["com.affine.upgrade-to-team-page.title"](): string;
    /**
      * `Upgrade to Team Workspace`
      */
    ["com.affine.upgrade-to-team-page.upgrade-button"](): string;
    /**
      * `Upgrade to Team Workspace`
      */
    ["com.affine.upgrade-to-team-page.upgrade-confirm.title"](): string;
    /**
      * `Create Workspace`
      */
    ["com.affine.upgrade-to-team-page.workspace-selector.create-workspace"](): string;
    /**
      * `Select an existing workspace or create a new one`
      */
    ["com.affine.upgrade-to-team-page.workspace-selector.placeholder"](): string;
    /**
      * `Refresh current page`
      */
    ["com.affine.upgrade.button-text.done"](): string;
    /**
      * `Data upgrade error`
      */
    ["com.affine.upgrade.button-text.error"](): string;
    /**
      * `Upgrade workspace data`
      */
    ["com.affine.upgrade.button-text.pending"](): string;
    /**
      * `Upgrading`
      */
    ["com.affine.upgrade.button-text.upgrading"](): string;
    /**
      * `After upgrading the workspace data, please refresh the page to see the changes.`
      */
    ["com.affine.upgrade.tips.done"](): string;
    /**
      * `We encountered some errors while upgrading the workspace data.`
      */
    ["com.affine.upgrade.tips.error"](): string;
    /**
      * `To ensure compatibility with the updated Manut client, please upgrade your data by clicking the "Upgrade workspace data" button below.`
      */
    ["com.affine.upgrade.tips.normal"](): string;
    /**
      * `AI usage`
      */
    ["com.affine.user-info.usage.ai"](): string;
    /**
      * `Cloud storage`
      */
    ["com.affine.user-info.usage.cloud"](): string;
    /**
      * `Close`
      */
    ["com.affine.workbench.split-view-menu.close"](): string;
    /**
      * `Full screen`
      */
    ["com.affine.workbench.split-view-menu.full-screen"](): string;
    /**
      * `Solo view`
      */
    ["com.affine.workbench.split-view-menu.keep-this-one"](): string;
    /**
      * `Move left`
      */
    ["com.affine.workbench.split-view-menu.move-left"](): string;
    /**
      * `Move right`
      */
    ["com.affine.workbench.split-view-menu.move-right"](): string;
    /**
      * `Open in split view`
      */
    ["com.affine.workbench.split-view.page-menu-open"](): string;
    /**
      * `Open in new tab`
      */
    ["com.affine.workbench.tab.page-menu-open"](): string;
    /**
      * `You cannot delete the last workspace`
      */
    ["com.affine.workspace.cannot-delete"](): string;
    /**
      * `Cloud workspaces`
      */
    ["com.affine.workspace.cloud"](): string;
    /**
      * `Admin panel`
      */
    ["com.affine.workspace.cloud.account.admin"](): string;
    /**
      * `Sign out`
      */
    ["com.affine.workspace.cloud.account.logout"](): string;
    /**
      * `Account settings`
      */
    ["com.affine.workspace.cloud.account.settings"](): string;
    /**
      * `Team member`
      */
    ["com.affine.workspace.cloud.account.team.member"](): string;
    /**
      * `Multiple teams`
      */
    ["com.affine.workspace.cloud.account.team.multi"](): string;
    /**
      * `Team owner`
      */
    ["com.affine.workspace.cloud.account.team.owner"](): string;
    /**
      * `Click to open workspace`
      */
    ["com.affine.workspace.cloud.account.team.tips-1"](): string;
    /**
      * `Click to open workspace list`
      */
    ["com.affine.workspace.cloud.account.team.tips-2"](): string;
    /**
      * `Sign up/ Sign in`
      */
    ["com.affine.workspace.cloud.auth"](): string;
    /**
      * `Sync with Manut Cloud`
      */
    ["com.affine.workspace.cloud.description"](): string;
    /**
      * `Join workspace`
      */
    ["com.affine.workspace.cloud.join"](): string;
    /**
      * `Cloud sync`
      */
    ["com.affine.workspace.cloud.sync"](): string;
    /**
      * `Failed to enable Cloud, please try again.`
      */
    ["com.affine.workspace.enable-cloud.failed"](): string;
    /**
      * `Local workspaces`
      */
    ["com.affine.workspace.local"](): string;
    /**
      * `Import workspace`
      */
    ["com.affine.workspace.local.import"](): string;
    /**
      * `Workspace properties`
      */
    ["com.affine.workspace.properties"](): string;
    /**
      * `Workspace storage`
      */
    ["com.affine.workspace.storage"](): string;
    /**
      * `Cancel`
      */
    ["com.affine.workspaceDelete.button.cancel"](): string;
    /**
      * `Delete`
      */
    ["com.affine.workspaceDelete.button.delete"](): string;
    /**
      * `Please type workspace name to confirm`
      */
    ["com.affine.workspaceDelete.placeholder"](): string;
    /**
      * `Delete workspace`
      */
    ["com.affine.workspaceDelete.title"](): string;
    /**
      * `Add Server`
      */
    ["com.affine.workspaceList.addServer"](): string;
    /**
      * `Create workspace`
      */
    ["com.affine.workspaceList.addWorkspace.create"](): string;
    /**
      * `Create cloud workspace`
      */
    ["com.affine.workspaceList.addWorkspace.create-cloud"](): string;
    /**
      * `Cloud sync`
      */
    ["com.affine.workspaceList.workspaceListType.cloud"](): string;
    /**
      * `Local storage`
      */
    ["com.affine.workspaceList.workspaceListType.local"](): string;
    /**
      * `All docs`
      */
    ["com.affine.workspaceSubPath.all"](): string;
    /**
      * `Intelligence`
      */
    ["com.affine.workspaceSubPath.chat"](): string;
    /**
      * `Trash`
      */
    ["com.affine.workspaceSubPath.trash"](): string;
    /**
      * `Deleted docs will appear here.`
      */
    ["com.affine.workspaceSubPath.trash.empty-description"](): string;
    /**
      * `Write with a blank page`
      */
    ["com.affine.write_with_a_blank_page"](): string;
    /**
      * `Yesterday`
      */
    ["com.affine.yesterday"](): string;
    /**
      * `Trigger a build to populate this. Once GitHub Actions runs a Manut release workflow, you'll see it listed here.`
      */
    ["com.manut.control-plane.releaseRuns.empty.body"](): string;
    /**
      * `No release runs yet`
      */
    ["com.manut.control-plane.releaseRuns.empty.title"](): string;
    /**
      * `Failed to load release runs`
      */
    ["com.manut.control-plane.releaseRuns.error"](): string;
    /**
      * `Deploy URL`
      */
    ["com.manut.control-plane.releaseRuns.evidence.deployUrl"](): string;
    /**
      * `GitHub run`
      */
    ["com.manut.control-plane.releaseRuns.evidence.githubRun"](): string;
    /**
      * `Evidence`
      */
    ["com.manut.control-plane.releaseRuns.evidence.label"](): string;
    /**
      * `Recent Manut control-plane release runs. Click a row to see the task tree and evidence links.`
      */
    ["com.manut.control-plane.releaseRuns.subtitle"](): string;
    /**
      * `Tasks`
      */
    ["com.manut.control-plane.releaseRuns.tasks.label"](): string;
    /**
      * `Release runs`
      */
    ["com.manut.control-plane.releaseRuns.title"](): string;
    /**
      * `Release runs are not enabled on this workspace. Ask your administrator to enable the Manut control plane.`
      */
    ["com.manut.control-plane.releaseRuns.unavailable"](): string;
    /**
      * `The system or workflow that executes this role.`
      */
    ["com.manut.control-plane.roles.adapter.hint"](): string;
    /**
      * `Adapter`
      */
    ["com.manut.control-plane.roles.adapter.label"](): string;
    /**
      * `e.g. github-actions`
      */
    ["com.manut.control-plane.roles.adapter.placeholder"](): string;
    /**
      * ``
      */
    ["com.manut.control-plane.roles.column.actions"](): string;
    /**
      * `Adapter`
      */
    ["com.manut.control-plane.roles.column.adapter"](): string;
    /**
      * `Display name`
      */
    ["com.manut.control-plane.roles.column.displayName"](): string;
    /**
      * `Escalation`
      */
    ["com.manut.control-plane.roles.column.escalation"](): string;
    /**
      * `Responsibility`
      */
    ["com.manut.control-plane.roles.column.responsibility"](): string;
    /**
      * `Slug`
      */
    ["com.manut.control-plane.roles.column.slug"](): string;
    /**
      * `Edit the five operating roles (Release Captain, Builder, Verifier, Deployer, Historian). Slug is fixed; display name, adapter, and escalation are editable.`
      */
    ["com.manut.control-plane.roles.description"](): string;
    /**
      * `Display name`
      */
    ["com.manut.control-plane.roles.displayName.label"](): string;
    /**
      * `e.g. Release Captain`
      */
    ["com.manut.control-plane.roles.displayName.placeholder"](): string;
    /**
      * `Cancel`
      */
    ["com.manut.control-plane.roles.edit.cancel"](): string;
    /**
      * `Update display name, adapter binding, and escalation note. The slug is fixed.`
      */
    ["com.manut.control-plane.roles.edit.description"](): string;
    /**
      * `Save`
      */
    ["com.manut.control-plane.roles.edit.save"](): string;
    /**
      * `Edit agent role`
      */
    ["com.manut.control-plane.roles.edit.title"](): string;
    /**
      * `Edit`
      */
    ["com.manut.control-plane.roles.editButton"](): string;
    /**
      * `No agent roles have been registered for this workspace yet.`
      */
    ["com.manut.control-plane.roles.empty"](): string;
    /**
      * `Adapter is required.`
      */
    ["com.manut.control-plane.roles.error.adapterRequired"](): string;
    /**
      * `Display name is required.`
      */
    ["com.manut.control-plane.roles.error.displayNameRequired"](): string;
    /**
      * `Could not update role`
      */
    ["com.manut.control-plane.roles.error.updateFailed"](): string;
    /**
      * `Escalation (optional)`
      */
    ["com.manut.control-plane.roles.escalation.label"](): string;
    /**
      * `Who to page if this role fails.`
      */
    ["com.manut.control-plane.roles.escalation.placeholder"](): string;
    /**
      * `Each role binds to an adapter that executes its work — GitHub Actions, deploy scripts, or future AI workers. Last successful run links to the run details page.`
      */
    ["com.manut.control-plane.roles.intro"](): string;
    /**
      * `Last success:`
      */
    ["com.manut.control-plane.roles.lastRun.label"](): string;
    /**
      * `view run`
      */
    ["com.manut.control-plane.roles.lastRun.view"](): string;
    /**
      * `Last seen:`
      */
    ["com.manut.control-plane.roles.lastSeen.label"](): string;
    /**
      * `Agent roles`
      */
    ["com.manut.control-plane.roles.section.title"](): string;
    /**
      * `Stable identifier. Cannot be changed.`
      */
    ["com.manut.control-plane.roles.slug.hint"](): string;
    /**
      * `Slug`
      */
    ["com.manut.control-plane.roles.slug.label"](): string;
    /**
      * `Control Plane Roles`
      */
    ["com.manut.control-plane.roles.tab.title"](): string;
    /**
      * `Control Plane roles are not enabled on this workspace. Ask your administrator to enable the Manut control plane.`
      */
    ["com.manut.control-plane.roles.unavailable"](): string;
    /**
      * `Role updated`
      */
    ["com.manut.control-plane.roles.updated.title"](): string;
    /**
      * `New account`
      */
    ["com.manut.crm.accounts.create"](): string;
    /**
      * `Could not create account`
      */
    ["com.manut.crm.accounts.create.error"](): string;
    /**
      * `Account created`
      */
    ["com.manut.crm.accounts.created"](): string;
    /**
      * `Edit account`
      */
    ["com.manut.crm.accounts.edit"](): string;
    /**
      * `No accounts yet. Create one to get started.`
      */
    ["com.manut.crm.accounts.empty"](): string;
    /**
      * `Companies and organizations you sell to or partner with.`
      */
    ["com.manut.crm.accounts.subtitle"](): string;
    /**
      * `Could not save account`
      */
    ["com.manut.crm.accounts.update.error"](): string;
    /**
      * `Account saved`
      */
    ["com.manut.crm.accounts.updated"](): string;
    /**
      * `Cancel`
      */
    ["com.manut.crm.action.cancel"](): string;
    /**
      * `Create`
      */
    ["com.manut.crm.action.create"](): string;
    /**
      * `Delete`
      */
    ["com.manut.crm.action.delete"](): string;
    /**
      * `Edit`
      */
    ["com.manut.crm.action.edit"](): string;
    /**
      * `Save`
      */
    ["com.manut.crm.action.save"](): string;
    /**
      * `New activity`
      */
    ["com.manut.crm.activities.create"](): string;
    /**
      * `Could not create activity`
      */
    ["com.manut.crm.activities.create.error"](): string;
    /**
      * `Activity logged`
      */
    ["com.manut.crm.activities.created"](): string;
    /**
      * `Edit activity`
      */
    ["com.manut.crm.activities.edit"](): string;
    /**
      * `No activities yet. Log a call, email, or note to keep track.`
      */
    ["com.manut.crm.activities.empty"](): string;
    /**
      * `Calls, meetings, emails, and notes attached to your CRM records.`
      */
    ["com.manut.crm.activities.subtitle"](): string;
    /**
      * `Could not save activity`
      */
    ["com.manut.crm.activities.update.error"](): string;
    /**
      * `Activity saved`
      */
    ["com.manut.crm.activities.updated"](): string;
    /**
      * `New contact`
      */
    ["com.manut.crm.contacts.create"](): string;
    /**
      * `Could not create contact`
      */
    ["com.manut.crm.contacts.create.error"](): string;
    /**
      * `Contact created`
      */
    ["com.manut.crm.contacts.created"](): string;
    /**
      * `Edit contact`
      */
    ["com.manut.crm.contacts.edit"](): string;
    /**
      * `No contacts yet. Add one to start tracking conversations.`
      */
    ["com.manut.crm.contacts.empty"](): string;
    /**
      * `People you talk to. Link them to an account to keep context together.`
      */
    ["com.manut.crm.contacts.subtitle"](): string;
    /**
      * `Could not save contact`
      */
    ["com.manut.crm.contacts.update.error"](): string;
    /**
      * `Contact saved`
      */
    ["com.manut.crm.contacts.updated"](): string;
    /**
      * `Add a stage`
      */
    ["com.manut.crm.deals.addStage"](): string;
    /**
      * `New deal`
      */
    ["com.manut.crm.deals.create"](): string;
    /**
      * `Could not create deal`
      */
    ["com.manut.crm.deals.create.error"](): string;
    /**
      * `Deal created`
      */
    ["com.manut.crm.deals.created"](): string;
    /**
      * `Edit deal`
      */
    ["com.manut.crm.deals.edit"](): string;
    /**
      * `No deals yet. Create one to start tracking your pipeline.`
      */
    ["com.manut.crm.deals.empty"](): string;
    /**
      * `Add a deal stage before you can create deals.`
      */
    ["com.manut.crm.deals.noStages"](): string;
    /**
      * `Could not create stage`
      */
    ["com.manut.crm.deals.stage.create.error"](): string;
    /**
      * `Stage created`
      */
    ["com.manut.crm.deals.stage.created"](): string;
    /**
      * `Could not move stage`
      */
    ["com.manut.crm.deals.stage.move.error"](): string;
    /**
      * `Stage updated`
      */
    ["com.manut.crm.deals.stage.moved"](): string;
    /**
      * `Open opportunities grouped by pipeline stage.`
      */
    ["com.manut.crm.deals.subtitle"](): string;
    /**
      * `Could not save deal`
      */
    ["com.manut.crm.deals.update.error"](): string;
    /**
      * `Deal saved`
      */
    ["com.manut.crm.deals.updated"](): string;
    /**
      * `Linked contacts`
      */
    ["com.manut.crm.detail.account.contacts"](): string;
    /**
      * `Linked deals`
      */
    ["com.manut.crm.detail.account.deals"](): string;
    /**
      * `Linked records`
      */
    ["com.manut.crm.detail.activity.linked"](): string;
    /**
      * `Activity history`
      */
    ["com.manut.crm.detail.deal.activity"](): string;
    /**
      * `Moving…`
      */
    ["com.manut.crm.detail.deal.moving"](): string;
    /**
      * `Nothing linked yet.`
      */
    ["com.manut.crm.detail.linked.none"](): string;
    /**
      * `Something went wrong loading CRM data`
      */
    ["com.manut.crm.error.message"](): string;
    /**
      * `Try again`
      */
    ["com.manut.crm.error.retry"](): string;
    /**
      * `Unknown error`
      */
    ["com.manut.crm.error.unknown"](): string;
    /**
      * `Account`
      */
    ["com.manut.crm.fields.account"](): string;
    /**
      * `No account`
      */
    ["com.manut.crm.fields.account.none"](): string;
    /**
      * `Body`
      */
    ["com.manut.crm.fields.body"](): string;
    /**
      * `Email`
      */
    ["com.manut.crm.fields.email"](): string;
    /**
      * `First name`
      */
    ["com.manut.crm.fields.firstName"](): string;
    /**
      * `Industry`
      */
    ["com.manut.crm.fields.industry"](): string;
    /**
      * `Last name`
      */
    ["com.manut.crm.fields.lastName"](): string;
    /**
      * `Name`
      */
    ["com.manut.crm.fields.name"](): string;
    /**
      * `Acme Inc.`
      */
    ["com.manut.crm.fields.name.placeholder"](): string;
    /**
      * `Notes`
      */
    ["com.manut.crm.fields.notes"](): string;
    /**
      * `Phone`
      */
    ["com.manut.crm.fields.phone"](): string;
    /**
      * `Stage`
      */
    ["com.manut.crm.fields.stage"](): string;
    /**
      * `Stage name`
      */
    ["com.manut.crm.fields.stage.name"](): string;
    /**
      * `Pick a stage`
      */
    ["com.manut.crm.fields.stage.placeholder"](): string;
    /**
      * `Subject`
      */
    ["com.manut.crm.fields.subject"](): string;
    /**
      * `Title`
      */
    ["com.manut.crm.fields.title"](): string;
    /**
      * `Type`
      */
    ["com.manut.crm.fields.type"](): string;
    /**
      * `Value`
      */
    ["com.manut.crm.fields.value"](): string;
    /**
      * `Website`
      */
    ["com.manut.crm.fields.website"](): string;
    /**
      * `{{count}} deals`
    
      * - com.manut.crm.kanban.column.count_one: `{{count}} deal`
      */
    ["com.manut.crm.kanban.column.count"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `{{count}} deal`
      */
    ["com.manut.crm.kanban.column.count_one"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `Drop a deal here to move it.`
      */
    ["com.manut.crm.kanban.column.empty"](): string;
    /**
      * `Could not move deal`
      */
    ["com.manut.crm.kanban.error.move"](): string;
    /**
      * `Add at least one stage to use the Kanban.`
      */
    ["com.manut.crm.kanban.error.noStages"](): string;
    /**
      * `Kanban view`
      */
    ["com.manut.crm.kanban.toggle"](): string;
    /**
      * `Accounts`
      */
    ["com.manut.crm.tab.accounts"](): string;
    /**
      * `Activities`
      */
    ["com.manut.crm.tab.activities"](): string;
    /**
      * `Contacts`
      */
    ["com.manut.crm.tab.contacts"](): string;
    /**
      * `Deals`
      */
    ["com.manut.crm.tab.deals"](): string;
    /**
      * `CRM`
      */
    ["com.manut.crm.title"](): string;
    /**
      * `Part of a cluster of {{size}} docs`
      */
    ["com.manut.knowledgeGraph.detail.cluster"](options: {
        readonly size: string;
    }): string;
    /**
      * `Close panel`
      */
    ["com.manut.knowledgeGraph.detail.close"](): string;
    /**
      * `Incoming links ({{count}})`
      */
    ["com.manut.knowledgeGraph.detail.incoming"](options: {
        readonly count: string;
    }): string;
    /**
      * `No recent activity`
      */
    ["com.manut.knowledgeGraph.detail.noActivity"](): string;
    /**
      * `No incoming links`
      */
    ["com.manut.knowledgeGraph.detail.noIncoming"](): string;
    /**
      * `No outgoing links`
      */
    ["com.manut.knowledgeGraph.detail.noOutgoing"](): string;
    /**
      * `Open {{title}}`
      */
    ["com.manut.knowledgeGraph.detail.openDoc"](options: {
        readonly title: string;
    }): string;
    /**
      * `Open document`
      */
    ["com.manut.knowledgeGraph.detail.openDocumentButton"](): string;
    /**
      * `Open in peek`
      */
    ["com.manut.knowledgeGraph.detail.openPeekButton"](): string;
    /**
      * `Orphan doc`
      */
    ["com.manut.knowledgeGraph.detail.orphan"](): string;
    /**
      * `Outgoing links ({{count}})`
      */
    ["com.manut.knowledgeGraph.detail.outgoing"](options: {
        readonly count: string;
    }): string;
    /**
      * `Recent AI activity`
      */
    ["com.manut.knowledgeGraph.detail.recentActivity"](): string;
    /**
      * `Add task`
      */
    ["com.manut.pm.action.addTask"](): string;
    /**
      * `Archive`
      */
    ["com.manut.pm.action.archiveProject"](): string;
    /**
      * `Back`
      */
    ["com.manut.pm.action.back"](): string;
    /**
      * `Cancel`
      */
    ["com.manut.pm.action.cancel"](): string;
    /**
      * `Create project`
      */
    ["com.manut.pm.action.createProject"](): string;
    /**
      * `Edit project`
      */
    ["com.manut.pm.action.editProject"](): string;
    /**
      * `Edit task`
      */
    ["com.manut.pm.action.editTask"](): string;
    /**
      * `New project`
      */
    ["com.manut.pm.action.newProject"](): string;
    /**
      * `Retry`
      */
    ["com.manut.pm.action.retry"](): string;
    /**
      * `Save changes`
      */
    ["com.manut.pm.action.saveChanges"](): string;
    /**
      * `This project is archived. Edit the project to restore it to Active.`
      */
    ["com.manut.pm.archive.banner"](): string;
    /**
      * `Cancel`
      */
    ["com.manut.pm.archive.confirm.cancel"](): string;
    /**
      * `Archive project`
      */
    ["com.manut.pm.archive.confirm.confirm"](): string;
    /**
      * `Archiving this project hides it from active project lists. You can restore it later by editing the project status.`
      */
    ["com.manut.pm.archive.confirm.description"](): string;
    /**
      * `Archive project?`
      */
    ["com.manut.pm.archive.confirm.title"](): string;
    /**
      * `The project you are looking for may have been deleted.`
      */
    ["com.manut.pm.detail.notFound.body"](): string;
    /**
      * `Project not found`
      */
    ["com.manut.pm.detail.notFound.title"](): string;
    /**
      * `No project id provided in the URL.`
      */
    ["com.manut.pm.detail.notFound.noId"](): string;
    /**
      * `Tasks`
      */
    ["com.manut.pm.detail.section.tasks"](): string;
    /**
      * `Could not archive project`
      */
    ["com.manut.pm.error.archiveProject"](): string;
    /**
      * `Could not update project`
      */
    ["com.manut.pm.error.updateProject"](): string;
    /**
      * `Create your first project to organize tasks.`
      */
    ["com.manut.pm.empty.body"](): string;
    /**
      * `No projects yet`
      */
    ["com.manut.pm.empty.title"](): string;
    /**
      * `Could not create project`
      */
    ["com.manut.pm.error.createProject"](): string;
    /**
      * `Could not add task`
      */
    ["com.manut.pm.error.createTask"](): string;
    /**
      * `Failed to delete task`
      */
    ["com.manut.pm.error.deleteTask"](): string;
    /**
      * `Failed to load projects`
      */
    ["com.manut.pm.error.loadProjects"](): string;
    /**
      * `Failed to load tasks`
      */
    ["com.manut.pm.error.loadTasks"](): string;
    /**
      * `Failed to update task`
      */
    ["com.manut.pm.error.updateTask"](): string;
    /**
      * `Assignee user id (optional)`
      */
    ["com.manut.pm.field.assignee"](): string;
    /**
      * `Description (optional)`
      */
    ["com.manut.pm.field.description"](): string;
    /**
      * `Due date (optional)`
      */
    ["com.manut.pm.field.dueDate"](): string;
    /**
      * `Name`
      */
    ["com.manut.pm.field.name"](): string;
    /**
      * `Priority`
      */
    ["com.manut.pm.field.priority"](): string;
    /**
      * `Status`
      */
    ["com.manut.pm.field.status"](): string;
    /**
      * `Title`
      */
    ["com.manut.pm.field.title"](): string;
    /**
      * `{{count}} tasks`
    
      * - com.manut.pm.kanban.column.count_one: `{{count}} task`
      */
    ["com.manut.pm.kanban.column.count"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `{{count}} task`
      */
    ["com.manut.pm.kanban.column.count_one"](options: {
        readonly count: string | number | bigint;
    }): string;
    /**
      * `Drop a task here to move it.`
      */
    ["com.manut.pm.kanban.column.empty"](): string;
    /**
      * `Could not move task`
      */
    ["com.manut.pm.kanban.error.move"](): string;
    /**
      * `Kanban view`
      */
    ["com.manut.pm.kanban.toggle"](): string;
    /**
      * `Kanban view`
      */
    ["com.manut.pm.kanban.view.kanban"](): string;
    /**
      * `List view`
      */
    ["com.manut.pm.kanban.view.list"](): string;
    /**
      * `Edit project`
      */
    ["com.manut.pm.modal.editProject"](): string;
    /**
      * `Update the project name, description, or status.`
      */
    ["com.manut.pm.modal.editProject.description"](): string;
    /**
      * `Edit task`
      */
    ["com.manut.pm.modal.editTask"](): string;
    /**
      * `Update task details.`
      */
    ["com.manut.pm.modal.editTask.description"](): string;
    /**
      * `New project`
      */
    ["com.manut.pm.modal.newProject"](): string;
    /**
      * `Group tasks under a project.`
      */
    ["com.manut.pm.modal.newProject.description"](): string;
    /**
      * `Add task`
      */
    ["com.manut.pm.modal.newTask"](): string;
    /**
      * `Create a new task in this project.`
      */
    ["com.manut.pm.modal.newTask.description"](): string;
    /**
      * `High`
      */
    ["com.manut.pm.priority.high"](): string;
    /**
      * `Low`
      */
    ["com.manut.pm.priority.low"](): string;
    /**
      * `Medium`
      */
    ["com.manut.pm.priority.medium"](): string;
    /**
      * `No priority`
      */
    ["com.manut.pm.priority.none"](): string;
    /**
      * `Urgent`
      */
    ["com.manut.pm.priority.urgent"](): string;
    /**
      * `Active`
      */
    ["com.manut.pm.project.status.active"](): string;
    /**
      * `Archived`
      */
    ["com.manut.pm.project.status.archived"](): string;
    /**
      * `Track work for this workspace. Tasks live under projects you create.`
      */
    ["com.manut.pm.section.subtitle"](): string;
    /**
      * `Projects & tasks`
      */
    ["com.manut.pm.section.title"](): string;
    /**
      * `No tasks yet. Add the first one.`
      */
    ["com.manut.pm.task.empty"](): string;
    /**
      * `Hide tasks`
      */
    ["com.manut.pm.task.hide"](): string;
    /**
      * `Show tasks`
      */
    ["com.manut.pm.task.show"](): string;
    /**
      * `Backlog`
      */
    ["com.manut.pm.task.status.backlog"](): string;
    /**
      * `Cancelled`
      */
    ["com.manut.pm.task.status.cancelled"](): string;
    /**
      * `Done`
      */
    ["com.manut.pm.task.status.done"](): string;
    /**
      * `In progress`
      */
    ["com.manut.pm.task.status.inProgress"](): string;
    /**
      * `To do`
      */
    ["com.manut.pm.task.status.todo"](): string;
    /**
      * `Projects`
      */
    ["com.manut.pm.title"](): string;
    /**
      * `Mark done`
      */
    ["com.manut.reminders.action.markDone"](): string;
    /**
      * `New reminder`
      */
    ["com.manut.reminders.action.new"](): string;
    /**
      * `Due`
      */
    ["com.manut.reminders.card.dueAt"](): string;
    /**
      * `Nothing has been completed or cancelled yet.`
      */
    ["com.manut.reminders.empty.done"](): string;
    /**
      * `Nothing is due right now.`
      */
    ["com.manut.reminders.empty.due"](): string;
    /**
      * `No upcoming reminders. Create one to plan ahead.`
      */
    ["com.manut.reminders.empty.upcoming"](): string;
    /**
      * `Failed to cancel reminder.`
      */
    ["com.manut.reminders.error.cancel"](): string;
    /**
      * `Pick a valid due date and time.`
      */
    ["com.manut.reminders.error.invalidDate"](): string;
    /**
      * `Try again`
      */
    ["com.manut.reminders.error.retry"](): string;
    /**
      * `Body (optional)`
      */
    ["com.manut.reminders.field.body.label"](): string;
    /**
      * `Add context, links, or a checklist.`
      */
    ["com.manut.reminders.field.body.placeholder"](): string;
    /**
      * `We send the reminder at this time in your local timezone.`
      */
    ["com.manut.reminders.field.dueAt.hint"](): string;
    /**
      * `Due at`
      */
    ["com.manut.reminders.field.dueAt.label"](): string;
    /**
      * `Title`
      */
    ["com.manut.reminders.field.title.label"](): string;
    /**
      * `What should we remind you about?`
      */
    ["com.manut.reminders.field.title.placeholder"](): string;
    /**
      * `Cancel`
      */
    ["com.manut.reminders.modal.cancel"](): string;
    /**
      * `Email reminders fire at the due time you pick.`
      */
    ["com.manut.reminders.modal.description"](): string;
    /**
      * `Create reminder`
      */
    ["com.manut.reminders.modal.submit"](): string;
    /**
      * `New reminder`
      */
    ["com.manut.reminders.modal.title"](): string;
    /**
      * `Could not cancel reminder`
      */
    ["com.manut.reminders.notify.cancelled.error"](): string;
    /**
      * `Reminder cancelled`
      */
    ["com.manut.reminders.notify.cancelled.title"](): string;
    /**
      * `Reminder created`
      */
    ["com.manut.reminders.notify.created.title"](): string;
    /**
      * `Delete`
      */
    ["com.manut.reminders.rules.action.delete"](): string;
    /**
      * `Edit`
      */
    ["com.manut.reminders.rules.action.edit"](): string;
    /**
      * `New rule`
      */
    ["com.manut.reminders.rules.action.new"](): string;
    /**
      * `Email`
      */
    ["com.manut.reminders.rules.channel.email"](): string;
    /**
      * `In-app`
      */
    ["com.manut.reminders.rules.channel.inApp"](): string;
    /**
      * `Cancel`
      */
    ["com.manut.reminders.rules.delete.confirm.cancel"](): string;
    /**
      * `{{name}} will stop firing. This cannot be undone.`
      */
    ["com.manut.reminders.rules.delete.confirm.description"](options: {
        readonly name: string;
    }): string;
    /**
      * `Delete`
      */
    ["com.manut.reminders.rules.delete.confirm.submit"](): string;
    /**
      * `Delete rule?`
      */
    ["com.manut.reminders.rules.delete.confirm.title"](): string;
    /**
      * `Failed to delete rule.`
      */
    ["com.manut.reminders.rules.error.delete"](): string;
    /**
      * `Failed to save rule.`
      */
    ["com.manut.reminders.rules.error.submit"](): string;
    /**
      * `Failed to update rule.`
      */
    ["com.manut.reminders.rules.error.toggle"](): string;
    /**
      * `Reminder body`
      */
    ["com.manut.reminders.rules.field.body.label"](): string;
    /**
      * `Body sent when this rule fires.`
      */
    ["com.manut.reminders.rules.field.body.placeholder"](): string;
    /**
      * `Channel`
      */
    ["com.manut.reminders.rules.field.channel.label"](): string;
    /**
      * `Five fields: minute hour day-of-month month day-of-week. Example: 0 9 * * 1 fires every Monday at 9am.`
      */
    ["com.manut.reminders.rules.field.cron.hint"](): string;
    /**
      * `Cron expression`
      */
    ["com.manut.reminders.rules.field.cron.label"](): string;
    /**
      * `Enabled`
      */
    ["com.manut.reminders.rules.field.enabled.label"](): string;
    /**
      * `Frequency`
      */
    ["com.manut.reminders.rules.field.frequency.label"](): string;
    /**
      * `Day of month`
      */
    ["com.manut.reminders.rules.field.monthDay.label"](): string;
    /**
      * `Name`
      */
    ["com.manut.reminders.rules.field.name.label"](): string;
    /**
      * `What should this rule do?`
      */
    ["com.manut.reminders.rules.field.name.placeholder"](): string;
    /**
      * `Advanced (cron)`
      */
    ["com.manut.reminders.rules.field.recurrence.advanced"](): string;
    /**
      * `Recurrence`
      */
    ["com.manut.reminders.rules.field.recurrence.label"](): string;
    /**
      * `Preset`
      */
    ["com.manut.reminders.rules.field.recurrence.preset"](): string;
    /**
      * `Invalid recurrence — fix the cron expression to continue.`
      */
    ["com.manut.reminders.rules.field.summary.invalid"](): string;
    /**
      * `Summary`
      */
    ["com.manut.reminders.rules.field.summary.label"](): string;
    /**
      * `Time`
      */
    ["com.manut.reminders.rules.field.time.label"](): string;
    /**
      * `Day of week`
      */
    ["com.manut.reminders.rules.field.weekday.label"](): string;
    /**
      * `Daily`
      */
    ["com.manut.reminders.rules.frequency.daily"](): string;
    /**
      * `Monthly`
      */
    ["com.manut.reminders.rules.frequency.monthly"](): string;
    /**
      * `Weekly`
      */
    ["com.manut.reminders.rules.frequency.weekly"](): string;
    /**
      * `No rules yet. Create one to start firing reminders on a schedule.`
      */
    ["com.manut.reminders.rules.list.empty"](): string;
    /**
      * `Last run:`
      */
    ["com.manut.reminders.rules.list.lastRun"](): string;
    /**
      * `Never`
      */
    ["com.manut.reminders.rules.list.never"](): string;
    /**
      * `Next run:`
      */
    ["com.manut.reminders.rules.list.nextRun"](): string;
    /**
      * `No schedule configured.`
      */
    ["com.manut.reminders.rules.list.noSchedule"](): string;
    /**
      * `Unknown`
      */
    ["com.manut.reminders.rules.list.unknown"](): string;
    /**
      * `Cancel`
      */
    ["com.manut.reminders.rules.modal.cancel"](): string;
    /**
      * `Create rule`
      */
    ["com.manut.reminders.rules.modal.create"](): string;
    /**
      * `New rule`
      */
    ["com.manut.reminders.rules.modal.create.title"](): string;
    /**
      * `Reminder rules fire repeatedly on a schedule you control.`
      */
    ["com.manut.reminders.rules.modal.description"](): string;
    /**
      * `Edit rule`
      */
    ["com.manut.reminders.rules.modal.edit.title"](): string;
    /**
      * `Save changes`
      */
    ["com.manut.reminders.rules.modal.save"](): string;
    /**
      * `Rule created`
      */
    ["com.manut.reminders.rules.notify.created.title"](): string;
    /**
      * `Could not delete rule`
      */
    ["com.manut.reminders.rules.notify.deleted.error"](): string;
    /**
      * `Rule deleted`
      */
    ["com.manut.reminders.rules.notify.deleted.title"](): string;
    /**
      * `Could not toggle rule`
      */
    ["com.manut.reminders.rules.notify.toggle.error"](): string;
    /**
      * `Rule updated`
      */
    ["com.manut.reminders.rules.notify.updated.title"](): string;
    /**
      * `Friday`
      */
    ["com.manut.reminders.rules.weekday.friday"](): string;
    /**
      * `Monday`
      */
    ["com.manut.reminders.rules.weekday.monday"](): string;
    /**
      * `Saturday`
      */
    ["com.manut.reminders.rules.weekday.saturday"](): string;
    /**
      * `Sunday`
      */
    ["com.manut.reminders.rules.weekday.sunday"](): string;
    /**
      * `Thursday`
      */
    ["com.manut.reminders.rules.weekday.thursday"](): string;
    /**
      * `Tuesday`
      */
    ["com.manut.reminders.rules.weekday.tuesday"](): string;
    /**
      * `Wednesday`
      */
    ["com.manut.reminders.rules.weekday.wednesday"](): string;
    /**
      * `Cancelled`
      */
    ["com.manut.reminders.status.cancelled"](): string;
    /**
      * `Done`
      */
    ["com.manut.reminders.status.completed"](): string;
    /**
      * `Due now`
      */
    ["com.manut.reminders.status.due"](): string;
    /**
      * `Failed`
      */
    ["com.manut.reminders.status.failed"](): string;
    /**
      * `Scheduled`
      */
    ["com.manut.reminders.status.scheduled"](): string;
    /**
      * `Done & Cancelled`
      */
    ["com.manut.reminders.tab.done"](): string;
    /**
      * `Due now`
      */
    ["com.manut.reminders.tab.due"](): string;
    /**
      * `Rules`
      */
    ["com.manut.reminders.tab.rules"](): string;
    /**
      * `Upcoming`
      */
    ["com.manut.reminders.tab.upcoming"](): string;
    /**
      * `Reminder filters`
      */
    ["com.manut.reminders.tabs.label"](): string;
    /**
      * `Reminders`
      */
    ["com.manut.reminders.title"](): string;
    /**
      * `core`
      */
    core(): string;
    /**
      * `created at {{time}}`
      */
    ["created at"](options: {
        readonly time: string;
    }): string;
    /**
      * `current`
      */
    current(): string;
    /**
      * `Dark`
      */
    dark(): string;
    /**
      * `Do not show this again`
      */
    ["do-not-show-this-again"](): string;
    /**
      * `Insufficient team seat`
      */
    ["insufficient-team-seat"](): string;
    /**
      * `invited you to join`
      */
    ["invited you to join"](): string;
    /**
      * `Light`
      */
    light(): string;
    /**
      * `Others`
      */
    others(): string;
    /**
      * `Switch view`
      */
    switchView(): string;
    /**
      * `System`
      */
    system(): string;
    /**
      * `Tips`
      */
    tips(): string;
    /**
      * `unnamed`
      */
    unnamed(): string;
    /**
      * `last updated at {{time}}`
      */
    ["updated at"](options: {
        readonly time: string;
    }): string;
    /**
      * `Please upgrade to the latest version of Chrome for the best experience.`
      */
    upgradeBrowser(): string;
    /**
      * `An internal error occurred.`
      */
    ["error.INTERNAL_SERVER_ERROR"](): string;
    /**
      * `Network error.`
      */
    ["error.NETWORK_ERROR"](): string;
    /**
      * `Too many requests.`
      */
    ["error.TOO_MANY_REQUEST"](): string;
    /**
      * `Resource not found.`
      */
    ["error.NOT_FOUND"](): string;
    /**
      * `Bad request.`
      */
    ["error.BAD_REQUEST"](): string;
    /**
      * `GraphQL bad request, code: {{code}}, {{message}}`
      */
    ["error.GRAPHQL_BAD_REQUEST"](options: Readonly<{
        code: string;
        message: string;
    }>): string;
    /**
      * `HTTP request error, message: {{message}}`
      */
    ["error.HTTP_REQUEST_ERROR"](options: {
        readonly message: string;
    }): string;
    /**
      * `Invalid URL`
      */
    ["error.SSRF_BLOCKED_ERROR"](): string;
    /**
      * `Response too large ({{receivedBytes}} bytes), limit is {{limitBytes}} bytes`
      */
    ["error.RESPONSE_TOO_LARGE_ERROR"](options: Readonly<{
        receivedBytes: string;
        limitBytes: string;
    }>): string;
    /**
      * `Email service is not configured.`
      */
    ["error.EMAIL_SERVICE_NOT_CONFIGURED"](): string;
    /**
      * `Image format not supported: {{format}}`
      */
    ["error.IMAGE_FORMAT_NOT_SUPPORTED"](options: {
        readonly format: string;
    }): string;
    /**
      * `Query is too long, max length is {{max}}.`
      */
    ["error.QUERY_TOO_LONG"](options: {
        readonly max: string;
    }): string;
    /**
      * `Validation error, errors: {{errors}}`
      */
    ["error.VALIDATION_ERROR"](options: {
        readonly errors: string;
    }): string;
    /**
      * `User not found.`
      */
    ["error.USER_NOT_FOUND"](): string;
    /**
      * `User avatar not found.`
      */
    ["error.USER_AVATAR_NOT_FOUND"](): string;
    /**
      * `This email has already been registered.`
      */
    ["error.EMAIL_ALREADY_USED"](): string;
    /**
      * `You are trying to update your account email to the same as the old one.`
      */
    ["error.SAME_EMAIL_PROVIDED"](): string;
    /**
      * `Wrong user email or password: {{email}}`
      */
    ["error.WRONG_SIGN_IN_CREDENTIALS"](options: {
        readonly email: string;
    }): string;
    /**
      * `Unknown authentication provider {{name}}.`
      */
    ["error.UNKNOWN_OAUTH_PROVIDER"](options: {
        readonly name: string;
    }): string;
    /**
      * `OAuth state expired, please try again.`
      */
    ["error.OAUTH_STATE_EXPIRED"](): string;
    /**
      * `Invalid callback state parameter.`
      */
    ["error.INVALID_OAUTH_CALLBACK_STATE"](): string;
    /**
      * `Invalid callback code parameter, provider response status: {{status}} and body: {{body}}.`
      */
    ["error.INVALID_OAUTH_CALLBACK_CODE"](options: Readonly<{
        status: string;
        body: string;
    }>): string;
    /**
      * `Invalid auth state. You might start the auth progress from another device.`
      */
    ["error.INVALID_AUTH_STATE"](): string;
    /**
      * `Missing query parameter `{{name}}`.`
      */
    ["error.MISSING_OAUTH_QUERY_PARAMETER"](options: {
        readonly name: string;
    }): string;
    /**
      * `The third-party account has already been connected to another user.`
      */
    ["error.OAUTH_ACCOUNT_ALREADY_CONNECTED"](): string;
    /**
      * `Invalid OAuth response: {{reason}}.`
      */
    ["error.INVALID_OAUTH_RESPONSE"](options: {
        readonly reason: string;
    }): string;
    /**
      * `An invalid email provided: {{email}}`
      */
    ["error.INVALID_EMAIL"](options: {
        readonly email: string;
    }): string;
    /**
      * `Password must be between {{min}} and {{max}} characters`
      */
    ["error.INVALID_PASSWORD_LENGTH"](options: Readonly<{
        min: string;
        max: string;
    }>): string;
    /**
      * `Password is required.`
      */
    ["error.PASSWORD_REQUIRED"](): string;
    /**
      * `You are trying to sign in by a different method than you signed up with.`
      */
    ["error.WRONG_SIGN_IN_METHOD"](): string;
    /**
      * `You are not allowed to sign up.`
      */
    ["error.SIGN_UP_FORBIDDEN"](): string;
    /**
      * `The email token provided is not found.`
      */
    ["error.EMAIL_TOKEN_NOT_FOUND"](): string;
    /**
      * `An invalid email token provided.`
      */
    ["error.INVALID_EMAIL_TOKEN"](): string;
    /**
      * `The link has expired.`
      */
    ["error.LINK_EXPIRED"](): string;
    /**
      * `You must sign in first to access this resource.`
      */
    ["error.AUTHENTICATION_REQUIRED"](): string;
    /**
      * `You are not allowed to perform this action.`
      */
    ["error.ACTION_FORBIDDEN"](): string;
    /**
      * `You do not have permission to access this resource.`
      */
    ["error.ACCESS_DENIED"](): string;
    /**
      * `You must verify your email before accessing this resource.`
      */
    ["error.EMAIL_VERIFICATION_REQUIRED"](): string;
    /**
      * `Space {{spaceId}} permission not found.`
      */
    ["error.WORKSPACE_PERMISSION_NOT_FOUND"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `Space {{spaceId}} not found.`
      */
    ["error.SPACE_NOT_FOUND"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `Member not found in Space {{spaceId}}.`
      */
    ["error.MEMBER_NOT_FOUND_IN_SPACE"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `You should join in Space {{spaceId}} before broadcasting messages.`
      */
    ["error.NOT_IN_SPACE"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `You have already joined in Space {{spaceId}}.`
      */
    ["error.ALREADY_IN_SPACE"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `You do not have permission to access Space {{spaceId}}.`
      */
    ["error.SPACE_ACCESS_DENIED"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `Owner of Space {{spaceId}} not found.`
      */
    ["error.SPACE_OWNER_NOT_FOUND"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `Space should have only one owner.`
      */
    ["error.SPACE_SHOULD_HAVE_ONLY_ONE_OWNER"](): string;
    /**
      * `Owner can not leave the workspace.`
      */
    ["error.OWNER_CAN_NOT_LEAVE_WORKSPACE"](): string;
    /**
      * `You can not revoke your own permission.`
      */
    ["error.CAN_NOT_REVOKE_YOURSELF"](): string;
    /**
      * `Doc {{docId}} under Space {{spaceId}} not found.`
      */
    ["error.DOC_NOT_FOUND"](options: Readonly<{
        docId: string;
        spaceId: string;
    }>): string;
    /**
      * `You do not have permission to perform {{action}} action on doc {{docId}}.`
      */
    ["error.DOC_ACTION_DENIED"](options: Readonly<{
        action: string;
        docId: string;
    }>): string;
    /**
      * `Doc {{docId}} under Space {{spaceId}} is blocked from updating.`
      */
    ["error.DOC_UPDATE_BLOCKED"](options: Readonly<{
        docId: string;
        spaceId: string;
    }>): string;
    /**
      * `Your client with version {{version}} is rejected by remote sync server. Please upgrade to {{serverVersion}}.`
      */
    ["error.VERSION_REJECTED"](options: Readonly<{
        version: string;
        serverVersion: string;
    }>): string;
    /**
      * `Invalid doc history timestamp provided.`
      */
    ["error.INVALID_HISTORY_TIMESTAMP"](): string;
    /**
      * `History of {{docId}} at {{timestamp}} under Space {{spaceId}}.`
      */
    ["error.DOC_HISTORY_NOT_FOUND"](options: Readonly<{
        docId: string;
        timestamp: string;
        spaceId: string;
    }>): string;
    /**
      * `Blob {{blobId}} not found in Space {{spaceId}}.`
      */
    ["error.BLOB_NOT_FOUND"](options: Readonly<{
        blobId: string;
        spaceId: string;
    }>): string;
    /**
      * `Blob is invalid.`
      */
    ["error.BLOB_INVALID"](): string;
    /**
      * `Expected to publish a doc, not a Space.`
      */
    ["error.EXPECT_TO_PUBLISH_DOC"](): string;
    /**
      * `Expected to revoke a public doc, not a Space.`
      */
    ["error.EXPECT_TO_REVOKE_PUBLIC_DOC"](): string;
    /**
      * `Expect grant roles on doc {{docId}} under Space {{spaceId}}, not a Space.`
      */
    ["error.EXPECT_TO_GRANT_DOC_USER_ROLES"](options: Readonly<{
        docId: string;
        spaceId: string;
    }>): string;
    /**
      * `Expect revoke roles on doc {{docId}} under Space {{spaceId}}, not a Space.`
      */
    ["error.EXPECT_TO_REVOKE_DOC_USER_ROLES"](options: Readonly<{
        docId: string;
        spaceId: string;
    }>): string;
    /**
      * `Expect update roles on doc {{docId}} under Space {{spaceId}}, not a Space.`
      */
    ["error.EXPECT_TO_UPDATE_DOC_USER_ROLE"](options: Readonly<{
        docId: string;
        spaceId: string;
    }>): string;
    /**
      * `Doc is not public.`
      */
    ["error.DOC_IS_NOT_PUBLIC"](): string;
    /**
      * `Failed to store doc updates.`
      */
    ["error.FAILED_TO_SAVE_UPDATES"](): string;
    /**
      * `Failed to store doc snapshot.`
      */
    ["error.FAILED_TO_UPSERT_SNAPSHOT"](): string;
    /**
      * `A Team workspace is required to perform this action.`
      */
    ["error.ACTION_FORBIDDEN_ON_NON_TEAM_WORKSPACE"](): string;
    /**
      * `Doc default role can not be owner.`
      */
    ["error.DOC_DEFAULT_ROLE_CAN_NOT_BE_OWNER"](): string;
    /**
      * `Can not batch grant doc owner permissions.`
      */
    ["error.CAN_NOT_BATCH_GRANT_DOC_OWNER_PERMISSIONS"](): string;
    /**
      * `Can not set a non-active member as owner.`
      */
    ["error.NEW_OWNER_IS_NOT_ACTIVE_MEMBER"](): string;
    /**
      * `Invalid invitation provided.`
      */
    ["error.INVALID_INVITATION"](): string;
    /**
      * `No more seat available in the Space {{spaceId}}.`
      */
    ["error.NO_MORE_SEAT"](options: {
        readonly spaceId: string;
    }): string;
    /**
      * `Unsupported subscription plan: {{plan}}.`
      */
    ["error.UNSUPPORTED_SUBSCRIPTION_PLAN"](options: {
        readonly plan: string;
    }): string;
    /**
      * `Failed to create checkout session.`
      */
    ["error.FAILED_TO_CHECKOUT"](): string;
    /**
      * `Invalid checkout parameters provided.`
      */
    ["error.INVALID_CHECKOUT_PARAMETERS"](): string;
    /**
      * `You have already subscribed to the {{plan}} plan.`
      */
    ["error.SUBSCRIPTION_ALREADY_EXISTS"](options: {
        readonly plan: string;
    }): string;
    /**
      * `Invalid subscription parameters provided.`
      */
    ["error.INVALID_SUBSCRIPTION_PARAMETERS"](): string;
    /**
      * `You didn't subscribe to the {{plan}} plan.`
      */
    ["error.SUBSCRIPTION_NOT_EXISTS"](options: {
        readonly plan: string;
    }): string;
    /**
      * `Your subscription has already been canceled.`
      */
    ["error.SUBSCRIPTION_HAS_BEEN_CANCELED"](): string;
    /**
      * `Your subscription has not been canceled.`
      */
    ["error.SUBSCRIPTION_HAS_NOT_BEEN_CANCELED"](): string;
    /**
      * `Your subscription has expired.`
      */
    ["error.SUBSCRIPTION_EXPIRED"](): string;
    /**
      * `Your subscription has already been in {{recurring}} recurring state.`
      */
    ["error.SAME_SUBSCRIPTION_RECURRING"](options: {
        readonly recurring: string;
    }): string;
    /**
      * `Failed to create customer portal session.`
      */
    ["error.CUSTOMER_PORTAL_CREATE_FAILED"](): string;
    /**
      * `You are trying to access a unknown subscription plan.`
      */
    ["error.SUBSCRIPTION_PLAN_NOT_FOUND"](): string;
    /**
      * `You cannot update an onetime payment subscription.`
      */
    ["error.CANT_UPDATE_ONETIME_PAYMENT_SUBSCRIPTION"](): string;
    /**
      * `A workspace is required to checkout for team subscription.`
      */
    ["error.WORKSPACE_ID_REQUIRED_FOR_TEAM_SUBSCRIPTION"](): string;
    /**
      * `Workspace id is required to update team subscription.`
      */
    ["error.WORKSPACE_ID_REQUIRED_TO_UPDATE_TEAM_SUBSCRIPTION"](): string;
    /**
      * `This subscription is managed by App Store or Google Play. Please manage it in the corresponding store.`
      */
    ["error.MANAGED_BY_APP_STORE_OR_PLAY"](): string;
    /**
      * `Calendar provider request error, status: {{status}}, message: {{message}}`
      */
    ["error.CALENDAR_PROVIDER_REQUEST_ERROR"](options: Readonly<{
        status: string;
        message: string;
    }>): string;
    /**
      * `Copilot session not found.`
      */
    ["error.COPILOT_SESSION_NOT_FOUND"](): string;
    /**
      * `Copilot session input is invalid.`
      */
    ["error.COPILOT_SESSION_INVALID_INPUT"](): string;
    /**
      * `Copilot session has been deleted.`
      */
    ["error.COPILOT_SESSION_DELETED"](): string;
    /**
      * `No copilot provider available: {{modelId}}`
      */
    ["error.NO_COPILOT_PROVIDER_AVAILABLE"](options: {
        readonly modelId: string;
    }): string;
    /**
      * `Failed to generate text.`
      */
    ["error.COPILOT_FAILED_TO_GENERATE_TEXT"](): string;
    /**
      * `Failed to generate embedding with {{provider}}: {{message}}`
      */
    ["error.COPILOT_FAILED_TO_GENERATE_EMBEDDING"](options: Readonly<{
        provider: string;
        message: string;
    }>): string;
    /**
      * `Failed to create chat message.`
      */
    ["error.COPILOT_FAILED_TO_CREATE_MESSAGE"](): string;
    /**
      * `Unsplash is not configured.`
      */
    ["error.UNSPLASH_IS_NOT_CONFIGURED"](): string;
    /**
      * `Action has been taken, no more messages allowed.`
      */
    ["error.COPILOT_ACTION_TAKEN"](): string;
    /**
      * `Doc {{docId}} not found.`
      */
    ["error.COPILOT_DOC_NOT_FOUND"](options: {
        readonly docId: string;
    }): string;
    /**
      * `Some docs not found.`
      */
    ["error.COPILOT_DOCS_NOT_FOUND"](): string;
    /**
      * `Copilot message {{messageId}} not found.`
      */
    ["error.COPILOT_MESSAGE_NOT_FOUND"](options: {
        readonly messageId: string;
    }): string;
    /**
      * `Copilot prompt {{name}} not found.`
      */
    ["error.COPILOT_PROMPT_NOT_FOUND"](options: {
        readonly name: string;
    }): string;
    /**
      * `Copilot prompt is invalid.`
      */
    ["error.COPILOT_PROMPT_INVALID"](): string;
    /**
      * `Copilot provider {{provider}} does not support output type {{kind}}`
      */
    ["error.COPILOT_PROVIDER_NOT_SUPPORTED"](options: Readonly<{
        provider: string;
        kind: string;
    }>): string;
    /**
      * `Provider {{provider}} failed with {{kind}} error: {{message}}`
      */
    ["error.COPILOT_PROVIDER_SIDE_ERROR"](options: Readonly<{
        provider: string;
        kind: string;
        message: string;
    }>): string;
    /**
      * `Invalid copilot context {{contextId}}.`
      */
    ["error.COPILOT_INVALID_CONTEXT"](options: {
        readonly contextId: string;
    }): string;
    /**
      * `File {{fileName}} is not supported to use as context: {{message}}`
      */
    ["error.COPILOT_CONTEXT_FILE_NOT_SUPPORTED"](options: Readonly<{
        fileName: string;
        message: string;
    }>): string;
    /**
      * `Failed to modify context {{contextId}}: {{message}}`
      */
    ["error.COPILOT_FAILED_TO_MODIFY_CONTEXT"](options: Readonly<{
        contextId: string;
        message: string;
    }>): string;
    /**
      * `Failed to match context {{contextId}} with "%7B%7Bcontent%7D%7D": {{message}}`
      */
    ["error.COPILOT_FAILED_TO_MATCH_CONTEXT"](options: Readonly<{
        contextId: string;
        message: string;
    }>): string;
    /**
      * `Failed to match context in workspace {{workspaceId}} with "%7B%7Bcontent%7D%7D": {{message}}`
      */
    ["error.COPILOT_FAILED_TO_MATCH_GLOBAL_CONTEXT"](options: Readonly<{
        workspaceId: string;
        message: string;
    }>): string;
    /**
      * `Embedding feature is disabled, please contact the administrator to enable it in the workspace settings.`
      */
    ["error.COPILOT_EMBEDDING_DISABLED"](): string;
    /**
      * `Embedding feature not available, you may need to install pgvector extension to your database`
      */
    ["error.COPILOT_EMBEDDING_UNAVAILABLE"](): string;
    /**
      * `Transcription job already exists`
      */
    ["error.COPILOT_TRANSCRIPTION_JOB_EXISTS"](): string;
    /**
      * `Transcription job not found.`
      */
    ["error.COPILOT_TRANSCRIPTION_JOB_NOT_FOUND"](): string;
    /**
      * `Audio not provided.`
      */
    ["error.COPILOT_TRANSCRIPTION_AUDIO_NOT_PROVIDED"](): string;
    /**
      * `Failed to add workspace file embedding: {{message}}`
      */
    ["error.COPILOT_FAILED_TO_ADD_WORKSPACE_FILE_EMBEDDING"](options: {
        readonly message: string;
    }): string;
    /**
      * `You have exceeded your blob size quota.`
      */
    ["error.BLOB_QUOTA_EXCEEDED"](): string;
    /**
      * `You have exceeded your storage quota.`
      */
    ["error.STORAGE_QUOTA_EXCEEDED"](): string;
    /**
      * `You have exceeded your workspace member quota.`
      */
    ["error.MEMBER_QUOTA_EXCEEDED"](): string;
    /**
      * `You have reached the limit of actions in this workspace, please upgrade your plan.`
      */
    ["error.COPILOT_QUOTA_EXCEEDED"](): string;
    /**
      * `Runtime config {{key}} not found.`
      */
    ["error.RUNTIME_CONFIG_NOT_FOUND"](options: {
        readonly key: string;
    }): string;
    /**
      * `Invalid runtime config type  for '{{key}}', want '{{want}}', but get {{get}}.`
      */
    ["error.INVALID_RUNTIME_CONFIG_TYPE"](options: Readonly<{
        key: string;
        want: string;
        get: string;
    }>): string;
    /**
      * `Mailer service is not configured.`
      */
    ["error.MAILER_SERVICE_IS_NOT_CONFIGURED"](): string;
    /**
      * `Cannot delete all admin accounts.`
      */
    ["error.CANNOT_DELETE_ALL_ADMIN_ACCOUNT"](): string;
    /**
      * `Cannot delete own account.`
      */
    ["error.CANNOT_DELETE_OWN_ACCOUNT"](): string;
    /**
      * `Cannot delete account. You are the owner of one or more team workspaces. Please transfer ownership or delete them first.`
      */
    ["error.CANNOT_DELETE_ACCOUNT_WITH_OWNED_TEAM_WORKSPACE"](): string;
    /**
      * `Captcha verification failed.`
      */
    ["error.CAPTCHA_VERIFICATION_FAILED"](): string;
    /**
      * `Invalid session id to generate license key.`
      */
    ["error.INVALID_LICENSE_SESSION_ID"](): string;
    /**
      * `License key has been revealed. Please check your mail box of the one provided during checkout.`
      */
    ["error.LICENSE_REVEALED"](): string;
    /**
      * `Workspace already has a license applied.`
      */
    ["error.WORKSPACE_LICENSE_ALREADY_EXISTS"](): string;
    /**
      * `License not found.`
      */
    ["error.LICENSE_NOT_FOUND"](): string;
    /**
      * `Invalid license to activate. {{reason}}`
      */
    ["error.INVALID_LICENSE_TO_ACTIVATE"](options: {
        readonly reason: string;
    }): string;
    /**
      * `Invalid license update params. {{reason}}`
      */
    ["error.INVALID_LICENSE_UPDATE_PARAMS"](options: {
        readonly reason: string;
    }): string;
    /**
      * `License has expired.`
      */
    ["error.LICENSE_EXPIRED"](): string;
    /**
      * `Unsupported client with version [{{clientVersion}}], required version is [{{requiredVersion}}].`
      */
    ["error.UNSUPPORTED_CLIENT_VERSION"](options: Readonly<{
        clientVersion: string;
        requiredVersion: string;
    }>): string;
    /**
      * `Notification not found.`
      */
    ["error.NOTIFICATION_NOT_FOUND"](): string;
    /**
      * `Mentioned user can not access doc {{docId}}.`
      */
    ["error.MENTION_USER_DOC_ACCESS_DENIED"](options: {
        readonly docId: string;
    }): string;
    /**
      * `You can not mention yourself.`
      */
    ["error.MENTION_USER_ONESELF_DENIED"](): string;
    /**
      * `Invalid app config for module `{{module}}` with key `{{key}}`. {{hint}}.`
      */
    ["error.INVALID_APP_CONFIG"](options: Readonly<{
        module: string;
        key: string;
        hint: string;
    }>): string;
    /**
      * `Invalid app config input: {{message}}`
      */
    ["error.INVALID_APP_CONFIG_INPUT"](options: {
        readonly message: string;
    }): string;
    /**
      * `Search provider not found.`
      */
    ["error.SEARCH_PROVIDER_NOT_FOUND"](): string;
    /**
      * `Invalid request argument to search provider: {{reason}}`
      */
    ["error.INVALID_SEARCH_PROVIDER_REQUEST"](options: {
        readonly reason: string;
    }): string;
    /**
      * `Invalid indexer input: {{reason}}`
      */
    ["error.INVALID_INDEXER_INPUT"](options: {
        readonly reason: string;
    }): string;
    /**
      * `Comment not found.`
      */
    ["error.COMMENT_NOT_FOUND"](): string;
    /**
      * `Reply not found.`
      */
    ["error.REPLY_NOT_FOUND"](): string;
    /**
      * `Comment attachment not found.`
      */
    ["error.COMMENT_ATTACHMENT_NOT_FOUND"](): string;
    /**
      * `You have exceeded the comment attachment size quota.`
      */
    ["error.COMMENT_ATTACHMENT_QUOTA_EXCEEDED"](): string;
} { const { t } = useTranslation(); return useMemo(() => createProxy((key) => t.bind(null, key)), [t]); }
function createComponent(i18nKey: string) {
    return (props) => createElement(Trans, { i18nKey, shouldUnescape: true, ...props });
}
export const TypedTrans: {
    /**
      * `Go to <a>{{link}}</a> for learn more details about Manut AI.`
      */
    ["com.affine.ai-onboarding.general.5.description"]: ComponentType<TypedTransProps<{
        readonly link: string;
    }, {
        a: JSX.Element;
    }>>;
    /**
      * `By continuing, you are agreeing to our <a>AI Terms</a>.`
      */
    ["com.affine.ai-onboarding.general.privacy"]: ComponentType<TypedTransProps<Readonly<{}>, {
        a: JSX.Element;
    }>>;
    /**
      * `Please contact <1>{{user}}</1> to upgrade AI rights or resend the attachment.`
      */
    ["com.affine.audio.transcribe.non-owner.confirm.message"]: ComponentType<TypedTransProps<{
        readonly user: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `This doc is now opened in <1>Manut</1> app`
      */
    ["com.affine.auth.open.affine.open-doc-prompt"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Opening <1>Manut</1> app now`
      */
    ["com.affine.auth.open.affine.prompt"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `To continue signing in, please enter the code that was sent to <a>{{email}}</a>.`
      */
    ["com.affine.auth.sign.auth.code.hint"]: ComponentType<TypedTransProps<{
        readonly email: string;
    }, {
        a: JSX.Element;
    }>>;
    /**
      * `Or <1>sign in with password</1> instead.`
      */
    ["com.affine.auth.sign.auth.code.message.password"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `By clicking “Continue with Google/Email” above, you acknowledge that you agree to Manut's <1>Terms of Conditions</1> and <3>Privacy Policy</3>.`
      */
    ["com.affine.auth.sign.message"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
        ["3"]: JSX.Element;
    }>>;
    /**
      * `This demo is limited. <1>Download the Manut Client</1> for the latest features and Performance.`
      */
    ["com.affine.banner.content"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> selected`
    
      * - com.affine.collection.toolbar.selected_one: `<0>{{count}}</0> collection selected`
    
      * - com.affine.collection.toolbar.selected_other: `<0>{{count}}</0> collection(s) selected`
      */
    ["com.affine.collection.toolbar.selected"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> collection selected`
      */
    ["com.affine.collection.toolbar.selected_one"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> collection(s) selected`
      */
    ["com.affine.collection.toolbar.selected_other"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> collection(s) selected`
      */
    ["com.affine.collection.toolbar.selected_others"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `Deleting <1>{{tag}}</1> cannot be undone, please proceed with caution.`
      */
    ["com.affine.delete-tags.confirm.description"]: ComponentType<TypedTransProps<{
        readonly tag: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Selected <1>{{selectedCount}}</1>, filtered <3>{{filteredCount}}</3>`
      */
    ["com.affine.editCollection.rules.countTips"]: ComponentType<TypedTransProps<Readonly<{
        selectedCount: string;
        filteredCount: string;
    }>, {
        ["1"]: JSX.Element;
        ["3"]: JSX.Element;
    }>>;
    /**
      * `Showing <1>{{count}}</1> docs.`
      */
    ["com.affine.editCollection.rules.countTips.more"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Showing <1>{{count}}</1> doc.`
      */
    ["com.affine.editCollection.rules.countTips.one"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Showing <1>{{count}}</1> docs.`
      */
    ["com.affine.editCollection.rules.countTips.zero"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Please <1>add rules</1> to save this collection or switch to <3>Docs</3>, use manual selection mode`
      */
    ["com.affine.editCollection.rules.empty.noRules.tips"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
        ["3"]: JSX.Element;
    }>>;
    /**
      * `Docs that meet the rules will be added to the current collection <2>{{highlight}}</2>`
      */
    ["com.affine.editCollection.rules.tips"]: ComponentType<TypedTransProps<{
        readonly highlight: string;
    }, {
        ["2"]: JSX.Element;
    }>>;
    /**
      * `If you are still experiencing this issue, please <1>contact us through the community</1>.`
      */
    ["com.affine.error.contact-us"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Unable to join <1/> <2>{{workspaceName}}</2> due to insufficient seats available.`
      */
    ["com.affine.fail-to-join-workspace.description-1"]: ComponentType<TypedTransProps<{
        readonly workspaceName: string;
    }, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `Unable to process your request to join <1/> <2>{{workspaceName}}</2> with <3>{{userEmail}}</3>, the workspace has reached its member limit. Please contact the workspace owner for available seats.`
      */
    ["com.affine.failed-to-send-request.description"]: ComponentType<TypedTransProps<Readonly<{
        workspaceName: string;
        userEmail: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
        ["3"]: JSX.Element;
    }>>;
    /**
      * `With the workspace creator's free account, every member can access up to <1>7 days<1> of version history.`
      */
    ["com.affine.history.confirm-restore-modal.free-plan-prompt.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `With the workspace creator's Pro account, every member enjoys the privilege of accessing up to <1>30 days<1> of version history.`
      */
    ["com.affine.history.confirm-restore-modal.pro-plan-prompt.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Import your Readwise highlights to Manut. Please visit Readwise, <br />click <a>"Get Access Token"</a>, and paste the token below.`
      */
    ["com.affine.integration.readwise.connect.desc"]: ComponentType<TypedTransProps<Readonly<{}>, {
        br: JSX.Element;
        a: JSX.Element;
    }>>;
    /**
      * `Updates to be imported since last successful import on {{lastImportedAt}} <a>Import everything instead</a>`
      */
    ["com.affine.integration.readwise.import.desc-from-last"]: ComponentType<TypedTransProps<{
        readonly lastImportedAt: string;
    }, {
        a: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> commented in <2>{{docTitle}}</2>`
      */
    ["com.affine.notification.comment"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        docTitle: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> mentioned you in a comment in <2>{{docTitle}}</2>`
      */
    ["com.affine.notification.comment-mention"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        docTitle: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `AI usage in <1>{{workspaceName}}</1> reached <3>{{spent}}</3> of the <4>{{cap}}</4> monthly cap. New AI requests will pause once the cap is hit.`
      */
    ["com.affine.notification.budget-soft-cap"]: ComponentType<TypedTransProps<Readonly<{
        workspaceName: string;
        spent: string;
        cap: string;
    }>, {
        ["1"]: JSX.Element;
        ["3"]: JSX.Element;
        ["4"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> invited you to join <2>{{workspaceName}}</2>`
      */
    ["com.affine.notification.invitation"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        workspaceName: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> has accepted your invitation`
      */
    ["com.affine.notification.invitation-accepted"]: ComponentType<TypedTransProps<{
        readonly username: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `There is an issue regarding your invitation to <1>{{workspaceName}}</1> `
      */
    ["com.affine.notification.invitation-blocked"]: ComponentType<TypedTransProps<{
        readonly workspaceName: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> has approved your request to join <2>{{workspaceName}}</2>`
      */
    ["com.affine.notification.invitation-review-approved"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        workspaceName: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> has declined your request to join <2>{{workspaceName}}</2>`
      */
    ["com.affine.notification.invitation-review-declined"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        workspaceName: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> has requested to join <2>{{workspaceName}}</2>`
      */
    ["com.affine.notification.invitation-review-request"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        workspaceName: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `<1>{{username}}</1> mentioned you in <2>{{docTitle}}</2>`
      */
    ["com.affine.notification.mention"]: ComponentType<TypedTransProps<Readonly<{
        username: string;
        docTitle: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `Don't have the app? <1>Click to download</1>.`
      */
    ["com.affine.open-in-app.card.subtitle"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> selected`
    
      * - com.affine.page.toolbar.selected_one: `<0>{{count}}</0> doc selected`
    
      * - com.affine.page.toolbar.selected_other: `<0>{{count}}</0> doc(s) selected`
      */
    ["com.affine.page.toolbar.selected"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> doc selected`
      */
    ["com.affine.page.toolbar.selected_one"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> doc(s) selected`
      */
    ["com.affine.page.toolbar.selected_other"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> doc(s) selected`
      */
    ["com.affine.page.toolbar.selected_others"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `You are currently on the <a>free plan</a>.`
      */
    ["com.affine.payment.billing-setting.ai.free-desc"]: ComponentType<TypedTransProps<Readonly<{}>, {
        a: JSX.Element;
    }>>;
    /**
      * `You have purchased <a>Believer plan</a>. Enjoy with your benefits!`
      */
    ["com.affine.payment.billing-setting.believer.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        a: JSX.Element;
    }>>;
    /**
      * `You are currently on the <1>{{planName}} plan</1>.`
      */
    ["com.affine.payment.billing-setting.current-plan.description"]: ComponentType<TypedTransProps<{
        readonly planName: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `You are currently on the believer <1>{{planName}} plan</1>.`
      */
    ["com.affine.payment.billing-setting.current-plan.description.lifetime"]: ComponentType<TypedTransProps<{
        readonly planName: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `You are currently on the monthly <1>{{planName}} plan</1>.`
      */
    ["com.affine.payment.billing-setting.current-plan.description.monthly"]: ComponentType<TypedTransProps<{
        readonly planName: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `You are currently on the annually <1>{{planName}} plan</1>.`
      */
    ["com.affine.payment.billing-setting.current-plan.description.yearly"]: ComponentType<TypedTransProps<{
        readonly planName: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `If you have any questions, please contact our <1>customer support</1>.`
      */
    ["com.affine.payment.license-success.text-2"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `One-time Purchase. Personal use rights for up to 150 years. <a>Fair Usage Policies</a> may apply.`
      */
    ["com.affine.payment.lifetime.caption-2"]: ComponentType<TypedTransProps<Readonly<{}>, {
        a: JSX.Element;
    }>>;
    /**
      * `You are currently on the {{currentPlan}} plan. If you have any questions, please contact our <3>customer support</3>.`
      */
    ["com.affine.payment.subtitle-active"]: ComponentType<TypedTransProps<{
        readonly currentPlan: string;
    }, {
        ["3"]: JSX.Element;
    }>>;
    /**
      * `If you have any questions, please contact our <1> customer support</1>.`
      */
    ["com.affine.payment.upgrade-success-page.support"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `If you have any questions, please contact our <1>customer support</1>.`
      */
    ["com.affine.payment.upgrade-success-page.team.text-2"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `This action deletes the old Favorites section. <b>Your documents are safe</b>, ensure you've moved your frequently accessed documents to the new personal Favorites section.`
      */
    ["com.affine.rootAppSidebar.migration-data.clean-all.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        b: JSX.Element;
    }>>;
    /**
      * `<b>Your documents are safe</b>, but you'll need to re-pin your most-used ones. "Favorites" are now personal. Move items from the old shared section to your new personal section or remove the old one by clicking "Empty the old favorites" now.`
      */
    ["com.affine.rootAppSidebar.migration-data.help.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        b: JSX.Element;
    }>>;
    /**
      * `No doc titles contain <1>{{search}}</1>`
      */
    ["com.affine.selectPage.empty.tips"]: ComponentType<TypedTransProps<{
        readonly search: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `You requested to join <1/> <2>{{workspaceName}}</2> with <3>{{userEmail}}</3>, the workspace owner and team admins will review your request.`
      */
    ["com.affine.sent-request-to-join-workspace.description"]: ComponentType<TypedTransProps<Readonly<{
        workspaceName: string;
        userEmail: string;
    }>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
        ["3"]: JSX.Element;
    }>>;
    /**
      * `Are you sure you want to delete your account from <1>{{server}}</1>?`
      */
    ["com.affine.setting.account.delete.confirm-delete-description-1"]: ComponentType<TypedTransProps<{
        readonly server: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Your account will be inaccessible, and your personal cloud space will be permanently deleted. You can remove local data by uninstalling the app or clearing your browser storage. <1>This action is irreversible.</1>`
      */
    ["com.affine.setting.account.delete.confirm-delete-description-2"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Settings changed; please restart the app. <1>Restart</1>`
      */
    ["com.affine.settings.editorSettings.general.spell-check.restart-hint"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Utilize the meeting notes and AI summarization features provided by Manut. <1>Discuss more in the community</1>.`
      */
    ["com.affine.settings.meetings.enable.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Meeting Features Available <strong>Free</strong> in Beta Phase`
      */
    ["com.affine.settings.meetings.setting.prompt.2"]: ComponentType<TypedTransProps<Readonly<{}>, {
        strong: JSX.Element;
    }>>;
    /**
      * `<strong>Where AI meets your meetings - affine your collaboration.</strong>
    <ul><li>Extract Action Items & Key Insights Instantly</li><li>Smart Auto-Capture Starts With Your Meeting</li><li>Seamless Integration Across All Meeting Platforms</li><li>One Unified Space for All Your Meeting's Context</li><li>Your AI Assistant with Every Meeting Context Preserved</li></ul>`
      */
    ["com.affine.settings.meetings.setting.welcome.hints"]: ComponentType<TypedTransProps<Readonly<{}>, {
        strong: JSX.Element;
        ul: JSX.Element;
        li: JSX.Element;
    }>>;
    /**
      * `Love our app? <1>Star us on GitHub</1> and <2>create issues</2> for your valuable feedback!`
      */
    ["com.affine.settings.suggestion-2"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
        ["2"]: JSX.Element;
    }>>;
    /**
      * `If you encounter any issues, contact support@toeverything.info. No license yet? <1>Click to purchase</1>.`
      */
    ["com.affine.settings.workspace.license.activate-modal.tips"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `This will make the workspace read-only. Your key remains usable elsewhere. Deactivation doesn't cancel your Team plan. To cancel, go to <1>Manage Payment</1>.`
      */
    ["com.affine.settings.workspace.license.deactivate-modal.description"]: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `The "<1>{{ name }}</1>" property will be removed. This action cannot be undone.`
      */
    ["com.affine.settings.workspace.properties.delete-property-desc"]: ComponentType<TypedTransProps<{
        readonly name: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> doc`
      */
    ["com.affine.settings.workspace.properties.doc"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> docs`
      */
    ["com.affine.settings.workspace.properties.doc_others"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `Manage workspace <1>{{name}}</1> properties`
      */
    ["com.affine.settings.workspace.properties.header.subtitle"]: ComponentType<TypedTransProps<{
        readonly name: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> selected`
    
      * - com.affine.tag.toolbar.selected_one: `<0>{{count}}</0> tag selected`
    
      * - com.affine.tag.toolbar.selected_other: `<0>{{count}}</0> tag(s) selected`
      */
    ["com.affine.tag.toolbar.selected"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> tag selected`
      */
    ["com.affine.tag.toolbar.selected_one"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> tag(s) selected`
      */
    ["com.affine.tag.toolbar.selected_other"]: ComponentType<TypedTransProps<{
        readonly count: string | number | bigint;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `<0>{{count}}</0> tag(s) selected`
      */
    ["com.affine.tag.toolbar.selected_others"]: ComponentType<TypedTransProps<{
        readonly count: string;
    }, {
        ["0"]: JSX.Element;
    }>>;
    /**
      * `Are you sure you want to upgrade <1>{{workspaceName}}</1> to a Team Workspace? This will allow unlimited members to collaborate in this workspace.`
      */
    ["com.affine.upgrade-to-team-page.upgrade-confirm.description"]: ComponentType<TypedTransProps<{
        readonly workspaceName: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Deleting <1>{{workspace}}</1> cannot be undone, please proceed with caution. All contents will be lost.`
      */
    ["com.affine.workspaceDelete.description"]: ComponentType<TypedTransProps<{
        readonly workspace: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * `Deleting <1>{{workspace}}</1> will delete both local and cloud data, this operation cannot be undone, please proceed with caution.`
      */
    ["com.affine.workspaceDelete.description2"]: ComponentType<TypedTransProps<{
        readonly workspace: string;
    }, {
        ["1"]: JSX.Element;
    }>>;
    /**
      * ` We recommend the <1>Chrome</1> browser for optimal experience.`
      */
    recommendBrowser: ComponentType<TypedTransProps<Readonly<{}>, {
        ["1"]: JSX.Element;
    }>>;
} = /*#__PURE__*/ createProxy(createComponent);
