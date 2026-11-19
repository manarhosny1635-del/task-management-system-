import { makeT, defaultLocale, LOCALES } from './index';
export const t = makeT(defaultLocale);
export const locale = defaultLocale;
export const dir = LOCALES[defaultLocale].dir;
export const dateLocale = LOCALES[defaultLocale].dateLocale;
