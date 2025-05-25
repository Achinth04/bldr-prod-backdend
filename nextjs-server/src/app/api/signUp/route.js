import { supabase } from '../../lib/supabaseClient';
import bcrypt from 'bcrypt';

export async function POST(req) {
  try {
    const body = await req.json();
    const { onlineID, password } = body;

    if (!onlineID || !password) {
      return Response.json({ error: 'Missing onlineID or password' }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('userdata')
      .select('onlineID')
      .eq('onlineID', onlineID)
      .maybeSingle();

    if (existingUser) {
      return Response.json({ error: 'User already exists' }, { status: 409 });
    }

    // Hash password with salt
    const saltRounds = 10;
    const passHash = await bcrypt.hash(password, saltRounds);

    console.log('Creating user:', onlineID);
    console.log('Hashed password:', passHash);

    // Insert new user
    const { data: insertData, error: insertError } = await supabase
      .from('userdata')
      .insert([{ onlineid: onlineID, passhash: passHash, isactive: true }]);

    console.log('Insert result:', insertData);
    console.error('Insert error:', insertError);



    if (insertError) {
      console.error('Error inserting user:', insertError.details);
      return Response.json({ error: 'Failed to create user' }, { status: 500 });
    }

    return Response.json({ success: true, message: 'User created successfully' }, { status: 201 });

  } catch (err) {
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
