import PublicMenuClient from '@/components/public/PublicMenuClient';
import { getSystemSettings } from '@/lib/actions/system.actions';

export const revalidate = 10;

export default async function PublicMenuPage() {
  const settings = await getSystemSettings();
  return <PublicMenuClient isDarkMode={settings.publicMenuDarkMode} />;
}
