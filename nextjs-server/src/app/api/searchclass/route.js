import { supabase } from '../../lib/supabaseClient';

// Normalize and prepare search terms
function prepareSearchTerms(query) {
  const fullPhrase = query.trim().toLowerCase();
  
  // Check if the search looks like a department code pattern (e.g., "eecs 2", "math 101")
  const deptCodeMatch = fullPhrase.match(/^(\w+)\s+(\d+)/i);
  
  // Then get individual words
  const words = fullPhrase
    .split(/\s+/)
    .filter(term => term.length > 0);
    
  return { 
    fullPhrase,
    words,
    isDeptCodeSearch: !!deptCodeMatch,
    deptPrefix: deptCodeMatch ? deptCodeMatch[1] : null,
    codePrefix: deptCodeMatch ? deptCodeMatch[2] : null
  };
}

export async function POST(req) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Invalid search query' }, { status: 400 });
    }

    const { fullPhrase, words, isDeptCodeSearch, deptPrefix, codePrefix } = prepareSearchTerms(query);
    console.log('🔍 Search terms:', { fullPhrase, words, isDeptCodeSearch, deptPrefix, codePrefix });

    if (words.length === 0) {
      return Response.json([]);
    }

    let queryBuilder = supabase
      .from('allclasses')
      .select('uuid, dept, code, title');

    if (isDeptCodeSearch) {
      // For department-code searches (e.g., "eecs 2"), be more precise
      queryBuilder = queryBuilder
        .ilike('dept', `${deptPrefix}%`)
        .ilike('code', `${codePrefix}%`);
    } else {
      // For regular searches, use the previous broader matching
      queryBuilder = queryBuilder.or(
        words.length > 1
          ? `title.ilike.%${fullPhrase}%,dept.ilike.%${fullPhrase}%,code.ilike.%${fullPhrase}%,` +
            words.map(word => `title.ilike.%${word}%,dept.ilike.%${word}%,code.ilike.%${word}%`).join(',')
          : `title.ilike.%${fullPhrase}%,dept.ilike.%${fullPhrase}%,code.ilike.%${fullPhrase}%`
      );
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('❌ Supabase fetch error:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return Response.json([]);
    }

    // Deduplicate and sort results by relevance
    const seen = new Map();
    const results = [];
    
    for (const cls of data) {
      const key = `${cls.dept}-${cls.code}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        
        // Calculate match score (higher is better)
        let score = 0;
        const deptLower = cls.dept.toLowerCase();
        const codeLower = cls.code.toLowerCase();
        const titleLower = cls.title.toLowerCase();
        
        if (isDeptCodeSearch) {
          // For department-code searches, prioritize exact matches
          if (deptLower === deptPrefix.toLowerCase() && codeLower.startsWith(codePrefix)) {
            score += 10;
          }
        } else {
          // Full phrase matches get highest priority for regular searches
          if (titleLower.includes(fullPhrase)) {
            score += 10;
            if (titleLower.startsWith(fullPhrase)) {
              score += 5;
            }
          }
          
          // Individual word matches
          words.forEach(word => {
            // Exact matches in dept/code
            if (deptLower === word || codeLower === word) {
              score += 4;
            }
            // Starts with word in dept/code
            else if (deptLower.startsWith(word) || codeLower.startsWith(word)) {
              score += 3;
            }
            // Contains word in dept/code
            else if (deptLower.includes(word) || codeLower.includes(word)) {
              score += 2;
            }
            // Contains word in title
            if (titleLower.includes(word)) {
              score += 1;
            }
          });
        }
        
        results.push({ ...cls, score });
      }
    }

    // Sort by score (descending) and return all results
    return Response.json(
      results
        .sort((a, b) => {
          // First sort by score
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          // Then sort by department
          if (a.dept !== b.dept) {
            return a.dept.localeCompare(b.dept);
          }
          // Finally sort by code numerically
          const aNum = parseInt(a.code) || 0;
          const bNum = parseInt(b.code) || 0;
          return aNum - bNum;
        })
        .map(({ score, ...cls }) => cls) // Remove score from final output
    );

  } catch (err) {
    console.error(' Server crash:', err.message);
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
