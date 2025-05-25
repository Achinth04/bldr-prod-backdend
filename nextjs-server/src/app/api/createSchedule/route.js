import { supabase } from '../../lib/supabaseClient';
import { v4 as uuid } from 'uuid';

export async function POST(req) {
  const { onlineID, scheduleName, semester, year } = await req.json();

  // insert into allSchedules
  const { data: sched, error: e1 } = await supabase
    .from('allschedules')
    .insert({ scheduleid: uuid(), schedulename: scheduleName, semester: semester, year: year })
    .select()
    .single();

  if (e1) return Response.json({ error: e1.message }, { status: 500 });

  // link in userSchedule
  const { data: link, error: e2 } = await supabase
    .from('userschedule')
    .insert({ onlineid: onlineID, scheduleid: sched.scheduleid, isactive: true })
    .select()
    .single();

  if (e2) return Response.json({ error: e2.message }, { status: 500 });

  return Response.json({ schedule: sched, userSchedule: link });
}
