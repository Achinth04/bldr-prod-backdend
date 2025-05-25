import { supabase } from '../../lib/supabaseClient';
import { DateTime } from "luxon";

const chicagoTime = DateTime.now().setZone('America/Chicago').toISO();
export async function POST(req) {
  try {
    const { scheduleid, newScheduleName } = await req.json();

    if (!scheduleid || !newScheduleName) {
      return Response.json({ error: 'Missing scheduleID or newScheduleName' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('allschedules')
      .update({ schedulename: newScheduleName, lastedited: chicagoTime })
      .eq('scheduleid', scheduleid)
      .select();

    if (error) {
      return Response.json({ error: 'Failed to update schedule name', details: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data }, { status: 200 });

  } catch (err) {
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
