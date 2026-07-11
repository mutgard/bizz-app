import { T } from '../tokens';
import { Serif } from '../components/primitives';
import { t } from '../config';

export function TodayScreen() {
  return (
    <div style={{ padding: 32 }}>
      <Serif size={32} italic>{t('nav.today')}</Serif>
      <div style={{ marginTop: 8, fontFamily: T.mono, fontSize: 11, color: T.ink3 }}>—</div>
    </div>
  );
}
