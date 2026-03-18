import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendTelegramText(chatId: string, text: string, token: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

async function sendTelegramVoice(chatId: string, audioBuffer: Uint8Array, token: string): Promise<void> {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('voice', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'question.mp3');
  await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
    method: 'POST',
    body: formData,
  });
}

async function generateTTS(text: string, voice: string, openaiKey: string): Promise<Uint8Array | null> {
  try {
    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: text,
        voice: voice,
        speed: 0.9,
      }),
    });
    if (!resp.ok) return null;
    return new Uint8Array(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

async function generateQuestions(
  supabase: any,
  openaiKey: string,
  count: number
): Promise<Array<{ category: string; question: string; context: string }>> {
  const { data: recentReplies } = await supabase
    .from('distribution_ai_match_logs')
    .select('raw_text, dre_reply, detected_language')
    .eq('needs_language_review', true)
    .eq('source_channel', 'telegram')
    .is('corrected_reply', null)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: topEntries } = await supabase
    .from('papiamentu_training_entries')
    .select('corrected_phrase, category')
    .order('times_used', { ascending: false })
    .limit(5);

  const recentRepliesContext = (recentReplies || [])
    .map((r: any) => `Customer said: "${r.raw_text}" → Dre replied: "${r.dre_reply}"`)
    .join('\n');

  const topPhrasesContext = (topEntries || [])
    .map((e: any) => e.corrected_phrase)
    .join(', ');

  const prompt = `You are generating daily Papiamentu language training questions for Bolenga, a native Curaçao Papiamentu speaker and language expert. She teaches Dre (an AI sales bot) how to speak natural Curaçao Papiamentu.

Generate exactly ${count} training questions covering these categories:
- vocabulary (3 questions): local produce names, units, grocery terms
- grammar (3 questions): correct sentence structure, verb conjugation
- sales_phrase (3 questions): how to confirm orders, ask for quantities, handle requests
- slang (2 questions): informal expressions real Curaçao customers use when ordering
- objection_handling (2 questions): how to respond when customer is unhappy
- greeting (2 questions): appropriate greetings for different times of day and contexts

Recent Dre conversations to correct:
${recentRepliesContext || 'No recent conversations yet.'}

Frequently used phrases to validate:
${topPhrasesContext || 'None yet.'}

Return ONLY valid JSON:
{
  "questions": [
    {
      "category": "vocabulary",
      "question": "How do you say 'bell pepper' in natural Curaçao Papiamentu? What do customers actually call it when ordering?",
      "context": "Used when a customer orders peppers"
    }
  ]
}

Make questions conversational and practical. Focus on real ordering scenarios. Include the specific Dre reply to correct when relevant.`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });
    const data = await resp.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return parsed.questions || [];
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');

  if (!telegramToken || !openaiKey) {
    return new Response(JSON.stringify({ error: 'Missing secrets' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['bolenga_telegram_chat_id', 'training_questions_per_day', 'tts_voice']);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    const bolengaChatId = settingsMap.bolenga_telegram_chat_id;
    const questionCount = parseInt(settingsMap.training_questions_per_day || '15');
    const ttsVoice = settingsMap.tts_voice || 'nova';

    if (!bolengaChatId) {
      return new Response(JSON.stringify({ error: 'Bolenga Telegram chat ID not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: session } = await supabase
      .from('papiamentu_training_sessions')
      .insert({
        session_date: new Date().toISOString().split('T')[0],
        status: 'in_progress',
        questions_sent: 0,
      })
      .select().single();

    if (!session) throw new Error('Failed to create session');

    const questions = await generateQuestions(supabase, openaiKey, questionCount);

    const curacaoHour = new Date(Date.now() - 4 * 60 * 60 * 1000).getUTCHours();
    const greeting = curacaoHour < 12 ? 'Bon dia' : curacaoHour < 18 ? 'Bon tardi' : 'Bon nochi';
    await sendTelegramText(
      bolengaChatId,
      `${greeting} Bolenga! 🌿 Here are today's ${questions.length} Papiamentu training questions for Dre. Please answer each one — your responses will be saved directly into Dre's knowledge base. Take your time! 💪`,
      telegramToken
    );

    let sentCount = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionText = `<b>Question ${i + 1}/${questions.length}</b> [${q.category}]\n\n${q.question}${q.context ? `\n\n<i>Context: ${q.context}</i>` : ''}`;

      const audioBuffer = await generateTTS(
        `Question ${i + 1}. ${q.question}`,
        ttsVoice,
        openaiKey
      );

      if (audioBuffer) {
        await sendTelegramVoice(kathyChatId, audioBuffer, telegramToken);

        const audioPath = `training/${session.id}/q${i + 1}.mp3`;
        await supabase.storage
          .from('order-media')
          .upload(audioPath, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

        const { data: urlData } = supabase.storage
          .from('order-media')
          .getPublicUrl(audioPath);

        await sendTelegramText(kathyChatId, questionText, telegramToken);

        await supabase.from('papiamentu_training_questions').insert({
          session_id: session.id,
          question_number: i + 1,
          category: q.category,
          question_text: q.question,
          context: q.context,
          audio_url: urlData?.publicUrl || null,
          status: 'sent',
        });
      } else {
        await sendTelegramText(kathyChatId, questionText, telegramToken);
        await supabase.from('papiamentu_training_questions').insert({
          session_id: session.id,
          question_number: i + 1,
          category: q.category,
          question_text: q.question,
          context: q.context,
          status: 'sent',
        });
      }

      sentCount++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await supabase.from('papiamentu_training_sessions').update({
      questions_sent: sentCount,
      status: 'in_progress',
    }).eq('id', session.id);

    await sendTelegramText(
      kathyChatId,
      `✅ All ${sentCount} questions sent! Reply to each one in order. You can reply with text or a voice message. Danki Kathy! 🙏`,
      telegramToken
    );

    return new Response(JSON.stringify({ success: true, session_id: session.id, questions_sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('send-daily-training error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
