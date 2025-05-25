import { supabase } from '../../lib/supabaseClient';
import bcrypt from 'bcrypt';

export async function POST(req) {
  try {
    const body = await req.json();
    const { onlineID, password } = body;

    if (!onlineID || !password) {
      return Response.json({ error: 'Missing onlineID or password' }, { status: 400 });
    }

    // Get user from database
    const { data: user, error: fetchError } = await supabase
      .from('userdata')
      .select('onlineid, passhash')
      .eq('onlineid', onlineID)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching user:', fetchError);
      return Response.json({ error: 'Failed to authenticate' }, { status: 500 });
    }

    if (!user) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Compare password with stored hash
    const isValidPassword = await bcrypt.compare(password, user.passhash);

    if (!isValidPassword) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Return success response
    return Response.json({ 
      success: true, 
      message: 'Login successful',
      user: { onlineID: user.onlineid }
    }, { status: 200 });

  } catch (err) {
    console.error('Login error:', err);
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
} 