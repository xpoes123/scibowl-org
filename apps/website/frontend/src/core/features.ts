/**
 * Feature gates for the Website frontend.
 */

export const features = {
    tournaments: true,

    auth: false,
    profile: false,
    avatars: false,

    study: false,
    multiplayer: false,
    social: false,
    coaching: false,
    database: false,

    home: false,
} as const;

export type FeatureName = keyof typeof features;

export function isFeatureEnabled(name: FeatureName): boolean {
    return Boolean(features[name]);
}

