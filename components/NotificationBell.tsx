'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { t } from '@/lib/i18n/t';
import { Icon } from './Shell';

export function NotificationBell({ profileId }: { profileId: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false);
      setCount(count ?? 0);
    };
    load();
    const ch = supabase.channel('notif-' + profileId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profileId}` }, load)
      .subscribe();
    const iv = setInterval(load, 60000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [profileId]);
  return (
    <Link href="/notifications" className="btn-ghost relative" aria-label={t('nav.notifications')}>
      <Icon name="notifications" className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 end-0.5 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[11px] font-bold leading-[18px] text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
