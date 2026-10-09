import cover01 from './notebook-covers/cover-01.jpg';
import cover02 from './notebook-covers/cover-02.jpg';
import cover03 from './notebook-covers/cover-03.jpg';
import cover04 from './notebook-covers/cover-04.jpg';
import cover05 from './notebook-covers/cover-05.jpg';
import cover06 from './notebook-covers/cover-06.jpg';
import cover07 from './notebook-covers/cover-07.jpg';
import cover08 from './notebook-covers/cover-08.jpg';

const coverPool = [cover01, cover02, cover03, cover04, cover05, cover06, cover07, cover08];

export const defaultCoverFor = (documentId: number) => {
  const randomValue = Math.sin(documentId * 12.9898) * 43758.5453;
  const normalized = randomValue - Math.floor(randomValue);
  return coverPool[Math.floor(normalized * coverPool.length)] ?? cover01;
};
