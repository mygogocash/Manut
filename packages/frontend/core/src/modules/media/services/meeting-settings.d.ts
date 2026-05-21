import type { MeetingSettingsSchema } from '@affine/electron/main/shared-state-schema';
import { LiveData, Service } from '@toeverything/infra';
import type { GlobalStateService } from '../../storage';
export declare class MeetingSettingsService extends Service {
    private readonly globalStateService;
    constructor(globalStateService: GlobalStateService);
    private readonly desktopApiService;
    readonly settings$: LiveData<{
        enabled: boolean;
        betaDisclaimerAccepted: boolean;
        recordingSavingMode: "new-doc" | "journal-today";
        autoTranscriptionSummary: boolean;
        autoTranscriptionTodo: boolean;
        recordingMode: "prompt" | "none" | "auto-start";
    }>;
    get settings(): {
        enabled: boolean;
        betaDisclaimerAccepted: boolean;
        recordingSavingMode: "new-doc" | "journal-today";
        autoTranscriptionSummary: boolean;
        autoTranscriptionTodo: boolean;
        recordingMode: "prompt" | "none" | "auto-start";
    };
    setBetaDisclaimerAccepted(accepted: boolean): void;
    setEnabled(enabled: boolean): Promise<void>;
    setRecordingSavingMode(mode: MeetingSettingsSchema['recordingSavingMode']): void;
    setAutoSummary(autoSummary: boolean): void;
    setAutoTodo(autoTodo: boolean): void;
    isRecordingFeatureAvailable(): Promise<boolean | undefined>;
    checkMeetingPermissions(): Promise<{
        screen: boolean;
        microphone: boolean;
    } | undefined>;
    showRecordingPermissionSetting(type: 'screen' | 'microphone'): Promise<false | void | undefined>;
    askForMeetingPermission(type: 'microphone' | 'screen'): Promise<boolean | undefined>;
    setRecordingMode: (mode: MeetingSettingsSchema["recordingMode"]) => void;
    openSavedRecordings(): Promise<void>;
}
//# sourceMappingURL=meeting-settings.d.ts.map