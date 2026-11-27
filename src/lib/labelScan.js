import { supabase } from '../supabase';
import { searchKey } from './search';

// 사진을 AI에 보내기 좋게 줄여요 (긴 변 1568px, JPEG). 라벨 글씨는 읽힐 만큼 유지해요.
export function shrinkForScan(file, maxSide = 1568) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('사진을 고르지 않았어요.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 열 수 없어요. 다른 사진으로 해 주세요.')); };
    img.src = url;
  });
}

// 사진 → [{ name_ko, name_en, vintage, country, quantity, bottle, confidence, unsure }]
export async function scanWinePhoto(file) {
  const { base64, mediaType } = await shrinkForScan(file);
  const { data, error } = await supabase.functions.invoke('wine-label-scan', { body: { image: base64, media_type: mediaType } });
  if (error) {
    let msg = '사진 인식에 실패했어요. 다시 시도해 주세요.';
    try { const body = await error.context?.json?.(); if (body?.error) msg = body.error; } catch { /* 기본 메시지 */ }
    throw new Error(msg);
  }
  return data || { kind: 'unknown', wines: [] };
}

// 이미 등록된 와인과 같은 와인이면 기존 이름을 그대로 써요 (같은 와인으로 묶이게)
export function matchExisting(wine, stock) {
  const en = searchKey(wine.name_en);
  const ko = searchKey(wine.name_ko);
  const hit = stock.find((r) => (en && searchKey(r.englishName) === en) || (ko && searchKey(r.name) === ko));
  return hit ? { name: hit.name, englishName: hit.englishName, country: hit.country } : null;
}
