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

export const MAX_SCAN_PHOTOS = 10;

// 사진 여러 장 → { kind, wines: [{ name_ko, name_en, vintage, country, quantity, bottle, confidence, unsure, photos, front_photo }] }
// 같은 병의 앞면·뒷면은 하나로 묶여 와요. photos/front_photo는 1부터 세는 사진 번호예요.
export async function scanWinePhotos(files) {
  const list = Array.from(files || []).slice(0, MAX_SCAN_PHOTOS);
  if (!list.length) throw new Error('사진을 고르지 않았어요.');
  // 장 수가 많으면 조금 더 줄여서 보내요 (요청 크기 제한)
  const side = list.length <= 2 ? 1568 : list.length <= 5 ? 1280 : 1024;
  const images = [];
  for (const f of list) {
    const { base64, mediaType } = await shrinkForScan(f, side);
    images.push({ data: base64, media_type: mediaType });
  }
  const { data, error } = await supabase.functions.invoke('wine-label-scan', { body: { images } });
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
