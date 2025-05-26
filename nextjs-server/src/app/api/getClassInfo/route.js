import { execFile } from 'child_process';
import path from 'path';
import { supabase } from '../../lib/supabaseClient';

function parseTimeToFloat(start, end) {
  const to24 = (timeStr) => {
    const [time, meridian] = timeStr.trim().split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (meridian === 'PM' && hours !== 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    return hours + minutes / 60;
  };

  try {
    return parseFloat((to24(end) - to24(start)).toFixed(2));
  } catch {
    return 0;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { subject, term } = body;

    if (!subject || !term) {
      return Response.json({ error: 'Missing subject or term' }, { status: 400 });
    }

    const scriptPath = path.resolve('src/app/scripts/scrape_ku_classes.py');

    return new Promise((resolve) => {
      execFile('python', [scriptPath, subject, term], async (error, stdout) => {
        if (error) {
          console.error('❌ Python execution error:', error);
          return resolve(Response.json({ error: 'Python script failed' }, { status: 500 }));
        }

        try {
          const parsed = JSON.parse(stdout);
          const responseToFrontend = [];

          for (const course of parsed) {
            const courseSections = [];
            let dbTitle = ''; // 🟢 new: to store the first valid title from DB

            for (const section of course.sections) {
              const classID = parseInt(section.class_number);
              const component = section.type;
              const available = section.seats_available.toLowerCase() === 'full' ? 0 : parseInt(section.seats_available);
              const duration = parseTimeToFloat(section.start_time, section.end_time);

              // Fetch from DB
              const { data: match, error: fetchErr } = await supabase
                .from('allclasses')
                .select('uuid, title, availseats')
                .eq('classid', classID)
                .eq('component', component)
                .maybeSingle();

              if (!match) {
                console.warn(`⚠️ No match found for classID ${classID}, component ${component}`);
                continue;
              }

              if (!dbTitle) dbTitle = match.title; // 🟢 set title once

              // Only update available if changed
              if (match.availseats !== available) {
                await supabase
                  .from('allclasses')
                  .update({ availseats: available })
                  .eq('classid', classID)
                  .eq('component', component);
              }

              courseSections.push({
                classID,
                uuid: match.uuid,
                component,
                starttime: section.start_time,
                endtime: section.end_time,
                days: section.days,
                instructor: section.instructor,
                seats_available: available,
                room: section.room,
                building: section.building,
                duration
              });
            }

            // Push course with title from DB + sections
            if (courseSections.length > 0) {
              responseToFrontend.push({
                dept: course.sections[0]?.dept || '',
                code: course.sections[0]?.code || '',
                title: dbTitle, // 🟢 fixed: now comes from match.title
                description: course.description,
                sections: courseSections
              });
            }
          }

          return resolve(Response.json({ success: true, data: responseToFrontend }, { status: 200 }));
        } catch (parseErr) {
          console.error('❌ JSON parse error:', parseErr);
          console.error('🔎 Raw stdout:', stdout);
          return resolve(Response.json({ error: 'Invalid JSON from Python script' }, { status: 500 }));
        }
      });
    });
  } catch (err) {
    console.error('getClassInfo server error:', err);
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
