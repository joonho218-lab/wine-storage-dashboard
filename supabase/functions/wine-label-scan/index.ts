// 와인 사진(라벨 또는 손글씨/인쇄 목록)을 읽어 등록 칸을 채워 줘요.
// Claude API 키는 Supabase 비밀값 ANTHROPIC_API_KEY 에만 두고, 사이트 코드에는 두지 않아요.
// 팀 계정으로 로그인한 사람만 쓸 수 있어요.
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const MODEL = 'claude-sonnet-5-5';
const COUNTRIES = ['프랑스', '미국', '이탈리아', '스페인', '호주', '칠레', '포르투갈', '독일', '기타'];
const MAX_IMAGE_B64 = 6_000_000; // 약 4.5MB 사진

const TOOL = {
  name: 'report_wines',
  description: '사진에서 읽은 와인을 알려 줍니다.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['label', 'list', 'unknown'], description: 'label: 병/라벨 사진, list: 여러 와인이 적힌 목록·표, unknown: 와인을 못 찾음' },
      wines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name_ko: { type: 'string', description: '한국 와인 업계에서 흔히 쓰는 한글 표기 (예: 샤또 마고, 도멘 퐁소 끌로 드 라 로슈). 목록 사진이면 적힌 한글 그대로.' },
            name_en: { type: 'string', description: '생산자 + 와인명 정식 표기, 악센트 포함 (예: Château Margaux, Domaine Ponsot Clos de la Roche Grand Cru)' },
            vintage: { type: 'string', description: '4자리 연도, 논빈티지면 NV, 안 보이면 빈 문자열' },
            country: { type: 'string', enum: COUNTRIES },
            quantity: { type: 'integer', description: '목록 사진에 수량이 적혀 있으면 그 수, 아니면 1' },
            bottle: { type: 'string', description: '750ml가 아니면 용량 (예: 1.5L 매그넘), 아니면 빈 문자열' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            unsure: { type: 'string', description: '확실하지 않은 부분을 한국어로 짧게 (없으면 빈 문자열)' },
          },
          required: ['name_ko', 'name_en', 'vintage', 'country', 'quantity', 'bottle', 'confidence', 'unsure'],
        },
      },
    },
    required: ['kind', 'wines'],
  },
};

const PROMPT = `와인 재고 대시보드에 등록하려고 찍은 사진이에요.
- 병 라벨 사진이면 그 와인 한 병을 읽어 주세요. 빈티지는 라벨이나 목 부분 표기에서 찾아요.
- 여러 와인이 적힌 목록·표 사진이면 줄마다 읽어 주세요 (와인명, 연도, 수량).
- 지어내지 마세요. 안 보이는 빈티지는 빈 문자열로 두고, 애매하면 confidence를 낮추고 unsure에 적어 주세요.
- 한글명은 한국 수입사/와인샵에서 흔히 쓰는 표기로 (샤또, 도멘, 그랑 크뤼 등).`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: '사진 인식 설정이 아직 안 됐어요. 관리자에게 알려 주세요.' }, 503);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: '로그인해 주세요.' }, 401);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: '다시 로그인해 주세요.' }, 401);
  const { data: member } = await admin.from('team_members').select('active, needs_password_change').eq('user_id', user.id).single();
  if (!member?.active || member.needs_password_change) return json({ error: '팀 계정만 사용할 수 있어요.' }, 403);

  let body: { image?: unknown; media_type?: unknown };
  try { body = await req.json(); } catch { return json({ error: '사진을 읽지 못했어요.' }, 400); }
  const image = typeof body.image === 'string' ? body.image : '';
  const mediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(String(body.media_type)) ? String(body.media_type) : 'image/jpeg';
  if (!image || image.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(image)) return json({ error: '사진이 너무 크거나 올바르지 않아요.' }, 400);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000, // 긴 목록 사진(수십 줄)도 끝까지 읽게
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        { type: 'text', text: PROMPT },
      ] }],
    }),
  });
  if (!res.ok) {
    const status = res.status;
    console.error('anthropic error', status, (await res.text()).slice(0, 300));
    if (status === 401 || status === 403) return json({ error: '사진 인식 키가 맞지 않아요. 관리자에게 알려 주세요.' }, 502);
    if (status === 429 || status === 529) return json({ error: '사진 인식이 잠시 바빠요. 조금 뒤 다시 시도해 주세요.' }, 503);
    if (status === 400) return json({ error: '사진을 읽지 못했어요. 라벨이 잘 보이게 다시 찍어 주세요.' }, 400);
    return json({ error: '사진 인식에 실패했어요. 다시 시도해 주세요.' }, 502);
  }
  const data = await res.json();
  const use = (data.content || []).find((c: { type: string }) => c.type === 'tool_use');
  const out = use?.input || { kind: 'unknown', wines: [] };
  const wines = (Array.isArray(out.wines) ? out.wines : []).slice(0, 80).map((w: Record<string, unknown>) => ({
    name_ko: String(w.name_ko || '').slice(0, 120),
    name_en: String(w.name_en || '').slice(0, 160),
    vintage: /^(\d{4}|NV)$/.test(String(w.vintage || '')) ? String(w.vintage) : '',
    country: COUNTRIES.includes(String(w.country)) ? String(w.country) : '기타',
    quantity: Math.min(999, Math.max(1, Number.parseInt(String(w.quantity), 10) || 1)),
    bottle: String(w.bottle || '').slice(0, 40),
    confidence: ['high', 'medium', 'low'].includes(String(w.confidence)) ? String(w.confidence) : 'low',
    unsure: String(w.unsure || '').slice(0, 200),
  })).filter((w: { name_ko: string; name_en: string }) => w.name_ko || w.name_en);
  return json({ kind: out.kind || 'unknown', wines });
});
