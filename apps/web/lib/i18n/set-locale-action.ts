'use server';
import { revalidatePath } from 'next/cache';
import { writeLocaleCookie } from './cookie';
import { SUPPORTED_LOCALES, type Locale } from './types';

export async function setLocaleAction(locale: Locale): Promise<void> {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  await writeLocaleCookie(locale);
  revalidatePath('/', 'layout');
}
