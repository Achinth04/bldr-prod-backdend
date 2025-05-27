import { supabase } from '../../lib/supabaseClient';
import puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
    const { subject, term = '4259' } = body;

    if (!subject || !term) {
      return Response.json({ error: 'Missing subject or term' }, { status: 400 });
    }

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto('https://classes.ku.edu/', { waitUntil: 'networkidle2' });

    await page.select('#classesSearchCareer', 'UndergraduateGraduate');
    await page.select('#classesSearchTerm', term);

    await page.type('#classesSearchText', subject);
    await page.keyboard.press('Enter');
    await sleep(2000);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.click('.btn.btn-primary.classSearchButton');
    await page.waitForSelector('#classes_ajaxDiv');

    const content = await page.$eval('#classes_ajaxDiv', el => el.innerHTML);
    await browser.close();

    const dom = new JSDOM(content);
    const doc = dom.window.document;
    const h3s = doc.querySelectorAll('h3');
    const responseToFrontend = [];

    for (const h3 of h3s) {
      const course_title = h3.textContent.trim();
      const course_code = course_title.split(' ')[1];
      const header_tr = h3.closest('tr');
      const desc_tr = header_tr?.nextElementSibling;
      const desc_td = desc_tr?.querySelector('td');
      const desc_text = desc_td?.textContent.replace(/\s+/g, ' ').trim() || '';
      const sec_tr = desc_tr?.nextElementSibling;
      const table = sec_tr?.querySelector('table.class_list');
      if (!table) continue;

      const rows = Array.from(table.querySelectorAll('tr')).slice(1);
      const courseSections = [];
      let dbTitle = '';

      for (let i = 0; i < rows.length; i += 2) {
        const cols = rows[i].querySelectorAll('td');
        if (cols.length !== 5) continue;

        const saveLink = cols[3].querySelector('a.saveSectionLink');
        const class_number = (cols[3].querySelector('strong') || cols[3])?.textContent.trim();
        const component = cols[0].textContent.trim();

        const nextRow = rows[i + 1];
        const nextCols = nextRow?.querySelectorAll('td') || [];
        const rawDetail = nextCols[1]?.textContent.split('|') || [];
        const raw_days = rawDetail[0]?.trim() || '';
        const room_str = rawDetail[1]?.trim() || '';
        const campus_str = rawDetail[2]?.trim().replace(/^\- /, '') || '';

        const [days, time_part] = raw_days.split(' ');
        const [start_raw, end_time] = time_part?.split('-').map(t => t?.trim()) || ['', ''];

        let start_time = '';
        try {
          const hour = parseInt(start_raw.split(':')[0]);
          const suffix = (hour >= 8 && hour <= 11) ? 'AM' : 'PM';
          start_time = `${start_raw} ${suffix}`;
        } catch {
          start_time = start_raw;
        }

        const [building, ...roomArr] = room_str.split(' ');
        const room = roomArr.join(' ');

        const classID = parseInt(class_number);
        const available = cols[4].textContent.trim().toLowerCase() === 'full' ? 0 : parseInt(cols[4].textContent.trim());
        const duration = parseTimeToFloat(start_time, end_time);

        const { data: match } = await supabase
          .from('allclasses')
          .select('uuid, title, availseats')
          .eq('classid', classID)
          .eq('component', component)
          .maybeSingle();

        if (!match) {
          console.warn(`⚠️ No match found for classID ${classID}, component ${component}`);
          continue;
        }

        if (!dbTitle) dbTitle = match.title;

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
          starttime: start_time,
          endtime: end_time,
          days,
          instructor: cols[1].textContent.trim(),
          seats_available: available,
          room,
          building,
          duration
        });
      }

      if (courseSections.length > 0) {
        responseToFrontend.push({
          dept: courseSections[0]?.dept || '',
          code: courseSections[0]?.code || course_code,
          title: dbTitle,
          description: desc_text,
          sections: courseSections
        });
      }
    }

    return Response.json({ success: true, data: responseToFrontend }, { status: 200 });
  } catch (err) {
    console.error('getClassInfo server error:', err);
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
