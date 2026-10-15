type Logger = (message: string) => void;
export declare function ensureDesktopPatch(options: {
    enabled: boolean;
    log?: Logger;
}): void;
export {};
