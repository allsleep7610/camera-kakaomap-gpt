export function buildKakaoMapUrl(name: string, latitude: number, longitude: number): string {
  const encodedName = encodeURIComponent(name);
  return `https://map.kakao.com/link/map/${encodedName},${latitude},${longitude}`;
}
